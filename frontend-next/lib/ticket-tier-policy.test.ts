import { describe, expect, it } from "vitest";
import { chooseActiveTicketTier, type TicketTierProgress } from "./ticket-tier-policy";

function tiers(earlyBird: number, tierOne: number, activeId = "early"): TicketTierProgress[] {
  return [
    { id: "early", capacity: 50, paidQuantity: earlyBird, active: activeId === "early" },
    { id: "tier-1", capacity: 100, paidQuantity: tierOne, active: activeId === "tier-1" },
    { id: "tier-2", capacity: null, paidQuantity: 0, active: activeId === "tier-2" }
  ];
}

describe("ticket tier progression", () => {
  it("keeps Early Bird on sale through ticket 49", () => {
    expect(chooseActiveTicketTier(tiers(49, 0))).toBe("early");
  });

  it("activates Tier 1 when 50 Early Bird tickets are paid", () => {
    expect(chooseActiveTicketTier(tiers(50, 0))).toBe("tier-1");
  });

  it("keeps Tier 1 active through its first 99 paid tickets", () => {
    expect(chooseActiveTicketTier(tiers(50, 99, "tier-1"))).toBe("tier-1");
  });

  it("activates unlimited Tier 2 after 100 Tier 1 tickets", () => {
    expect(chooseActiveTicketTier(tiers(50, 100, "tier-1"))).toBe("tier-2");
  });

  it("does not regress to a cheaper tier after the sale has advanced", () => {
    expect(chooseActiveTicketTier(tiers(49, 10, "tier-1"))).toBe("tier-1");
  });
});

