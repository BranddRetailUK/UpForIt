"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ArtistLayout,
  FlashLevel,
  JobArtifact,
  StoredJob,
  TextAnimation,
  VisualJobV1,
  VisualStylePreset
} from "@/lib/contracts";

const logoUrls = {
  roundLogo: "https://res.cloudinary.com/brandduk/image/upload/NEW_ROUND_LOGO_amtvr0.png",
  navLogo: "https://res.cloudinary.com/brandduk/image/upload/WHITE_LOGO_WEB_filqtw.png",
  smiley: "https://res.cloudinary.com/brandduk/image/upload/SOLID_SMILEY_taznwv.png"
} as const;

const intensityLabels = ["", "Ambient", "Low", "Medium", "High", "Peak"];
const stylePresets: Array<{ id: VisualStylePreset; label: string; description: string }> = [
  { id: "website", label: "Website Pop", description: "Deforming LED surfaces, dimensional halftones and sculptural brand-colour panels." },
  { id: "neon", label: "Neon Attack", description: "Fast peripheral shard tunnel, protected centre and harder chromatic glitches." },
  { id: "spline", label: "Spline Flow", description: "Thick organic light ribbons sweeping through depth and past the camera." }
];
const runningStatuses = new Set(["building", "rendering_preview", "batch_building", "batch_rendering", "rendering_master"]);
type ArtistOutputMode = ArtistLayout | "both";

function parseLineup(text: string) {
  const seen = new Set<string>();
  return text
    .split(/\r?\n/)
    .map((name) => name.replace(/\s+/g, " ").trim())
    .filter((name) => {
      if (!name) return false;
      const key = name.toLocaleLowerCase("en-GB");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function previewForLayout(job: StoredJob | undefined, layout: "center" | "top_third") {
  return job?.artifacts.find((artifact) => artifact.kind === "preview" && artifact.layout === layout);
}

export default function StudioApp({ csrfToken }: { csrfToken: string }) {
  const [mode, setMode] = useState<"logo_loop" | "artist_batch">("artist_batch");
  const [name, setName] = useState("UPFORIT Visual Pack");
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [fps, setFps] = useState<25 | 50>(50);
  const [durationSeconds, setDurationSeconds] = useState<10 | 20 | 30>(20);
  const [logoAssetId, setLogoAssetId] = useState<VisualJobV1["brand"]["logoAssetId"]>("roundLogo");
  const [stylePreset, setStylePreset] = useState<VisualStylePreset>("website");
  const [intensity, setIntensity] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [cameraStrength, setCameraStrength] = useState(76);
  const [depthSpeed, setDepthSpeed] = useState(84);
  const [logoScale, setLogoScale] = useState(60);
  const [lightSweepAmount, setLightSweepAmount] = useState(80);
  const [particleAmount, setParticleAmount] = useState(52);
  const [glitchAmount, setGlitchAmount] = useState(56);
  const [logoCopies, setLogoCopies] = useState(3);
  const [flashLevel, setFlashLevel] = useState<FlashLevel>("medium");
  const [textAnimation, setTextAnimation] = useState<TextAnimation>("flash_pulse");
  const [artistOutputMode, setArtistOutputMode] = useState<ArtistOutputMode>("both");
  const [previewArtist, setPreviewArtist] = useState("SCOTT CHARLES");
  const [lineupInput, setLineupInput] = useState("");
  const [artists, setArtists] = useState<string[]>([]);
  const [activeLayout, setActiveLayout] = useState<"center" | "top_third">("center");
  const [jobs, setJobs] = useState<StoredJob[]>([]);
  const [jobLog, setJobLog] = useState("");
  const [activeJobId, setActiveJobId] = useState<string>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const jobLogRef = useRef<HTMLPreElement>(null);

  const activeJob = jobs.find((job) => job.id === activeJobId);
  const allArtists = useMemo(() => {
    const seen = new Set<string>();
    return [previewArtist, ...artists].filter((artist) => {
      const clean = artist.trim();
      if (!clean) return false;
      const key = clean.toLocaleLowerCase("en-GB");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [previewArtist, artists]);

  const request = useCallback(async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "x-upforit-csrf": csrfToken,
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
    return data;
  }, [csrfToken]);

  const refreshJobs = useCallback(async () => {
    const response = await fetch("/api/jobs", { cache: "no-store" });
    if (response.ok) setJobs((await response.json()).jobs);
  }, []);

  useEffect(() => {
    void refreshJobs();
    const interval = window.setInterval(() => void refreshJobs(), 5_000);
    return () => window.clearInterval(interval);
  }, [refreshJobs]);

  useEffect(() => {
    if (!activeJobId) return;
    const events = new EventSource(`/api/jobs/${activeJobId}/events`);
    events.onmessage = () => {
      void refreshJobs();
    };
    return () => events.close();
  }, [activeJobId, refreshJobs]);

  useEffect(() => {
    if (!activeJobId) {
      setJobLog("");
      return;
    }
    let cancelled = false;
    const refreshLog = async () => {
      const response = await fetch(`/api/jobs/${activeJobId}/logs`, { cache: "no-store" });
      if (response.ok && !cancelled) setJobLog((await response.json()).text || "");
    };
    void refreshLog();
    const interval = window.setInterval(() => void refreshLog(), 3_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeJobId]);

  useEffect(() => {
    if (!jobLogRef.current) return;
    jobLogRef.current.scrollTop = jobLogRef.current.scrollHeight;
  }, [jobLog]);

  const draftJob = useCallback((id = crypto.randomUUID()): VisualJobV1 => ({
    schemaVersion: 1,
    id,
    name: name.trim() || "UPFORIT Visual Pack",
    canvas: { width, height, fps, durationSeconds },
    brand: { logoAssetId, palette: "core" },
    content: mode === "logo_loop"
      ? { kind: "logo_loop" }
      : {
          kind: "artist_batch",
          names: allArtists,
          layouts: artistOutputMode === "both" ? ["center", "top_third"] : [artistOutputMode],
          textAnimation,
          uppercase: true
        },
    motion: {
      preset: "pop-depth-loop",
      stylePreset,
      intensity,
      cameraStrength,
      depthSpeed,
      logoScale,
      lightSweepAmount,
      particleAmount,
      glitchAmount,
      logoCopies,
      flashLevel,
      seamlessLoop: true
    },
    render: { preview: "h264-960x540", master: "prores-422-hq" }
  }), [
    allArtists, artistOutputMode, cameraStrength, depthSpeed, durationSeconds, flashLevel, fps, glitchAmount, height,
    intensity, lightSweepAmount, logoAssetId, logoCopies, logoScale, mode, name, particleAmount,
    stylePreset, textAnimation, width
  ]);

  function applyStylePreset(preset: VisualStylePreset) {
    setStylePreset(preset);
    if (preset === "website") {
      setIntensity(3);
      setCameraStrength(76);
      setDepthSpeed(84);
      setLightSweepAmount(68);
      setParticleAmount(52);
      setGlitchAmount(56);
      setLogoCopies(3);
      setFlashLevel("medium");
    } else if (preset === "neon") {
      setIntensity(4);
      setCameraStrength(92);
      setDepthSpeed(96);
      setLightSweepAmount(92);
      setParticleAmount(84);
      setGlitchAmount(84);
      setLogoCopies(3);
      setFlashLevel("high");
    } else {
      setIntensity(4);
      setCameraStrength(84);
      setDepthSpeed(90);
      setLightSweepAmount(100);
      setParticleAmount(56);
      setGlitchAmount(66);
      setLogoCopies(2);
      setFlashLevel("medium");
    }
  }

  function changeArtistOutput(mode: ArtistOutputMode) {
    setArtistOutputMode(mode);
    if (mode !== "both") setActiveLayout(mode);
  }

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unexpected Visuals Studio error.");
    } finally {
      setBusy(false);
    }
  }

  async function createAndPreview() {
    await runAction(async () => {
      if (mode === "artist_batch" && !allArtists.length) throw new Error("Add at least one artist name.");
      const draft = draftJob();
      const { id: _id, ...input } = draft;
      const created = await request("/api/jobs", { method: "POST", body: JSON.stringify(input) });
      setActiveJobId(created.job.id);
      await request(`/api/jobs/${created.job.id}/preview`, { method: "POST", body: "{}" });
      await refreshJobs();
    });
  }

  async function jobAction(endpoint: "batch" | "master") {
    if (!activeJob) return;
    await runAction(async () => {
      await request(`/api/jobs/${activeJob.id}/${endpoint}`, { method: "POST", body: "{}" });
      await refreshJobs();
    });
  }

  async function retryFailedArtists() {
    if (!activeJob?.failedArtists.length) return;
    await runAction(async () => {
      const draft = draftJob();
      if (draft.content.kind !== "artist_batch") throw new Error("Switch to Artist names before retrying failed names.");
      const { id: _id, ...input } = {
        ...draft,
        name: `${activeJob.name} — Retry`,
        content: { ...draft.content, names: activeJob.failedArtists.map((failure) => failure.name) }
      };
      const created = await request("/api/jobs", { method: "POST", body: JSON.stringify(input) });
      setActiveJobId(created.job.id);
      await request(`/api/jobs/${created.job.id}/preview`, { method: "POST", body: "{}" });
      await refreshJobs();
    });
  }

  async function openTarget(target: "project" | "folder") {
    if (!activeJob) return;
    await runAction(async () => {
      await request(`/api/jobs/${activeJob.id}/open`, { method: "POST", body: JSON.stringify({ target }) });
    });
  }

  function applyLineup() {
    const parsed = parseLineup(lineupInput);
    if (!parsed.length) {
      setError("Paste at least one artist name, one per line.");
      return;
    }
    setPreviewArtist(parsed[0]);
    setArtists(parsed.slice(1));
    setError("");
  }

  async function deleteHistoryJob(job: StoredJob) {
    if (runningStatuses.has(job.status)) return;
    if (!window.confirm(`Delete “${job.name}” and all of its generated files?`)) return;
    await runAction(async () => {
      await request(`/api/jobs/${job.id}`, { method: "DELETE" });
      setJobs((current) => current.filter((candidate) => candidate.id !== job.id));
      if (activeJobId === job.id) {
        setActiveJobId(undefined);
        setJobLog("");
      }
    });
  }

  function moveArtist(index: number, direction: -1 | 1) {
    const names = [...allArtists];
    const target = index + direction;
    if (target < 0 || target >= names.length) return;
    [names[index], names[target]] = [names[target], names[index]];
    setPreviewArtist(names[0] || "");
    setArtists(names.slice(1));
  }

  function removeArtist(index: number) {
    const names = allArtists.filter((_, itemIndex) => itemIndex !== index);
    setPreviewArtist(names[0] || "");
    setArtists(names.slice(1));
  }

  const activePreview = activeLayout === "center"
    ? previewForLayout(activeJob, "center")
    : previewForLayout(activeJob, "top_third");
  const availableLayouts: ArtistLayout[] = activeJob?.content.kind === "artist_batch"
    ? activeJob.content.layouts
    : artistOutputMode === "both" ? ["center", "top_third"] : [artistOutputMode];
  const selectedPreview = activePreview || previewForLayout(activeJob, availableLayouts[0]);
  const logoPreview = activeJob?.artifacts.find((artifact) => artifact.kind === "preview" && !artifact.layout);
  const displayedPreview = mode === "logo_loop" ? logoPreview : selectedPreview;
  const isRunning = activeJob ? runningStatuses.has(activeJob.status) : false;

  return (
    <main className="studio-shell">
      <header className="studio-hero">
        <div>
          <span className="eyebrow">LOCAL MOTION CONTROL</span>
          <h1>UPFORIT<br /><em>Visuals Studio</em></h1>
          <p>Editable After Effects event loops. Nothing here is published to the website.</p>
        </div>
        <div className="hero-smiley" aria-hidden="true">☺</div>
      </header>

      {error ? <div className="notice notice--error">{error}</div> : null}

      <div className="studio-grid">
        <section className="control-panel pop-panel">
          <div className="mode-tabs" role="tablist">
            <button className={mode === "logo_loop" ? "active" : ""} onClick={() => setMode("logo_loop")}>Logo loop</button>
            <button className={mode === "artist_batch" ? "active" : ""} onClick={() => setMode("artist_batch")}>Artist names</button>
          </div>

          <fieldset>
            <legend>01 / Canvas</legend>
            <label>Job name<input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} /></label>
            <div className="field-row field-row--three">
              <label>Width<input type="number" min={320} max={7680} value={width} onChange={(event) => setWidth(Number(event.target.value))} /></label>
              <label>Height<input type="number" min={180} max={4320} value={height} onChange={(event) => setHeight(Number(event.target.value))} /></label>
              <label>FPS<select value={fps} onChange={(event) => setFps(Number(event.target.value) as 25 | 50)}><option value={25}>25</option><option value={50}>50</option></select></label>
            </div>
            <label>Duration<select value={durationSeconds} onChange={(event) => setDurationSeconds(Number(event.target.value) as 10 | 20 | 30)}><option value={10}>10 seconds</option><option value={20}>20 seconds</option><option value={30}>30 seconds</option></select></label>
          </fieldset>

          <fieldset>
            <legend>02 / Global style</legend>
            <div className="style-picker">
              {stylePresets.map((preset) => (
                <button key={preset.id} type="button" className={stylePreset === preset.id ? "selected" : ""} onClick={() => applyStylePreset(preset.id)}>
                  <strong>{preset.label}</strong><span>{preset.description}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>03 / Brand mark</legend>
            <div className="logo-picker">
              <button type="button" className={logoAssetId === "none" ? "selected" : ""} onClick={() => setLogoAssetId("none")}>
                <span className="no-logo-mark" aria-hidden="true">NO<br />LOGO</span><span>None</span>
              </button>
              {(Object.keys(logoUrls) as Array<keyof typeof logoUrls>).map((id) => (
                <button key={id} type="button" className={logoAssetId === id ? "selected" : ""} onClick={() => setLogoAssetId(id)}>
                  <img src={logoUrls[id]} alt="" /><span>{id === "roundLogo" ? "Round" : id === "navLogo" ? "Horizontal" : "Smiley"}</span>
                </button>
              ))}
            </div>
            {logoAssetId === "none" ? <small>No logo source, background logo cards, hero marks or footer bugs will be generated.</small> : null}
          </fieldset>

          {mode === "artist_batch" ? (
            <fieldset>
              <legend>04 / Artist names</legend>
              <label>Preview artist<input maxLength={80} value={previewArtist} onChange={(event) => setPreviewArtist(event.target.value)} /></label>
              <label>Paste lineup<textarea rows={6} value={lineupInput} placeholder={'SCOTT CHARLES\nSPEKTRAL\nARTIST THREE'} onChange={(event) => setLineupInput(event.target.value)} /></label>
              <button className="secondary-button" type="button" onClick={applyLineup}>Load lineup</button>
              {allArtists.length ? (
                <ol className="artist-list">
                  {allArtists.map((artist, index) => (
                    <li key={`${artist}-${index}`}><strong>{artist}</strong><span>
                      <button disabled={index === 0} onClick={() => moveArtist(index, -1)} aria-label={`Move ${artist} up`}>↑</button>
                      <button disabled={index === allArtists.length - 1} onClick={() => moveArtist(index, 1)} aria-label={`Move ${artist} down`}>↓</button>
                      <button onClick={() => removeArtist(index)} aria-label={`Remove ${artist}`}>×</button>
                    </span></li>
                  ))}
                </ol>
              ) : null}
              <label>Text animation<select value={textAnimation} onChange={(event) => setTextAnimation(event.target.value as TextAnimation)}><option value="steady_glow">Steady glow</option><option value="flash_pulse">Glitch flash — default</option><option value="punch_flash">Punch glitch</option></select></label>
              <label>Artist outputs<select value={artistOutputMode} onChange={(event) => changeArtistOutput(event.target.value as ArtistOutputMode)}><option value="both">Centre + Top Third</option><option value="center">Centre only</option><option value="top_third">Top Third only</option></select></label>
            </fieldset>
          ) : null}

          <fieldset>
            <legend>{mode === "artist_batch" ? "05" : "04"} / Motion</legend>
            <label className="range-label"><span>Intensity <b>{intensityLabels[intensity]}</b></span><input type="range" min={1} max={5} value={intensity} onChange={(event) => setIntensity(Number(event.target.value) as 1 | 2 | 3 | 4 | 5)} /></label>
            <small>Recalibrated: Medium now carries the previous High energy.</small>
            <Range label="Camera strength" value={cameraStrength} onChange={setCameraStrength} />
            <Range label="Depth speed" value={depthSpeed} onChange={setDepthSpeed} />
            {logoAssetId !== "none" ? <Range label="Logo scale" value={logoScale} min={25} max={80} onChange={setLogoScale} /> : null}
            <Range label="Spline sweeps" value={lightSweepAmount} onChange={setLightSweepAmount} />
            <Range label="Particles" value={particleAmount} onChange={setParticleAmount} />
            <Range label="Glitch amount" value={glitchAmount} onChange={setGlitchAmount} />
            {logoAssetId !== "none" ? <Range label="Logo instances" value={logoCopies} min={1} max={6} onChange={setLogoCopies} /> : null}
            <label>Glitch events<select value={flashLevel} onChange={(event) => setFlashLevel(event.target.value as FlashLevel)}><option value="off">Off</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High — still safety capped</option></select></label>
          </fieldset>

          <button className="primary-button" disabled={busy || isRunning} onClick={() => void createAndPreview()}>{busy ? "WORKING…" : "GENERATE PREVIEW"}</button>
        </section>

        <section className="preview-panel pop-panel">
          <header>
            <div><span className="eyebrow eyebrow--yellow">REVIEW OUTPUT</span><h2>{activeJob?.name || "No active job"}</h2></div>
            {activeJob ? <span className={`status-badge status-badge--${activeJob.status}`}>{activeJob.status.replaceAll("_", " ")}</span> : null}
          </header>

          {mode === "artist_batch" ? (
            <div className="layout-tabs">
              {availableLayouts.map((layout) => (
                <button key={layout} className={(activePreview ? activeLayout : availableLayouts[0]) === layout ? "active" : ""} onClick={() => setActiveLayout(layout)}>{layout === "center" ? "Centre screen" : "Top third"}</button>
              ))}
            </div>
          ) : null}

          <div className="video-stage">
            {displayedPreview?.url ? (
              <video key={displayedPreview.url} controls loop autoPlay muted poster={posterFor(activeJob, displayedPreview)} src={displayedPreview.url} />
            ) : (
              <div className="video-placeholder"><div className="placeholder-logo">UP<br />FOR<br />IT</div><p>Your generated loop will play here.</p></div>
            )}
          </div>

          {activeJob ? (
            <>
              <div className="progress-block"><div><span style={{ width: `${activeJob.progress}%` }} /></div><p>{activeJob.statusMessage}</p></div>
              {activeJob.error ? <div className="notice notice--error">{activeJob.error}</div> : null}
              {activeJob.failedArtists.length ? (
                <div className="failed-artists">
                  <strong>Needs retry</strong>
                  <ul>{activeJob.failedArtists.map((failure) => <li key={failure.name}><b>{failure.name}</b><span>{failure.error}</span></li>)}</ul>
                  <button disabled={busy || isRunning} onClick={() => void retryFailedArtists()}>Preview failed names with current controls</button>
                </div>
              ) : null}
              <div className="action-grid">
                {activeJob.content.kind === "artist_batch" ? <button disabled={busy || isRunning} onClick={() => void jobAction("batch")}>Build editable batch</button> : null}
                <button disabled={busy || isRunning || !activeJob.artifacts.some((artifact) => artifact.kind === "project")} onClick={() => void jobAction("master")}>Render ProRes master{activeJob.content.kind === "artist_batch" ? "s" : ""}</button>
                <button disabled={busy || !activeJob.artifacts.some((artifact) => artifact.kind === "project")} onClick={() => void openTarget("project")}>Open in After Effects</button>
                <button disabled={busy} onClick={() => void openTarget("folder")}>Reveal in Finder</button>
              </div>
              <ArtifactList artifacts={activeJob.artifacts} />
              <details className="job-log" open={isRunning}>
                <summary>Render log</summary>
                <pre ref={jobLogRef}>{jobLog || "Waiting for the first render log entry…"}</pre>
              </details>
            </>
          ) : null}
        </section>

        <aside className="history-panel pop-panel">
          <span className="eyebrow eyebrow--pink">LOCAL JOBS</span>
          <h2>History</h2>
          <div className="history-list">
            {jobs.length ? jobs.map((job) => (
              <article key={job.id} className={`history-card ${job.id === activeJobId ? "active" : ""}`}>
                <button className="history-card__select" onClick={() => {
                  setActiveJobId(job.id);
                  setMode(job.content.kind);
                }}>
                  <strong>{job.name}</strong>
                  <span>{job.content.kind === "artist_batch" ? `${job.content.names.length} artist${job.content.names.length === 1 ? "" : "s"}` : "Logo loop"}</span>
                  <small>{new Date(job.createdAt).toLocaleString("en-GB")}</small>
                  <i>{job.status.replaceAll("_", " ")}</i>
                </button>
                <button
                  type="button"
                  className="history-card__delete"
                  disabled={busy || runningStatuses.has(job.status)}
                  onClick={() => void deleteHistoryJob(job)}
                  aria-label={`Delete ${job.name}`}
                >Delete</button>
              </article>
            )) : <p>No jobs yet. Your renders stay on this Mac.</p>}
          </div>
        </aside>
      </div>
    </main>
  );
}

function Range({ label, value, min = 0, max = 100, onChange }: { label: string; value: number; min?: number; max?: number; onChange: (value: number) => void }) {
  return <label className="range-label"><span>{label}<b>{value}</b></span><input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function posterFor(job: StoredJob | undefined, preview: JobArtifact) {
  return job?.artifacts.find((artifact) => artifact.kind === "poster" && artifact.artist === preview.artist && artifact.layout === preview.layout)?.url;
}

function ArtifactList({ artifacts }: { artifacts: JobArtifact[] }) {
  const downloadable = artifacts.filter((artifact) => ["preview", "master", "safety_report"].includes(artifact.kind));
  if (!downloadable.length) return null;
  return <div className="artifact-list"><h3>Files</h3>{downloadable.map((artifact) => (
    <a key={`${artifact.kind}-${artifact.path}`} href={artifact.url} download>{artifact.label}<span>{artifact.kind.replace("_", " ")} ↗</span></a>
  ))}</div>;
}
