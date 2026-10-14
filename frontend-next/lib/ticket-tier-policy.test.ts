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

  it("keeps deliberately inactive tiers closed", () => {
    expect(chooseActiveTicketTier(tiers(0, false))).toBeNull();
  });
});
