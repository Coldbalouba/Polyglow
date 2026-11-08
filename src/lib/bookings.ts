import "server-only";
import { prisma } from "./db";
import { feeForClass, formatMoney } from "./fees";
import { paymentsLive } from "./config";
import { cancelOutcome, canOpenDispute, canStudentConfirm, jitsiRoom, lessonPrice, PENDING_PAYMENT_TTL_MIN, shouldAutoComplete, REMINDER_HOURS } from "./policy";
import * as pay from "./stripe";
import { link, sendEmail, signature } from "./email";
import { config } from "./config";

export class BookingError extends Error {}

/** Statuses that count as a "class" for the fee ladder. */
const CLASS_STATUSES = ["CONFIRMED", "COMPLETED", "DISPUTED"];

export async function completedClassCount(tutorId: string) {
  return prisma.booking.count({ where: { tutorId, status: "COMPLETED" } });
}

const withPeople = { student: true, tutor: { include: { user: true } } } as const;
type BookingWithPeople = NonNullable<Awaited<ReturnType<typeof loadBooking>>>;
async function loadBooking(id: string) {
  return prisma.booking.findUnique({ where: { id }, include: withPeople });
}

const when = (d: Date) => `${d.toUTCString().replace(" GMT", " UTC")}`;

/**
 * Reserve a slot. Returns where to send the student next: Stripe Checkout, or the booking
 * page when the lesson is free or payments are in demo mode.
 */
export async function createBooking(student: { id: string; email: string }, slotId: string, language: string) {
  const booking = await prisma.$transaction(async (tx) => {
    const slot = await tx.availabilitySlot.findUnique({
      where: { id: slotId },
      include: { tutor: { include: { languages: true } } },
    });
    if (!slot) throw new BookingError("That time slot no longer exists.");
    if (slot.isBooked) throw new BookingError("Sorry, that slot was just booked by someone else.");
    if (slot.startsAt < new Date()) throw new BookingError("That slot is in the past.");
    const tutor = slot.tutor;
    if (tutor.status !== "APPROVED") throw new BookingError("This tutor is not currently accepting bookings.");
    if (tutor.userId === student.id) throw new BookingError("You cannot book yourself.");
    if (!tutor.languages.some((l) => l.language === language)) throw new BookingError("This tutor does not teach that language.");
    if (paymentsLive() && !(tutor.stripeAccountId && tutor.stripeChargesEnabled))
      throw new BookingError("This tutor hasn't finished setting up payouts yet.");

    const updated = await tx.availabilitySlot.updateMany({ where: { id: slotId, isBooked: false }, data: { isBooked: true } });
    if (updated.count !== 1) throw new BookingError("Sorry, that slot was just booked by someone else.");

    const previous = await tx.booking.count({
      where: { tutorId: tutor.id, studentId: student.id, status: { in: [...CLASS_STATUSES, "LATE_CANCELLED", "PENDING_PAYMENT"] } },
    });
    const { priceCents, isTrial } = lessonPrice({
      hourlyRateCents: tutor.hourlyRateCents,
      durationMin: slot.durationMin,
      trialPriceCents: tutor.trialPriceCents,
      isFirstLessonWithTutor: previous === 0,
    });
    // Fee estimate from the class's position in the tutor's history; settled again on completion.
    const classesBefore = await tx.booking.count({ where: { tutorId: tutor.id, status: { in: CLASS_STATUSES } } });
    const fee = feeForClass(priceCents, classesBefore);

    return tx.booking.create({
      data: {
        studentId: student.id,
        tutorId: tutor.id,
        slotId,
        language,
        isTrial,
        startsAt: slot.startsAt,
        durationMin: slot.durationMin,
        priceCents: fee.priceCents,
        feeRateBps: fee.feeRateBps,
        platformFeeCents: fee.platformFeeCents,
        tutorPayoutCents: fee.tutorPayoutCents,
      },
      include: withPeople,
    });
  });

  if (booking.priceCents === 0) {
    await confirmBooking(booking.id, { paymentRef: "free" });
    return { redirectTo: `/bookings/${booking.id}` };
  }
  if (!paymentsLive()) return { redirectTo: `/bookings/${booking.id}` };

  const session = await pay.createCheckout({
    bookingId: booking.id,
    accountId: booking.tutor.stripeAccountId!,
    amountCents: booking.priceCents,
    applicationFeeCents: booking.platformFeeCents,
    description: `${booking.isTrial ? "Trial " : ""}${booking.language} lesson with ${booking.tutor.user.name} (${booking.durationMin} min)`,
    studentEmail: student.email,
  });
  await prisma.booking.update({ where: { id: booking.id }, data: { checkoutSessionId: session.id } });
  return { redirectTo: session.url! };
}

/** Demo-mode payment (no Stripe keys). */
export async function payBookingDemo(bookingId: string, studentId: string) {
  if (paymentsLive()) throw new BookingError("Payments are handled by Stripe Checkout.");
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.studentId !== studentId) throw new BookingError("Booking not found.");
  if (booking.status !== "PENDING_PAYMENT") throw new BookingError("This booking is already paid or closed.");
  await confirmBooking(bookingId, { paymentRef: pay.mockRef("ch") });
}

/** Called after Stripe reports a successful checkout (webhook or return URL). Idempotent. */
export async function confirmFromCheckout(sessionId: string, accountId: string) {
  const session = await pay.retrieveCheckout(sessionId, accountId);
  const bookingId = session.metadata?.bookingId;
  if (!bookingId || session.payment_status !== "paid") return null;
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { tutor: true } });
  if (!booking || booking.tutor.stripeAccountId !== accountId || session.amount_total !== booking.priceCents) {
    console.error("[stripe] checkout does not match booking", { sessionId, bookingId });
    return null;
  }
  const ids = pay.paymentIdsFrom(session);
  if (booking.status === "PENDING_PAYMENT") {
    await confirmBooking(bookingId, ids);
  } else if (booking.status === "CANCELLED" && booking.cancelledBy === "SYSTEM" && ids.paymentIntentId) {
    // Paid after the hold expired and someone else may have the slot: refund automatically.
    await pay.refundLesson(ids.paymentIntentId, accountId, `late_${bookingId}`);
    await prisma.booking.update({ where: { id: bookingId }, data: { refundedCents: booking.priceCents, paymentIntentId: ids.paymentIntentId } });
  }
  return bookingId;
}

async function confirmBooking(
  bookingId: string,
  ids: { paymentIntentId?: string | null; applicationFeeId?: string | null; paymentRef?: string },
) {
  const res = await prisma.booking.updateMany({
    where: { id: bookingId, status: "PENDING_PAYMENT" },
    data: {
      status: "CONFIRMED",
      confirmedAt: new Date(),
      paymentIntentId: ids.paymentIntentId ?? undefined,
      applicationFeeId: ids.applicationFeeId ?? undefined,
      paymentRef: ids.paymentRef ?? undefined,
    },
  });
  if (res.count !== 1) return;
  const b = (await loadBooking(bookingId))!;
  const meetingUrl = b.tutor.meetingLink || jitsiRoom(b.id);
  await prisma.booking.update({ where: { id: b.id }, data: { meetingUrl } });
  const summary = `${b.isTrial ? "Trial " : ""}${b.language} lesson, ${b.durationMin} min, ${when(b.startsAt)}`;
  await Promise.all([
    sendEmail(b.student.email, "Your lesson is confirmed",
      `Hi ${b.student.name},\n\nYou're booked with ${b.tutor.user.name}: ${summary}.\nPaid: ${formatMoney(b.priceCents)} (no booking fees).\nJoin link: ${meetingUrl}\nBooking: ${link(`/bookings/${b.id}`)}\n\nFree cancellation up to 12 hours before. Refunds go back to your card.${signature}`),
    sendEmail(b.tutor.user.email, "New lesson booked",
      `Hi ${b.tutor.user.name},\n\n${b.student.name} booked a ${summary}.\nYou earn ${formatMoney(b.tutorPayoutCents)} (Polyglow fee ${formatMoney(b.platformFeeCents)}; card processing is deducted by Stripe).\nJoin link: ${meetingUrl}\nBooking: ${link(`/bookings/${b.id}`)}${signature}`),
  ]);
}

/** Settle the final fee and mark the class done. Used by student confirmation, auto-completion and admin. */
async function settleCompletion(b: BookingWithPeople) {
  const completedBefore = await completedClassCount(b.tutorId);
  const fee = feeForClass(b.priceCents, completedBefore);
  const updated = await prisma.booking.updateMany({
    where: { id: b.id, status: { in: ["CONFIRMED", "DISPUTED"] } },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      feeRateBps: fee.feeRateBps,
      platformFeeCents: fee.platformFeeCents,
      tutorPayoutCents: fee.tutorPayoutCents,
    },
  });
  if (updated.count !== 1) return;
  const overcharged = b.platformFeeCents - fee.platformFeeCents;
  if (overcharged > 0 && paymentsLive() && b.applicationFeeId) {
    await pay.refundApplicationFee(b.applicationFeeId, overcharged, `settle_${b.id}`);
  }
}

export async function studentConfirmLesson(bookingId: string, studentId: string) {
  const b = await loadBooking(bookingId);
  if (!b || b.studentId !== studentId) throw new BookingError("Booking not found.");
  if (!canStudentConfirm(b)) throw new BookingError("You can confirm once the lesson has ended.");
  await settleCompletion(b);
}

export async function cancelBooking(bookingId: string, userId: string) {
  const b = await loadBooking(bookingId);
  if (!b) throw new BookingError("Booking not found.");
  const by = b.studentId === userId ? "STUDENT" : b.tutor.userId === userId ? "TUTOR" : null;
  if (!by) throw new BookingError("Booking not found.");
  const outcome = cancelOutcome({ by, status: b.status, startsAt: b.startsAt });
  if (!outcome.allowed) throw new BookingError(outcome.reason);

  if (b.status === "PENDING_PAYMENT" && paymentsLive() && b.checkoutSessionId && b.tutor.stripeAccountId) {
    await pay.expireCheckout(b.checkoutSessionId, b.tutor.stripeAccountId);
  }
  let refundedCents = 0;
  if (outcome.refund === "FULL" && b.priceCents > 0) {
    if (paymentsLive() && b.paymentIntentId) await pay.refundLesson(b.paymentIntentId, b.tutor.stripeAccountId!, `cancel_${b.id}`);
    refundedCents = b.priceCents;
  }
  await prisma.$transaction([
    prisma.booking.update({ where: { id: b.id }, data: { status: outcome.status, cancelledBy: by, refundedCents } }),
    // A late student cancellation keeps the slot reserved (the tutor is paid for it).
    ...(outcome.status === "CANCELLED" ? [prisma.availabilitySlot.update({ where: { id: b.slotId }, data: { isBooked: false } })] : []),
  ]);

  if (b.status === "CONFIRMED") {
    const refundText = refundedCents ? `A full refund of ${formatMoney(refundedCents)} is on its way to your card (usually 5–10 days).` : "This was within 12 hours of the lesson, so the tutor keeps the payment.";
    await Promise.all([
      sendEmail(b.student.email, "Lesson cancelled", `Hi ${b.student.name},\n\nYour ${b.language} lesson on ${when(b.startsAt)} was cancelled by ${by === "TUTOR" ? "your tutor" : "you"}. ${refundText}${signature}`),
      sendEmail(b.tutor.user.email, "Lesson cancelled", `Hi ${b.tutor.user.name},\n\nThe ${b.language} lesson with ${b.student.name} on ${when(b.startsAt)} was cancelled by ${by === "TUTOR" ? "you" : "the student"}.${outcome.status === "LATE_CANCELLED" ? " It was a late cancellation, so you keep the payment." : ""}${signature}`),
    ]);
  }
  return outcome;
}

export async function openDispute(bookingId: string, studentId: string, reason: string, details: string) {
  const b = await loadBooking(bookingId);
  if (!b || b.studentId !== studentId) throw new BookingError("Booking not found.");
  if (!canOpenDispute(b)) throw new BookingError("Problems can be reported from the start of the lesson until 24 hours after it ends.");
  const existing = await prisma.dispute.findUnique({ where: { bookingId } });
  if (existing) throw new BookingError("You already reported a problem with this lesson.");
  await prisma.$transaction([
    prisma.dispute.create({ data: { bookingId, openedById: studentId, reason, details } }),
    prisma.booking.update({ where: { id: bookingId }, data: { status: "DISPUTED" } }),
  ]);
  await Promise.all([
    sendEmail(config.adminEmails, `Dispute opened: ${reason}`, `${b.student.name} reported a problem with a lesson by ${b.tutor.user.name}.\nReason: ${reason}\n${details}\n\nReview: ${link("/admin/disputes")}`),
    sendEmail(b.tutor.user.email, "A student reported a problem", `Hi ${b.tutor.user.name},\n\n${b.student.name} reported a problem with the lesson on ${when(b.startsAt)} (${reason}). Our team will review it within 48 hours. You can reply on the booking page: ${link(`/bookings/${b.id}`)}${signature}`),
  ]);
}

export async function resolveDispute(bookingId: string, decision: "REFUND" | "RELEASE", note: string) {
  const b = await loadBooking(bookingId);
  if (!b || b.status !== "DISPUTED") throw new BookingError("No open dispute for this booking.");
  if (decision === "REFUND") {
    if (paymentsLive() && b.paymentIntentId && b.priceCents > 0) await pay.refundLesson(b.paymentIntentId, b.tutor.stripeAccountId!, `dispute_${b.id}`);
    await prisma.$transaction([
      prisma.booking.update({ where: { id: b.id }, data: { status: "CANCELLED", cancelledBy: "ADMIN", refundedCents: b.priceCents } }),
      prisma.dispute.update({ where: { bookingId }, data: { status: "REFUNDED", resolutionNote: note, resolvedAt: new Date() } }),
    ]);
  } else {
    await settleCompletion(b);
    await prisma.dispute.update({ where: { bookingId }, data: { status: "RELEASED", resolutionNote: note, resolvedAt: new Date() } });
  }
  const outcome = decision === "REFUND" ? `The student was refunded ${formatMoney(b.priceCents)}.` : "The lesson was confirmed and the tutor keeps the payment.";
  await Promise.all([
    sendEmail(b.student.email, "Your reported problem was reviewed", `Hi ${b.student.name},\n\n${outcome}\n${note ? `Note from our team: ${note}` : ""}${signature}`),
    sendEmail(b.tutor.user.email, "A reported problem was reviewed", `Hi ${b.tutor.user.name},\n\n${outcome}\n${note ? `Note from our team: ${note}` : ""}${signature}`),
  ]);
}

/** Scheduled housekeeping (run hourly): release stale holds, auto-complete lessons, send reminders. */
export async function runScheduledJobs(now = new Date()) {
  const stats = { expired: 0, completed: 0, reminded: 0 };

  const stale = await prisma.booking.findMany({
    where: { status: "PENDING_PAYMENT", createdAt: { lt: new Date(now.getTime() - PENDING_PAYMENT_TTL_MIN * 60_000) } },
    include: { tutor: true },
  });
  for (const b of stale) {
    if (paymentsLive() && b.checkoutSessionId && b.tutor.stripeAccountId) {
      // Double-check Stripe in case the webhook was missed.
      const confirmed = await confirmFromCheckout(b.checkoutSessionId, b.tutor.stripeAccountId).catch(() => null);
      if (confirmed) continue;
      await pay.expireCheckout(b.checkoutSessionId, b.tutor.stripeAccountId);
    }
    const res = await prisma.booking.updateMany({ where: { id: b.id, status: "PENDING_PAYMENT" }, data: { status: "CANCELLED", cancelledBy: "SYSTEM" } });
    if (res.count) {
      await prisma.availabilitySlot.update({ where: { id: b.slotId }, data: { isBooked: false } });
      stats.expired++;
    }
  }

  const due = await prisma.booking.findMany({
    where: { status: "CONFIRMED", startsAt: { lt: now } },
    include: withPeople,
  });
  for (const b of due) {
    if (shouldAutoComplete({ ...b, now })) {
      await settleCompletion(b);
      stats.completed++;
    }
  }

  const soon = await prisma.booking.findMany({
    where: { status: "CONFIRMED", reminderSentAt: null, startsAt: { gt: now, lt: new Date(now.getTime() + REMINDER_HOURS * 3600_000) } },
    include: withPeople,
  });
  for (const b of soon) {
    const text = (name: string) => `Hi ${name},\n\nReminder: ${b.language} lesson on ${when(b.startsAt)} (${b.durationMin} min).\nJoin link: ${b.meetingUrl ?? link(`/bookings/${b.id}`)}${signature}`;
    await Promise.all([sendEmail(b.student.email, "Lesson reminder", text(b.student.name)), sendEmail(b.tutor.user.email, "Lesson reminder", text(b.tutor.user.name))]);
    await prisma.booking.update({ where: { id: b.id }, data: { reminderSentAt: now } });
    stats.reminded++;
  }
  return stats;
}
