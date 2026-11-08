import { describe, expect, it } from "vitest";
import {
  canOpenDispute, canStudentConfirm, cancelOutcome, isSafeMeetingLink, lessonPrice, rankingScore, shouldAutoComplete,
} from "./policy";

const now = new Date("2026-11-10T12:00:00Z");
const inHours = (h: number) => new Date(now.getTime() + h * 3600_000);

describe("cancellation", () => {
  it("refunds students who cancel 12+ hours ahead", () => {
    expect(cancelOutcome({ by: "STUDENT", status: "CONFIRMED", startsAt: inHours(12), now })).toEqual({ allowed: true, refund: "FULL", status: "CANCELLED" });
  });
  it("pays the tutor when a student cancels late", () => {
    expect(cancelOutcome({ by: "STUDENT", status: "CONFIRMED", startsAt: inHours(11.9), now })).toEqual({ allowed: true, refund: "NONE", status: "LATE_CANCELLED" });
  });
  it("always refunds when the tutor cancels", () => {
    expect(cancelOutcome({ by: "TUTOR", status: "CONFIRMED", startsAt: inHours(1), now })).toMatchObject({ refund: "FULL" });
  });
  it("can't cancel a lesson that started", () => {
    expect(cancelOutcome({ by: "TUTOR", status: "CONFIRMED", startsAt: inHours(-0.1), now }).allowed).toBe(false);
  });
  it("lets anyone drop an unpaid booking", () => {
    expect(cancelOutcome({ by: "STUDENT", status: "PENDING_PAYMENT", startsAt: inHours(1), now })).toMatchObject({ allowed: true, refund: "NONE", status: "CANCELLED" });
  });
  it("can't cancel completed lessons", () => {
    expect(cancelOutcome({ by: "STUDENT", status: "COMPLETED", startsAt: inHours(48), now }).allowed).toBe(false);
  });
});

describe("disputes and completion", () => {
  const lesson = { startsAt: inHours(-2), durationMin: 60 }; // ended 1h ago
  it("opens disputes during and up to 24h after the lesson", () => {
    expect(canOpenDispute({ ...lesson, status: "CONFIRMED", now })).toBe(true);
    expect(canOpenDispute({ ...lesson, status: "CONFIRMED", now: inHours(22.9) })).toBe(true);
    expect(canOpenDispute({ ...lesson, status: "CONFIRMED", now: inHours(23.1) })).toBe(false);
    expect(canOpenDispute({ startsAt: inHours(1), durationMin: 60, status: "CONFIRMED", now })).toBe(false);
  });
  it("auto-completes only after the dispute window", () => {
    expect(shouldAutoComplete({ ...lesson, status: "CONFIRMED", now })).toBe(false);
    expect(shouldAutoComplete({ ...lesson, status: "CONFIRMED", now: inHours(23.1) })).toBe(true);
    expect(shouldAutoComplete({ ...lesson, status: "DISPUTED", now: inHours(100) })).toBe(false);
  });
  it("lets students confirm once the lesson ended", () => {
    expect(canStudentConfirm({ ...lesson, status: "CONFIRMED", now })).toBe(true);
    expect(canStudentConfirm({ startsAt: inHours(-0.5), durationMin: 60, status: "CONFIRMED", now })).toBe(false);
  });
});

describe("pricing", () => {
  it("uses the trial price for a first lesson", () => {
    expect(lessonPrice({ hourlyRateCents: 3000, durationMin: 60, trialPriceCents: 1000, isFirstLessonWithTutor: true })).toEqual({ priceCents: 1000, isTrial: true });
  });
  it("supports free trials when the tutor chooses", () => {
    expect(lessonPrice({ hourlyRateCents: 3000, durationMin: 30, trialPriceCents: 0, isFirstLessonWithTutor: true })).toEqual({ priceCents: 0, isTrial: true });
  });
  it("uses the normal price otherwise", () => {
    expect(lessonPrice({ hourlyRateCents: 3000, durationMin: 45, trialPriceCents: 1000, isFirstLessonWithTutor: false })).toEqual({ priceCents: 2250, isTrial: false });
    expect(lessonPrice({ hourlyRateCents: 3000, durationMin: 60, trialPriceCents: null, isFirstLessonWithTutor: true })).toEqual({ priceCents: 3000, isTrial: false });
  });
});

describe("ranking", () => {
  it("doesn't let one 5-star review beat a long track record", () => {
    const veteran = rankingScore({ ratingSum: 4.9 * 50, ratingCount: 50, completed: 200, tutorCancellations90d: 0 });
    const oneReview = rankingScore({ ratingSum: 5, ratingCount: 1, completed: 6, tutorCancellations90d: 0 });
    expect(veteran).toBeGreaterThan(oneReview);
  });
  it("gives brand-new tutors a fair start", () => {
    const fresh = rankingScore({ ratingSum: 0, ratingCount: 0, completed: 0, tutorCancellations90d: 0 });
    expect(fresh).toBeCloseTo(4.75);
  });
  it("penalises frequent tutor cancellations, capped", () => {
    const base = { ratingSum: 0, ratingCount: 0, completed: 10 };
    expect(rankingScore({ ...base, tutorCancellations90d: 2 })).toBeCloseTo(4.3);
    expect(rankingScore({ ...base, tutorCancellations90d: 50 })).toBeCloseTo(4.0);
  });
});

describe("meeting links", () => {
  it("only accepts https", () => {
    expect(isSafeMeetingLink("https://zoom.us/j/123")).toBe(true);
    expect(isSafeMeetingLink("http://zoom.us/j/123")).toBe(false);
    expect(isSafeMeetingLink("javascript:alert(1)")).toBe(false);
  });
});
