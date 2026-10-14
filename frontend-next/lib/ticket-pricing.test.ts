import { describe, expect, it } from "vitest";
import { ticketPrice, ticketPriceLines } from "./ticket-pricing";

describe("NYE admissions and group pricing", () => {
  it.each([[0,0,0],[1,1000,0],[2,2000,0],[3,3000,0],[4,3000,1],[5,4000,1],[6,5000,1],[7,6000,1],[8,6000,2],[9,7000,2],[10,8000,2],[12,9000,3]])(
    "%i admissions cost %i with %i free", (quantity, totalMinor, freeQuantity) => {
      const price = ticketPrice("nye-2026", 1000, quantity);
      expect(price.totalMinor).toBe(totalMinor);
      expect(price.freeQuantity).toBe(freeQuantity);
      const lines = ticketPriceLines("nye-2026", "General admission", 1000, quantity);
      expect(lines.reduce((sum, line) => sum + line.quantity, 0)).toBe(quantity);
      expect(lines.reduce((sum, line) => sum + line.quantity * line.unitPriceMinor, 0)).toBe(totalMinor);
    }
  );
  it("does not discount another event", () => expect(ticketPrice("summer-roundup-2026", 500, 4).totalMinor).toBe(2000));
  it("rejects a stale NYE price", () => expect(() => ticketPrice("nye-2026", 500, 4)).toThrow("£10"));
  it.each([-1, 1.5, NaN, Infinity])("rejects invalid quantity %s", quantity => expect(() => ticketPrice("nye-2026", 1000, quantity)).toThrow());
});
