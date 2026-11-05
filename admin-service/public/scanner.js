const $ = id => document.getElementById(id);
let busy = false, controls = null, cameraRun = 0, lastScan = null, resultTimer = null, lastDecodedCode = null, lastDetectedAt = 0, cameraFailed = false;
const params = new URLSearchParams(location.hash.slice(1));
const activationToken = params.get('token');
const activationMode = new URLSearchParams(location.search).get('mode') === 'relink' ? 'relink' : 'enrol';
if (location.pathname === '/scan/activate') history.replaceState(null, '', '/scan/activate');

async function api(path, body, timeout = 20000) {
  const response = await fetch(path, {method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(timeout),
    headers: body === undefined ? {} : {'content-type': 'application/json'}, ...(body === undefined ? {} : {body: JSON.stringify(body)})});
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || 'Request failed.'), {status: response.status, ticket: data.ticket});
  return data;
}
function result(text, kind = 'error', ticket, uncertain = false) {
  clearTimeout(resultTimer);
  const box = $('result'); box.hidden = false; box.className = `is-${kind}`;
  $('result-title').textContent = text;
  $('result-detail').textContent = ticket?.ticket_number || '';
  if (ticket?.checked_in_at && kind === 'error') $('result-detail').textContent += ` · Checked in ${new Date(ticket.checked_in_at).toLocaleTimeString('en-GB')}`;
  if (ticket?.ticket_number) $('ticket-number').textContent = ticket.ticket_number;
  $('retry').hidden = !uncertain;
  $('dismiss').textContent = $('scanner').hidden ? 'Continue' : 'Scan next ticket';
  $('dismiss').hidden = kind === 'success' || kind === 'rehearsal' || uncertain;
  if (uncertain) $('retry').focus();
  else if (!$('dismiss').hidden) $('dismiss').focus();
}
function lock(value) {
  busy = value;
  for (const el of document.querySelectorAll('#manual button,#manual input')) el.disabled = value;
  $('scan-state').textContent = value ? 'Checking ticket…' : 'Ready to scan';
}
function dismissResult() {
  clearTimeout(resultTimer); $('result').hidden = true; lock(false);
  if (!$('scanner').hidden && !controls && !document.hidden && !cameraFailed) void startCamera();
}
$('dismiss').onclick = dismissResult;
function stopCamera() {
  cameraRun++; controls?.stop(); controls = null;
  $('camera').hidden = false; $('camera').textContent = 'Start camera';
}
async function scan(attempt) {
  if (busy) return;
  lock(true); $('result').hidden = true; $('retry').hidden = true;
  $('ticket-number').textContent = /^UFI-T-/i.test(attempt.code) ? attempt.code.toUpperCase() : '—';
  try {
    const data = await api('/api/scanner/check-in', attempt, 15000);
    lastScan = null;
    result(data.validationOnly ? 'Rehearsal — valid ticket' : 'Ticket checked in', data.validationOnly ? 'rehearsal' : 'success', data.ticket);
    if (data.validationOnly) $('result-detail').textContent += ' · Not admitted';
    $('scan-state').textContent = data.validationOnly ? 'Rehearsal' : 'Checked in';
    $('manual').reset();
    resultTimer = setTimeout(dismissResult, 2000);
  } catch (error) {
    $('scan-state').textContent = 'Scan paused';
    if (!error.status || error.status >= 500) {
      lastScan = attempt;
      result('Not confirmed — do not admit', 'error', null, true);
      $('result-detail').textContent = 'Check your connection, then confirm this scan.';
    } else {
      lastScan = null;
      if (error.status === 401) {stopCamera(); $('scanner').hidden = true; $('access').hidden = false; $('management').hidden = true;}
      result(error.message, 'error', error.ticket);
    }
  }
}
$('manual').onsubmit = event => {event.preventDefault(); const code = new FormData(event.currentTarget).get('code').trim(); void scan({code, requestId: crypto.randomUUID()});};
$('retry').onclick = () => {if (lastScan) {lock(false); void scan(lastScan);}};
async function startCamera() {
  if (controls || document.hidden || busy || !$('result').hidden) return;
  const run = ++cameraRun; cameraFailed = false; $('camera').hidden = true;
  try {
    const reader = new ZXingBrowser.BrowserQRCodeReader();
    const active = await reader.decodeFromConstraints({video: {facingMode: {ideal: 'environment'}}}, $('video'), decoded => {
      if (run !== cameraRun || !decoded) return;
      const code = decoded.getText(), now = Date.now();
      const held = code === lastDecodedCode && now - lastDetectedAt < 900;
      lastDecodedCode = code; lastDetectedAt = now;
      if (busy || !$('result').hidden || held) return;
      void scan({code, requestId: crypto.randomUUID()});
    });
    if (run !== cameraRun) active.stop(); else controls = active;
  } catch {if (run === cameraRun) {stopCamera(); cameraFailed = true; result('Camera unavailable', 'error'); $('result-detail').textContent = 'Allow camera access or enter the ticket number.';}}
}
$('camera').onclick = () => void startCamera();
window.addEventListener('pagehide', stopCamera);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopCamera();
  else if (!$('scanner').hidden && !busy && $('result').hidden && !cameraFailed) void startCamera();
});
$('settings-content').append($('end-access'), $('management'));
async function session() {
  try {
    const data = await api('/api/scanner/session');
    $('identity').textContent = `${data.testing ? 'Testing scanner · test tickets only' : 'Live tickets'} · ${data.label}`;
    $('access').hidden = true; $('scanner').hidden = false; $('management').hidden = !data.admin; $('end-access').hidden = data.admin;
    if (data.admin) await devices();
    void startCamera();
  } catch (error) {$('identity').textContent = 'Scanner access needed'; $('access').hidden = false; if (error.status !== 401) result(error.message);}
}
$('login').onsubmit = async event => {
  event.preventDefault(); const form = event.currentTarget, button = form.querySelector('button'); button.disabled = true;
  try {await api('/api/login', Object.fromEntries(new FormData(form))); form.reset(); $('result').hidden = true; await session();}
  catch (error) {result(error.message);} finally {button.disabled = false;}
};
$('activate').onsubmit = async event => {
  event.preventDefault(); const button = event.currentTarget.querySelector('button'); button.disabled = true;
  try {await api('/api/scanner/activate', {token: activationToken, mode: activationMode, label: new FormData(event.currentTarget).get('label')}); location.replace('/scan');}
  catch (error) {result(error.message); button.disabled = false;}
};
$('end-access').onclick = async () => {try {await api('/api/scanner/logout', {}); location.reload();} catch (error) {result(error.message);}};
async function enrol(sessionId) {
  try {
    const data = await api('/api/scanner/enrol', sessionId ? {sessionId} : {});
    $('enrol-qr').src = data.qrDataUrl; $('enrolment').hidden = false;
    $('enrol-description').textContent = `${sessionId ? 'Relink this device' : 'Scan with each door device'} before ${new Date(data.expires).toLocaleTimeString('en-GB')}. Access expires two hours after ${data.eventTitle} ends.`;
  } catch (error) {result(error.message);}
}
$('enrol').onclick = () => enrol();
$('close-enrolment').onclick = async () => {try {await api('/api/scanner/close-enrolment', {}); $('enrolment').hidden = true;} catch (error) {result(error.message);}};
async function devices() {
  const data = await api('/api/scanner/devices'); $('devices').replaceChildren();
  for (const device of data.devices) {
    const row = document.createElement('div'); row.className = 'scanner-device';
    const label = document.createElement('p'); label.textContent = `${device.device_label} · ${device.revoked_at ? 'Revoked' : 'Active'} · ${device.scan_count} scans`; row.append(label);
    const relink = document.createElement('button'); relink.className = 'button'; relink.textContent = 'Relink device'; relink.onclick = () => enrol(device.id); row.append(relink);
    if (!device.revoked_at) {const revoke = document.createElement('button'); revoke.className = 'button ghost'; revoke.textContent = 'Revoke'; revoke.onclick = async () => {revoke.disabled = true; try {await api('/api/scanner/revoke', {id: device.id}); await devices();} catch (error) {result(error.message); revoke.disabled = false;}}; row.append(revoke);}
    $('devices').append(row);
  }
}
if (location.pathname === '/scan/activate') {
  $('identity').textContent = 'Authorise this door device'; $('activation').hidden = false;
  if (!activationToken) {result('This link is missing its access key. Ask for a new scanner access QR.'); $('activate').querySelector('button').disabled = true;}
} else void session();
