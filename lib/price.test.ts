import { describe, it, expect } from "vitest";
import { normalizePriceINR } from "./price";

const MAX_INT32 = 2 ** 31 - 1;

describe("normalizePriceINR", () => {
  it("keeps a plain integer price", () => {
    expect(normalizePriceINR(1500)).toBe(1500);
    expect(normalizePriceINR("1500")).toBe(1500);
  });

  it("keeps a free event free, and distinct from unknown", () => {
    // 0 and null are different answers now: free versus unreadable.
    expect(normalizePriceINR(0)).toBe(0);
    expect(normalizePriceINR("0")).toBe(0);
    expect(normalizePriceINR("")).toBeNull();
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
    expect(normalizePriceINR("1500 people attended")).toBeNull();
    expect(normalizePriceINR("1500-2000")).toBeNull();
    expect(normalizePriceINR("two thousand")).toBeNull();
    expect(normalizePriceINR("TBD")).toBeNull();
    expect(normalizePriceINR("free")).toBeNull();
  });

  it("refuses a negative price rather than storing one", () => {
    expect(normalizePriceINR(-200)).toBeNull();
    expect(normalizePriceINR("-200")).toBeNull();
  });

  it("refuses a value the Int column cannot hold", () => {
    expect(normalizePriceINR(MAX_INT32)).toBe(MAX_INT32);
    expect(normalizePriceINR(MAX_INT32 + 1)).toBeNull();
    expect(normalizePriceINR(1e12)).toBeNull();
    expect(normalizePriceINR(Infinity)).toBeNull();
    expect(normalizePriceINR(NaN)).toBeNull();
  });

  it("refuses anything that is not a number or a string", () => {
    // Number(true) is 1, which would have published a one rupee ticket.
    expect(normalizePriceINR(true)).toBeNull();
    expect(normalizePriceINR(false)).toBeNull();
    expect(normalizePriceINR(null)).toBeNull();
    expect(normalizePriceINR(undefined)).toBeNull();
    expect(normalizePriceINR([])).toBeNull();
    expect(normalizePriceINR([1500])).toBeNull();
    expect(normalizePriceINR({})).toBeNull();
  });

  it("never reports an unreadable price as free", () => {
    // The whole point of the null: 0 is a claim, and these are not it.
    for (const v of ["TBD", "", "  ", "abc", -1, NaN, true, {}, [], null]) {
      expect(normalizePriceINR(v)).not.toBe(0);
    }
  });

  it("only ever returns null or something the column can store", () => {
    const inputs: unknown[] = [
      1500, 499.5, -1, 0, "0x10", "1e3", "₹", "1,50,0.5", "Infinity",
      Infinity, -Infinity, NaN, 2 ** 40, true, null, undefined, [], {}, "",
      " ", "1500 INR", "Rs.1500", "1,500.49", "1,500.50"
    ];
    for (const v of inputs) {
      const n = normalizePriceINR(v);
      if (n === null) continue;
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(MAX_INT32);
    }
  });
});
