# UPFORIT Visuals Studio

A local-only After Effects generator for UPFORIT event screens. It is an independent Next.js package and is not connected to the public website routes, navigation, or deployment.

## Run it

```bash
npm install
npm run dev
```

For the optimized local build, run `npm run build` once and then `npm start`.

Open `http://127.0.0.1:4310`. Both development and production scripts bind only to IPv4 loopback. Requests with a non-loopback Host or Origin are rejected, and every mutation also requires the per-process CSRF token rendered into the control surface.

Before the first render, use **Sync brand assets** and confirm every readiness indicator is green. Artist rendering is blocked unless the installed font reports the exact PostScript name `Panton-BlackCaps`, After Effects is closed, its file/network scripting preference is enabled, and at least 20 GB is free.

The V3 motion system uses a true black stage, spline-driven sweeps, animated 3D camera/depth layers, independently travelling logo instances, and flash-clocked cyan/pink glitch cuts. Artist names use a solid white fill with no stroke or offset shadow and remain visible for most of the loop; the legacy `flash_pulse` value now produces a chromatic glitch event instead of a simple opacity pulse. Every logo layer auto-orients toward the camera and has no rotation animation, keeping the artwork front-facing while XY position, Z depth, scale and camera parallax provide motion. Medium is deliberately recalibrated to the previous High energy.

Global styles are `website` (comic rays and halftones), `neon` (aggressive cyan/magenta/violet glow), and `spline` (layered left-to-right ribbon motion). `brand.logoAssetId: "none"` creates no logo footage or logo layers at all.

Artist jobs may render `center`, `top_third`, or both layouts. Only selected layouts are built into the artist section and added to the AE render queue.

## Verification

```bash
npm test
npm run lint
npm run build
```

Generated jobs, projects, previews, masters, manifests, safety reports, and logs stay under `runtime/`, which is gitignored. Every transcode is probed for codec, profile, dimensions, frame rate, duration, pixel format, frame count, and first/last-frame loop continuity. The source Lossless intermediate is deleted only after those checks succeed.
