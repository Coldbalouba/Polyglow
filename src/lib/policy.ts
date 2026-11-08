/**
 * TutConnect's student- and tutor-friendly policies, as pure functions.
 * Each rule is a deliberate answer to a common complaint about big tutoring marketplaces.
 */

const HOUR = 3600 * 1000;

/** Students get a full refund (to their card, not "credits") if they cancel at least this many hours ahead. */
export const FREE_CANCEL_HOURS = 12;
/** After a lesson ends, the student has this long to report a problem before it auto-completes. */
export const DISPUTE_WINDOW_HOURS = 24;
/** Unpaid bookings hold the slot for this long, then the slot is released. */
export const PENDING_PAYMENT_TTL_MIN = 35;
/** Lesson reminder is emailed this many hours ahead. */
export const REMINDER_HOURS = 24;

export function lessonEnd(startsAt: Date, durationMin: number) {
  return new Date(startsAt.getTime() + durationMin * 60_000);
}

export type CancelOutcome =
  | { allowed: false; reason: string }
  | { allowed: true; refund: "FULL" | "NONE"; status: "CANCELLED" | "LATE_CANCELLED" };

/**
 * Who cancels, and when, decides the refund:
 * - Tutor cancels any time before the lesson: student gets a full refund.
 * - Student cancels >= FREE_CANCEL_HOURS ahead: full refund.
 * - Student cancels later than that: no refund, the tutor keeps the payment (their time was reserved).
 * - Unpaid bookings can always be dropped.
 */
export function cancelOutcome(opts: {
  by: "STUDENT" | "TUTOR";
  status: string;
  startsAt: Date;
  now?: Date;
}): CancelOutcome {
  const now = opts.now ?? new Date();
  if (opts.status === "PENDING_PAYMENT") return { allowed: true, refund: "NONE", status: "CANCELLED" };
  if (opts.status !== "CONFIRMED") return { allowed: false, reason: "This booking can no longer be cancelled." };
  if (opts.startsAt <= now) return { allowed: false, reason: "Lessons that have started can't be cancelled. Report a problem instead." };
  if (opts.by === "TUTOR") return { allowed: true, refund: "FULL", status: "CANCELLED" };
  const hoursAhead = (opts.startsAt.getTime() - now.getTime()) / HOUR;
  return hoursAhead >= FREE_CANCEL_HOURS
    ? { allowed: true, refund: "FULL", status: "CANCELLED" }
    : { allowed: true, refund: "NONE", status: "LATE_CANCELLED" };
}

/** A student can report a problem from the start of the lesson until DISPUTE_WINDOW_HOURS after it ends. */
export function canOpenDispute(opts: { status: string; startsAt: Date; durationMin: number; now?: Date }) {
  const now = opts.now ?? new Date();
  if (!["CONFIRMED", "COMPLETED"].includes(opts.status)) return false;
  if (now < opts.startsAt) return false;
  const deadline = lessonEnd(opts.startsAt, opts.durationMin).getTime() + DISPUTE_WINDOW_HOURS * HOUR;
  return now.getTime() <= deadline;
}

/** Confirmed lessons complete automatically once the dispute window has passed, so tutors never chase confirmations. */
export function shouldAutoComplete(opts: { status: string; startsAt: Date; durationMin: number; now?: Date }) {
  const now = opts.now ?? new Date();
  if (opts.status !== "CONFIRMED") return false;
  return now.getTime() > lessonEnd(opts.startsAt, opts.durationMin).getTime() + DISPUTE_WINDOW_HOURS * HOUR;
}

/** Students may confirm a lesson happened as soon as it has ended. */
export function canStudentConfirm(opts: { status: string; startsAt: Date; durationMin: number; now?: Date }) {
  const now = opts.now ?? new Date();
  return opts.status === "CONFIRMED" && now >= lessonEnd(opts.startsAt, opts.durationMin);
}

/** The student's first lesson with a tutor uses the tutor's trial price, if they set one. */
export function lessonPrice(opts: {
  hourlyRateCents: number;
  durationMin: number;
  trialPriceCents: number | null;
  isFirstLessonWithTutor: boolean;
}): { priceCents: number; isTrial: boolean } {
  if (opts.isFirstLessonWithTutor && opts.trialPriceCents != null) {
    return { priceCents: opts.trialPriceCents, isTrial: true };
  }
  return { priceCents: Math.round((opts.hourlyRateCents * opts.durationMin) / 60), isTrial: false };
}

/**
 * Transparent ranking. No paid placement, no hidden "hours taught" penalty.
 * - Ratings use a Bayesian average (prior of 4.5 stars worth 3 reviews), so one 5-star
 *   review can't beat fifty 4.9s, and one bad review can't sink a new tutor.
 * - New tutors (fewer than 5 completed lessons) get a small boost so they can get started.
 * - Tutors who cancel often drop a little.
 */
export const RANKING_PRIOR_RATING = 4.5;
export const RANKING_PRIOR_WEIGHT = 3;
export const NEW_TUTOR_BOOST = 0.25;
export const CANCEL_PENALTY = 0.1; // per tutor cancellation in the last 90 days, capped

export function rankingScore(opts: { ratingSum: number; ratingCount: number; completed: number; tutorCancellations90d: number }) {
  const bayes = (RANKING_PRIOR_RATING * RANKING_PRIOR_WEIGHT + opts.ratingSum) / (RANKING_PRIOR_WEIGHT + opts.ratingCount);
  const boost = opts.completed < 5 ? NEW_TUTOR_BOOST : 0;
  const penalty = Math.min(opts.tutorCancellations90d, 5) * CANCEL_PENALTY;
  return Math.round((bayes + boost - penalty) * 1000) / 1000;
}

/** Only http(s) meeting links are accepted. */
export function isSafeMeetingLink(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

export function jitsiRoom(bookingId: string) {
  return `https://meet.jit.si/TutConnect-${bookingId}`;
}
