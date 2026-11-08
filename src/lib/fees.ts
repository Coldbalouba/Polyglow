/**
 * Polyglow fee model.
 *
 * - The platform keeps a small share of each session; the student pays the
 *   tutor's listed price and nothing on top.
 * - Introductory rate: 1% on a tutor's first 5 completed classes.
 * - Standard rate: 5% from the 6th completed class onwards.
 *
 * The rate for a class is settled when the class is completed, based on how
 * many classes that tutor had already completed. At booking time we show an
 * estimate using the same rule.
 *
 * All money is handled as integer cents. Rates are basis points (1% = 100).
 */

export const INTRO_FEE_BPS = 100; // 1%
export const STANDARD_FEE_BPS = 500; // 5%
export const INTRO_CLASS_COUNT = 5;

/** Fee rate (basis points) for a class, given how many classes the tutor had completed before it. */
export function feeRateBps(completedClassesBefore: number): number {
  if (!Number.isInteger(completedClassesBefore) || completedClassesBefore < 0) {
    throw new Error("completedClassesBefore must be a non-negative integer");
  }
  return completedClassesBefore < INTRO_CLASS_COUNT ? INTRO_FEE_BPS : STANDARD_FEE_BPS;
}

export interface FeeBreakdown {
  priceCents: number;
  feeRateBps: number;
  platformFeeCents: number;
  tutorPayoutCents: number;
}

/** Split a session price into platform fee and tutor payout. Fee rounds half-up to the cent. */
export function splitPayment(priceCents: number, rateBps: number): FeeBreakdown {
  if (!Number.isInteger(priceCents) || priceCents < 0) {
    throw new Error("priceCents must be a non-negative integer");
  }
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10_000) {
    throw new Error("rateBps must be an integer between 0 and 10000");
  }
  const platformFeeCents = Math.round((priceCents * rateBps) / 10_000);
  return {
    priceCents,
    feeRateBps: rateBps,
    platformFeeCents,
    tutorPayoutCents: priceCents - platformFeeCents,
  };
}

/** Convenience: full breakdown for a tutor's next class. */
export function feeForClass(priceCents: number, completedClassesBefore: number): FeeBreakdown {
  return splitPayment(priceCents, feeRateBps(completedClassesBefore));
}

/** Price of a session from an hourly rate and a duration in minutes. */
export function sessionPriceCents(hourlyRateCents: number, durationMin: number): number {
  return Math.round((hourlyRateCents * durationMin) / 60);
}

export function formatRate(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;
}

export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
