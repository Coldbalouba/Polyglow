import { describe, expect, it } from "vitest";
import { rateLimit, resetRateLimit } from "./rate-limit";

describe("rateLimit", () => {
  it("blocks after the limit and resets after the window", () => {
    const t = 1_000_000;
    for (let i = 0; i < 5; i++) expect(rateLimit("k", 5, 60_000, t).ok).toBe(true);
    const blocked = rateLimit("k", 5, 60_000, t + 1000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBe(59);
    expect(rateLimit("k", 5, 60_000, t + 60_001).ok).toBe(true);
  });
  it("can be reset", () => {
    for (let i = 0; i < 3; i++) rateLimit("r", 2, 60_000, 0);
    resetRateLimit("r");
    expect(rateLimit("r", 2, 60_000, 0).ok).toBe(true);
  });
});
