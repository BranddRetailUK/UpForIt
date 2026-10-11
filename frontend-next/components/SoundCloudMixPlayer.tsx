"use client";
import { useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
type Track = { title: string; artist: string; permalink: string; waveform: string | null; bars: number[]; stream: string | null; duration: number; playable: boolean };
const clock = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
export default function SoundCloudMixPlayer({ url }: { url: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [error, setError] = useState("");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setTrack(null); setError(""); setTime(0); setPlaying(false);
    fetch(`/api/soundcloud/track?url=${encodeURIComponent(url)}`, { signal: controller.signal }).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); setTrack(data); }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [url]);
  useEffect(() => {
    const element = audio.current;
    if (!track?.stream || !element) return;
    let hls: Hls | undefined;
    let disposed = false;
    if (element.canPlayType("application/vnd.apple.mpegurl")) element.src = track.stream;
    else import("hls.js").then(({ default: Hls }) => {
      if (disposed) return;
      if (!Hls.isSupported()) { setError("This browser cannot play this stream. Listen on SoundCloud instead."); return; }
      hls = new Hls(); hls.loadSource(track.stream!); hls.attachMedia(element);
      hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) setError("Playback is unavailable. Reload to retry or listen on SoundCloud."); });
    });
    const pauseOther = (event: Event) => { if (event.target !== element) element.pause(); };
    document.addEventListener("play", pauseOther, true);
    return () => { disposed = true; hls?.destroy(); element.pause(); element.removeAttribute("src"); element.load(); document.removeEventListener("play", pauseOther, true); };
  }, [track]);
  return <div className="sc-player">
    {track?.playable && <div className="mix-player"><audio ref={audio} preload="none" onTimeUpdate={() => setTime(audio.current?.currentTime || 0)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => setError("Playback unavailable. Listen on SoundCloud instead.")} />
      <button className="mix-play" aria-label={`${playing ? "Pause" : "Play"} SoundCloud mix`} onClick={async () => { if (playing) audio.current?.pause(); else try { await audio.current?.play(); } catch { setError("Could not start playback. Please try again."); } }}>{playing ? "Ⅱ" : "▶"}</button>
      <div className="mix-track">
        {track.bars?.length ? <div className="mix-wave" aria-hidden="true">{track.bars.map((height, index) => <i key={index} style={{ height: `${height}%`, background: index / track.bars.length < time / track.duration ? "var(--yellow)" : undefined }} />)}</div> : track.waveform ? <div className="sc-wave" style={{ maskImage: `url("${track.waveform}")`, WebkitMaskImage: `url("${track.waveform}")` }}><span style={{ width: `${Math.min(100, time / track.duration * 100)}%` }} /></div> : <div className="sc-wave-unavailable">Waveform unavailable</div>}
        <input className="mix-seek" type="range" min={0} max={track.duration || 1} step="0.1" value={time} aria-label="Seek SoundCloud mix" onChange={e => { if (audio.current) { audio.current.currentTime = Number(e.target.value); setTime(Number(e.target.value)); } }} />
        <div className="mix-time"><span>{clock(time)}</span><span>{clock(track.duration)}</span></div>
      </div>
    </div>}
    {!track && !error && <p className="mix-demo-note">Loading SoundCloud mix…</p>}
    {track && !track.playable && <p className="mix-demo-note">This mix is not available for playback here.</p>}
    {error && <p role="status" className="mix-error">{error}</p>}
    <a className="sc-attribution" href={track?.permalink || url} target="_blank" rel="noreferrer">{track ? `${track.artist} · ${track.title} · ` : "Listen on "}SoundCloud</a>
  </div>;
}
