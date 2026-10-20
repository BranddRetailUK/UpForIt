const $ = id => document.getElementById(id);
let busy = false, controls = null, cameraRun = 0, lastScan = null;
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
function result(text, kind = 'error', ticket) {
  const box = $('result'); box.replaceChildren(); box.hidden = false; box.className = `is-${kind}`;
  const title = document.createElement('strong'); title.textContent = text; box.append(title);
  if (ticket) {
    const detail = document.createElement('p');
    detail.textContent = `${ticket.display_name} · ${ticket.ticket_number} · ${ticket.event_title}`;
    if (ticket.checked_in_at) detail.textContent += ` · Checked in ${new Date(ticket.checked_in_at).toLocaleTimeString('en-GB')}`;
    box.append(detail);
  }
}
function lock(value) {
  busy = value;
  for (const el of document.querySelectorAll('#scanner button,#manual input')) el.disabled = value;
}
function stopCamera() {cameraRun++; controls?.stop(); controls = null; $('video').hidden = true; $('camera').textContent = 'Scan QR code';}
async function scan(attempt) {
  if (busy) return;
  stopCamera(); lock(true); $('result').hidden = true; $('retry').hidden = true;
  try {
    const data = await api('/api/scanner/check-in', attempt, 15000);
    lastScan = null;
    result(data.validationOnly ? 'Rehearsal: valid ticket — not checked in' : data.replayed ? 'Confirmed: your previous scan checked this ticket in' : 'Ticket checked in', data.validationOnly ? 'rehearsal' : 'success', data.ticket);
    $('manual').reset();
  } catch (error) {
    if (!error.status || error.status >= 500) {
      lastScan = attempt; $('retry').hidden = false;
      result('Scan outcome unconfirmed. Check the connection, then confirm this scan before admitting anyone.');
    } else { lastScan = null; result(error.message, 'error', error.ticket); }
  } finally {lock(false);}
}
$('manual').onsubmit = event => {event.preventDefault(); const code = new FormData(event.currentTarget).get('code').trim(); void scan(lastScan?.code === code ? lastScan : {code, requestId: crypto.randomUUID()});};
$('retry').onclick = () => {if (lastScan) void scan(lastScan);};
$('camera').onclick = async () => {
  if (controls || !$('video').hidden) {stopCamera(); return;}
  const run = ++cameraRun; $('video').hidden = false; $('camera').textContent = 'Stop camera';
  try {
    const reader = new ZXingBrowser.BrowserQRCodeReader();
    const active = await reader.decodeFromConstraints({video: {facingMode: {ideal: 'environment'}}}, $('video'), (decoded, error, scannerControls) => {
      if (run !== cameraRun || !decoded || busy) return;
      scannerControls.stop();
      const code = decoded.getText(); void scan(lastScan?.code === code ? lastScan : {code, requestId: crypto.randomUUID()});
    });
    if (run !== cameraRun) active.stop(); else controls = active;
  } catch {if (run === cameraRun) {stopCamera(); result('Camera unavailable. Allow camera access or enter the ticket number.');}}
};
window.addEventListener('pagehide', stopCamera);
document.addEventListener('visibilitychange', () => {if (document.hidden) stopCamera();});
async function session() {
  try {
    const data = await api('/api/scanner/session');
    $('identity').textContent = `${data.testing ? 'Testing scanner · test tickets only' : 'Live tickets'} · ${data.label}`;
    $('access').hidden = true; $('scanner').hidden = false; $('management').hidden = !data.admin; $('end-access').hidden = data.admin;
    if (data.admin) await devices();
  } catch (error) {$('identity').textContent = 'Scanner access needed'; $('access').hidden = false; result(error.message);}
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
