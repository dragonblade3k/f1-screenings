import { describe, it, expect } from "vitest";
import { normalizePriceINR } from "./price";

const MAX_INT32 = 2 ** 31 - 1;

describe("normalizePriceINR", () => {
  it("keeps a plain integer price", () => {
    expect(normalizePriceINR(1500)).toBe(1500);
    expect(normalizePriceINR("1500")).toBe(1500);
  });

  it("keeps a free event free", () => {
    expect(normalizePriceINR(0)).toBe(0);
    expect(normalizePriceINR("0")).toBe(0);
  });

  it("rounds a fraction rather than refusing the row", () => {
    // The old expression passed 499.5 to an Int column, and Prisma rejecting
    // it abandoned every remaining event from that page.
    expect(normalizePriceINR(499.5)).toBe(500);
    expect(normalizePriceINR("499.50")).toBe(500);
    expect(normalizePriceINR(499.4)).toBe(499);
  });

  it("reads the price the way a reviewer types it", () => {
    // parseInt("1,500") was 1, so the public page said a 1500 rupee screening
    // cost one rupee.
    expect(normalizePriceINR("1,500")).toBe(1500);
    expect(normalizePriceINR("12,50,000")).toBe(1250000);
    expect(normalizePriceINR("₹1500")).toBe(1500);
    expect(normalizePriceINR("₹1,500")).toBe(1500);
    expect(normalizePriceINR("Rs 1500")).toBe(1500);
    expect(normalizePriceINR("Rs. 1,500")).toBe(1500);
    expect(normalizePriceINR("1500 INR")).toBe(1500);
    expect(normalizePriceINR("  1500  ")).toBe(1500);
  });

  it("refuses a number buried in prose, which parseInt used to accept", () => {
    expect(normalizePriceINR("1500 people attended")).toBe(0);
    expect(normalizePriceINR("1500-2000")).toBe(0);
    expect(normalizePriceINR("two thousand")).toBe(0);
    expect(normalizePriceINR("TBD")).toBe(0);
    expect(normalizePriceINR("free")).toBe(0);
    expect(normalizePriceINR("")).toBe(0);
  });

  it("refuses a negative price rather than storing one", () => {
    expect(normalizePriceINR(-200)).toBe(0);
    expect(normalizePriceINR("-200")).toBe(0);
  });

  it("refuses a value the Int column cannot hold", () => {
    expect(normalizePriceINR(MAX_INT32)).toBe(MAX_INT32);
    expect(normalizePriceINR(MAX_INT32 + 1)).toBe(0);
    expect(normalizePriceINR(1e12)).toBe(0);
    expect(normalizePriceINR(Infinity)).toBe(0);
    expect(normalizePriceINR(NaN)).toBe(0);
  });

  it("refuses anything that is not a number or a string", () => {
    // Number(true) is 1, which would have published a one rupee ticket.
    expect(normalizePriceINR(true)).toBe(0);
    expect(normalizePriceINR(false)).toBe(0);
    expect(normalizePriceINR(null)).toBe(0);
    expect(normalizePriceINR(undefined)).toBe(0);
    expect(normalizePriceINR([])).toBe(0);
    expect(normalizePriceINR([1500])).toBe(0);
    expect(normalizePriceINR({})).toBe(0);
  });

  it("only ever returns something the column can store", () => {
    const inputs: unknown[] = [
      1500, 499.5, -1, 0, "0x10", "1e3", "₹", "1,50,0.5", "Infinity",
      Infinity, -Infinity, NaN, 2 ** 40, true, null, undefined, [], {}, "",
      " ", "1500 INR", "Rs.1500", "1,500.49", "1,500.50"
    ];
    for (const v of inputs) {
      const n = normalizePriceINR(v);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(MAX_INT32);
    }
  });
});
