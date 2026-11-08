import { describe, expect, it } from "vitest";
import {
  feeForClass,
  feeRateBps,
  formatRate,
  INTRO_FEE_BPS,
  sessionPriceCents,
  splitPayment,
  STANDARD_FEE_BPS,
} from "./fees";

describe("feeRateBps", () => {
  it("charges 1% on the first five classes", () => {
    for (let done = 0; done < 5; done++) expect(feeRateBps(done)).toBe(INTRO_FEE_BPS);
  });
  it("charges 5% from the sixth class onwards", () => {
    expect(feeRateBps(5)).toBe(STANDARD_FEE_BPS);
    expect(feeRateBps(6)).toBe(STANDARD_FEE_BPS);
    expect(feeRateBps(500)).toBe(STANDARD_FEE_BPS);
  });
  it("rejects invalid counts", () => {
    expect(() => feeRateBps(-1)).toThrow();
    expect(() => feeRateBps(1.5)).toThrow();
  });
});

describe("splitPayment", () => {
  it("splits a $25 class at 1%", () => {
    expect(splitPayment(2500, 100)).toEqual({
      priceCents: 2500,
      feeRateBps: 100,
      platformFeeCents: 25,
      tutorPayoutCents: 2475,
    });
  });
  it("splits a $25 class at 5%", () => {
    expect(splitPayment(2500, 500)).toMatchObject({ platformFeeCents: 125, tutorPayoutCents: 2375 });
  });
  it("rounds the fee half-up to the cent and never loses money", () => {
    // 1% of $12.50 = 12.5c -> 13c
    const s = splitPayment(1250, 100);
    expect(s.platformFeeCents).toBe(13);
    expect(s.platformFeeCents + s.tutorPayoutCents).toBe(1250);
  });
  it("handles a free session", () => {
    expect(splitPayment(0, 500)).toMatchObject({ platformFeeCents: 0, tutorPayoutCents: 0 });
  });
  it("rejects bad input", () => {
    expect(() => splitPayment(-1, 100)).toThrow();
    expect(() => splitPayment(10.5, 100)).toThrow();
    expect(() => splitPayment(1000, 10_001)).toThrow();
  });
});

describe("feeForClass", () => {
  it("follows a tutor's first seven classes", () => {
    const fees = [0, 1, 2, 3, 4, 5, 6].map((n) => feeForClass(3000, n).platformFeeCents);
    expect(fees).toEqual([30, 30, 30, 30, 30, 150, 150]);
  });
});

describe("helpers", () => {
  it("prices sessions by duration", () => {
    expect(sessionPriceCents(3000, 60)).toBe(3000);
    expect(sessionPriceCents(3000, 30)).toBe(1500);
    expect(sessionPriceCents(2500, 45)).toBe(1875);
  });
  it("formats rates", () => {
    expect(formatRate(100)).toBe("1%");
    expect(formatRate(500)).toBe("5%");
    expect(formatRate(250)).toBe("2.50%");
  });
});
