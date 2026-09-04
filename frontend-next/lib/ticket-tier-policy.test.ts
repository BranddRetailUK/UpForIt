import { describe, expect, it } from "vitest";
import { chooseActiveTicketTier, type TicketTierProgress } from "./ticket-tier-policy";

function tiers(paidQuantity: number, active = true): TicketTierProgress[] {
  return [
    { id: "general", capacity: null, paidQuantity, active }
  ];
}

describe("ticket tier progression", () => {
  it("keeps the unlimited General Release tier active", () => {
    expect(chooseActiveTicketTier(tiers(10_000))).toBe("general");
  });

  it("activates the only current tier if no tier was active", () => {
    expect(chooseActiveTicketTier(tiers(0, false))).toBe("general");
  });
});
