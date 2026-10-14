import { afterEach, describe, expect, it, vi } from "vitest";
import { publicTicketSalesOpen } from "./event-visibility";
import { assertTicketingEnabled } from "./stripe";

afterEach(() => vi.unstubAllEnvs());
describe("public ticket sales visibility", () => {
  it("keeps sales closed by default even with payment infrastructure enabled", () => {
    vi.stubEnv("PUBLIC_TICKET_SALES_OPEN", "");
    vi.stubEnv("TICKETING_ENABLED", "true");
    expect(publicTicketSalesOpen()).toBe(false);
    expect(() => assertTicketingEnabled()).toThrow("TICKETING_DISABLED");
  });
  it("keeps production locked even when both switches are enabled", () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("PUBLIC_TICKET_SALES_OPEN", "true");
    vi.stubEnv("TICKETING_ENABLED", "true");
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
