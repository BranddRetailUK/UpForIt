import { afterEach, describe, expect, it, vi } from "vitest";
import { publicTicketSalesOpen } from "./event-visibility";
import { assertTicketingEnabled } from "./stripe";
import { TICKET_LAUNCH_AT } from "./ticket-launch-countdown";

afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
describe("public ticket sales visibility", () => {
  it("keeps sales closed by default even with payment infrastructure enabled", () => {
    vi.stubEnv("PUBLIC_TICKET_SALES_OPEN", "");
    vi.stubEnv("TICKETING_ENABLED", "true");
    expect(publicTicketSalesOpen()).toBe(false);
    expect(() => assertTicketingEnabled()).toThrow("TICKETING_DISABLED");
  });
  it("keeps production locked until the exact countdown deadline", () => {
    vi.useFakeTimers();
    vi.setSystemTime(TICKET_LAUNCH_AT-1);
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("PUBLIC_TICKET_SALES_OPEN", "true");
    vi.stubEnv("TICKETING_ENABLED", "true");
    expect(() => assertTicketingEnabled()).toThrow("TICKETING_DISABLED");
    expect(publicTicketSalesOpen()).toBe(false);
    vi.setSystemTime(TICKET_LAUNCH_AT);
    expect(publicTicketSalesOpen()).toBe(true);
    expect(() => assertTicketingEnabled()).not.toThrow();
    vi.setSystemTime(TICKET_LAUNCH_AT+86400000);
    expect(publicTicketSalesOpen()).toBe(true);
    vi.stubEnv("PUBLIC_TICKET_SALES_OPEN", "false");
    expect(publicTicketSalesOpen()).toBe(false);
    expect(() => assertTicketingEnabled()).toThrow("TICKETING_DISABLED");
  });
  it("requires both public launch and ticketing switches before purchases", () => {
    vi.stubEnv("PUBLIC_TICKET_SALES_OPEN", "true");
    vi.stubEnv("APP_ENV", "testing");
    vi.stubEnv("TICKETING_ENABLED", "false");
    expect(() => assertTicketingEnabled()).toThrow("TICKETING_DISABLED");
    vi.stubEnv("TICKETING_ENABLED", "true");
    expect(() => assertTicketingEnabled()).not.toThrow();
  });
});
