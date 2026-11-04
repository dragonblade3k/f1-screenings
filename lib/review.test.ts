import { describe, it, expect } from "vitest";
import { APPROVABLE_STATUSES, approvalRefusal } from "./review";

// These pin a decision rather than a computation. The approve routes send this
// list straight to the database as the status condition on their write, so
// widening it is how the bug it closed would come back: an approve matching a
// REJECTED row publishes a screening a human refused and overwrites the refusal.
describe("APPROVABLE_STATUSES", () => {
  it("excludes a rejected candidate", () => {
    expect(APPROVABLE_STATUSES).not.toContain("REJECTED");
  });

  it("includes a candidate still in the queue", () => {
    expect(APPROVABLE_STATUSES).toContain("PENDING");
  });

  // Not an oversight: a published candidate is re-approved to correct the Event
  // it produced, which is the only route to a typo on a live listing.
  it("includes an already verified candidate, so a correction can still land", () => {
    expect(APPROVABLE_STATUSES).toContain("VERIFIED");
  });
});

describe("approvalRefusal", () => {
  it("names the status the row is in now", () => {
    expect(approvalRefusal("REJECTED")).toBe("Candidate is REJECTED and cannot be approved");
  });
});
