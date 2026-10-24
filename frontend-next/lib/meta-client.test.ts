import { afterEach, beforeEach, expect, it, vi } from "vitest";

let cookies: Map<string, string>;
let writes: string[];
let currentLocation: URL;
beforeEach(() => {
  vi.resetModules();
  cookies = new Map(); writes = [];
  currentLocation = new URL("https://www.upforitevents.co.uk/events/nye-2026?fbclid=real_click-123");
  vi.stubGlobal("window", { get location() { return currentLocation; } });
  vi.stubGlobal("document", {
    get cookie() { return [...cookies].map(([k, v]) => `${k}=${v}`).join("; "); },
    set cookie(value: string) {
      writes.push(value);
      const pair = value.split(";")[0]; const split = pair.indexOf("=");
      if (value.includes("Max-Age=0")) cookies.delete(pair.slice(0, split));
      else cookies.set(pair.slice(0, split), pair.slice(split + 1));
    }
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("keeps an ad click through client navigation but writes only after consent", async () => {
  const { rememberMetaClick, getMetaBrowserContext } = await import("./meta-client");
  vi.spyOn(Date, "now").mockReturnValue(1792860000000);
  rememberMetaClick();
  expect(writes).toEqual([]);
  expect(getMetaBrowserContext("checkout_1")).toEqual({ eventId: "checkout_1" });
  currentLocation = new URL("https://www.upforitevents.co.uk/account/login");
  cookies.set("upforit_meta_consent", "granted");
  expect(getMetaBrowserContext("checkout_1")).toEqual({ eventId: "checkout_1", fbc: "fb.1.1792860000000.real_click-123" });
  expect(writes[0]).toContain("Max-Age=7776000; SameSite=Lax; Secure");
});

it("preserves the original timestamp for an existing click and replaces it for a new click", async () => {
  const { rememberMetaClick } = await import("./meta-client");
  cookies.set("upforit_meta_consent", "granted");
  cookies.set("_fbc", "fb.1.1792800000000.real_click-123");
  rememberMetaClick(); expect(writes).toEqual([]);
  currentLocation.search = "?fbclid=new_click";
  rememberMetaClick(); expect(cookies.get("_fbc")).toMatch(/^fb\.1\.\d+\.new_click$/);
});

it("never invents a click ID for organic visits or malformed URLs", async () => {
  const { rememberMetaClick } = await import("./meta-client");
  cookies.set("upforit_meta_consent", "granted");
  currentLocation.search = ""; rememberMetaClick();
  currentLocation.search = "?fbclid=%3Cscript%3E"; rememberMetaClick();
  expect(writes).toEqual([]);
});

it("clears host and parent-domain identifiers and does not expose them after withdrawal", async () => {
  const { rememberMetaClick, deleteMetaAttributionCookies, getMetaBrowserContext } = await import("./meta-client");
  cookies.set("upforit_meta_consent", "granted"); rememberMetaClick();
  cookies.set("_fbp", "fb.1.1792800000000.1234");
  cookies.set("upforit_meta_consent", "denied"); deleteMetaAttributionCookies();
  expect(writes.some(w => w.includes("Domain=upforitevents.co.uk; Max-Age=0"))).toBe(true);
  expect(getMetaBrowserContext("checkout_2")).toEqual({ eventId: "checkout_2" });
  rememberMetaClick(); expect(cookies.has("_fbc")).toBe(false);
});

it("ignores malformed percent encoding without breaking checkout", async () => {
  const { readCookie } = await import("./meta-client");
  cookies.set("_fbc", "%broken"); expect(readCookie("_fbc")).toBe("");
});
