const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;

export const ARTIST_LAYOUT_SAFE_AREAS = {
  center: { left: 0.08, right: 0.92, top: 0.35, bottom: 0.65, centerY: 0.5 },
  top_third: { left: 0.08, right: 0.92, top: 0.05, bottom: 0.3, centerY: 0.18 }
} as const;

export function artistSafeArea(width: number, height: number, layout: keyof typeof ARTIST_LAYOUT_SAFE_AREAS) {
  const area = ARTIST_LAYOUT_SAFE_AREAS[layout];
  return {
    left: width * area.left,
    right: width * area.right,
    top: height * area.top,
    bottom: height * area.bottom,
    centerX: width / 2,
    centerY: height * area.centerY
  };
}

export function parseArtistNames(input: string | string[]) {
  const raw = Array.isArray(input) ? input : input.split(/\r?\n/);
  const seen = new Set<string>();
  const names: string[] = [];

  for (const entry of raw) {
    const name = String(entry).replace(CONTROL_CHARACTERS, " ").replace(/\s+/g, " ").trim();
    if (!name) continue;
    if (name.length > 80) throw new Error(`Artist name exceeds 80 characters: ${name.slice(0, 40)}…`);
    const key = name.toLocaleLowerCase("en-GB");
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }

  if (names.length > 100) throw new Error("A batch can contain at most 100 artist names.");
  return names;
}

export function splitArtistName(name: string) {
  const display = name.toLocaleUpperCase("en-GB");
  if (display.length <= 24 || !display.includes(" ")) return [display];

  const words = display.split(" ");
  let bestIndex = 1;
  let smallestDifference = Number.POSITIVE_INFINITY;
  for (let index = 1; index < words.length; index += 1) {
    const left = words.slice(0, index).join(" ").length;
    const right = words.slice(index).join(" ").length;
    const difference = Math.abs(left - right);
    if (difference < smallestDifference) {
      smallestDifference = difference;
      bestIndex = index;
    }
  }
  return [words.slice(0, bestIndex).join(" "), words.slice(bestIndex).join(" ")];
}

export function safeArtistSlug(name: string, fallbackIndex = 1) {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return slug || `ARTIST_${String(fallbackIndex).padStart(2, "0")}`;
}

export function uniqueArtistSlugs(names: string[]) {
  const used = new Map<string, number>();
  return names.map((name, index) => {
    const base = safeArtistSlug(name, index + 1);
    const count = (used.get(base) || 0) + 1;
    used.set(base, count);
    return count === 1 ? base : `${base}_${count}`;
  });
}
