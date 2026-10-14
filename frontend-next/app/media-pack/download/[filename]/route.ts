import manifest from "../../assets.json";

// Only serve the approved pack: callers cannot supply an arbitrary upstream URL.
export async function GET(_request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  const file = manifest.files.find((asset) => asset.downloadName === filename);
  const url = filename === "UPFORIT-Media-Pack.zip" ? manifest.zipUrl : file?.url;
  if (!url) return new Response("Asset not found", { status: 404 });

  try {
    const upstream = await fetch(url, { cache: "no-store" });
    if (!upstream.ok || !upstream.body) {
      return new Response("Download temporarily unavailable. Please try again.", { status: 502 });
    }
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow"
      }
    });
  } catch {
    return new Response("Download temporarily unavailable. Please try again.", { status: 502 });
  }
}
