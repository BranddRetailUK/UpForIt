"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type EventOption = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
};

type ScannerDevice = {
  id: string;
  event_id: string;
  event_title: string;
  device_label: string;
  user_agent: string | null;
  expires_at: string;
  last_seen_at: string;
  revoked_at: string | null;
  created_at: string;
  scan_count: string;
};

type Enrolment = {
  eventId: string;
  eventTitle: string;
  enrolmentExpiresAt: string;
  sessionExpiresAt: string;
  relinkDeviceLabel: string | null;
  qrDataUrl: string;
};

function formatDate(value: string, timezone = "Europe/London") {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone
  }).format(new Date(value));
}

function deviceDescription(userAgent: string | null) {
  if (!userAgent) return "Browser details unavailable";
  if (/iPhone/i.test(userAgent)) return "iPhone";
  if (/iPad/i.test(userAgent)) return "iPad";
  if (/Android/i.test(userAgent)) return "Android device";
  return "Web browser";
}

export default function AdminScannerAccess({ events }: { events: EventOption[] }) {
  const enrolmentRef = useRef<HTMLDivElement>(null);
  const [eventId, setEventId] = useState(events[0]?.id || "");
  const [devices, setDevices] = useState<ScannerDevice[]>([]);
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadDevices = useCallback(async () => {
    const response = await fetch("/api/admin/scanner-access", { cache: "no-store" });
    if (!response.ok) return;
    const result = await response.json() as { devices?: ScannerDevice[] };
    setDevices(result.devices || []);
  }, []);

  useEffect(() => {
    void loadDevices();
    const timer = window.setInterval(() => { void loadDevices(); }, 5000);
    return () => window.clearInterval(timer);
  }, [loadDevices]);

  useEffect(() => {
    if (!enrolment) return;
    enrolmentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [enrolment]);

  async function createEnrolment(targetEventId = eventId, relinkSessionId?: string) {
    if (!targetEventId) return;
    setBusy(true);
    setError("");
    const response = await fetch("/api/admin/scanner-access", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId: targetEventId, sessionId: relinkSessionId })
    });
    const result = await response.json() as Enrolment & { error?: string };
    if (response.ok) setEnrolment(result);
    else setError(result.error || "Scanner QR could not be created.");
    setBusy(false);
  }

  async function closeEnrolment() {
    if (!enrolment) return;
    setBusy(true);
    const response = await fetch("/api/admin/scanner-access", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId: enrolment.eventId, action: "close_enrolment" })
    });
    if (response.ok) setEnrolment(null);
    else setError("The enrolment window could not be closed.");
    setBusy(false);
  }

  async function revokeDevice(sessionId: string) {
    const response = await fetch(`/api/admin/scanner-access/${sessionId}`, { method: "DELETE" });
    if (!response.ok) setError("That scanner device could not be revoked.");
    await loadDevices();
  }

  const eventDevices = devices.filter((device) => device.event_id === eventId);
  const now = Date.now();
  const activeDevices = eventDevices.filter((device) => !device.revoked_at && new Date(device.expires_at).getTime() > now);

  return (
    <div className="admin-scanner-access">
      <div className="admin-scanner-access__heading">
        <div>
          <p className="comic-kicker comic-kicker--blue">Door team</p>
          <h2>Scanner access</h2>
        </div>
        <a className="admin-scanner-access__open" href="/scan">Open scanner</a>
      </div>

      {events.length ? (
        <div className="admin-scanner-access__controls">
          <label>
            Event
            <select value={eventId} onChange={(event) => { setEventId(event.target.value); setEnrolment(null); }}>
              {events.map((event) => <option value={event.id} key={event.id}>{event.title}</option>)}
            </select>
          </label>
          <button className="pop-button pop-button--yellow" type="button" disabled={busy} onClick={() => void createEnrolment()}>
            {busy ? "Working…" : "Show enrolment QR"}
          </button>
        </div>
      ) : <p>No current event is available for scanner access.</p>}

      {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}

      {enrolment ? (
        <div className="admin-scanner-enrolment" ref={enrolmentRef}>
          <img src={enrolment.qrDataUrl} width={360} height={360} alt={enrolment.relinkDeviceLabel ? `Scanner relink QR for ${enrolment.relinkDeviceLabel}` : `Scanner enrolment QR for ${enrolment.eventTitle}`} />
          <div>
            <strong>{enrolment.relinkDeviceLabel ? `Relink ${enrolment.relinkDeviceLabel}` : "Ready to scan"}</strong>
            <p>{enrolment.relinkDeviceLabel
              ? `Scan this one-time QR on that device by ${formatDate(enrolment.enrolmentExpiresAt)}. Its existing name and scan history will be preserved.`
              : `This QR accepts new devices until ${formatDate(enrolment.enrolmentExpiresAt)}. Devices already enrolled remain active until ${formatDate(enrolment.sessionExpiresAt)}.`}</p>
            <p>{activeDevices.length} device{activeDevices.length === 1 ? "" : "s"} currently authorised.</p>
            <button className="text-button" type="button" disabled={busy} onClick={closeEnrolment}>{enrolment.relinkDeviceLabel ? "Close relink QR" : "Stop accepting devices"}</button>
          </div>
        </div>
      ) : null}

      <div className="admin-scanner-devices">
        <div className="admin-scanner-devices__heading"><h3>Authorised devices</h3><span>{activeDevices.length} active</span></div>
        {eventDevices.length ? (
          <div className="admin-table-wrap"><table className="admin-table admin-scanner-table"><thead><tr><th className="admin-scanner-col--device">Device</th><th className="admin-scanner-col--status">Status</th><th className="admin-scanner-col--details">Activated</th><th className="admin-scanner-col--details">Last used</th><th className="admin-scanner-col--details">Scans</th><th className="admin-scanner-col--action"><span className="sr-only">Actions</span></th></tr></thead><tbody>
            {eventDevices.map((device) => {
              const expired = new Date(device.expires_at).getTime() <= now;
              const status = device.revoked_at ? "Revoked" : expired ? "Expired" : "Active";
              return <tr key={device.id}>
                <td className="admin-scanner-col--device"><strong>{device.device_label}</strong><small>{deviceDescription(device.user_agent)}</small></td>
                <td className="admin-scanner-col--status"><span className={`admin-status${status === "Active" ? " admin-status--paid" : " admin-status--expired"}`}>{status}</span></td>
                <td className="admin-scanner-col--details">{formatDate(device.created_at)}</td>
                <td className="admin-scanner-col--details">{formatDate(device.last_seen_at)}</td>
                <td className="admin-scanner-col--details">{device.scan_count}</td>
                <td className="admin-scanner-col--action">
                  <div className="admin-scanner-row-actions">
                    <button className="admin-scanner-row-button" type="button" disabled={busy} onClick={() => void createEnrolment(device.event_id, device.id)}>Show scanner QR</button>
                    {status === "Active" ? <button className="admin-scanner-row-button admin-scanner-row-button--danger" type="button" disabled={busy} onClick={() => void revokeDevice(device.id)}>Revoke</button> : null}
                  </div>
                </td>
              </tr>;
            })}
          </tbody></table></div>
        ) : <p>No devices have been enrolled for this event yet.</p>}
      </div>
    </div>
  );
}
