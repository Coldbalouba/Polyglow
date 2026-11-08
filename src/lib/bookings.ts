import "server-only";
import { prisma } from "./db";
import { feeForClass, sessionPriceCents } from "./fees";
import { getPaymentProvider } from "./payments";

export class BookingError extends Error {}

export async function completedClassCount(tutorId: string) {
  return prisma.booking.count({ where: { tutorId, status: "COMPLETED" } });
}

/** Student reserves a slot. The fee shown is an estimate; it is settled on completion. */
export async function createBooking(studentId: string, slotId: string, language: string) {
  return prisma.$transaction(async (tx) => {
    const slot = await tx.availabilitySlot.findUnique({
      where: { id: slotId },
      include: { tutor: { include: { languages: true } } },
    });
    if (!slot) throw new BookingError("That time slot no longer exists.");
    if (slot.isBooked) throw new BookingError("Sorry, that slot was just booked by someone else.");
    if (slot.startsAt < new Date()) throw new BookingError("That slot is in the past.");
    if (slot.tutor.status !== "APPROVED") throw new BookingError("This tutor is not currently accepting bookings.");
    if (slot.tutor.userId === studentId) throw new BookingError("You cannot book yourself.");
    if (!slot.tutor.languages.some((l) => l.language === language))
      throw new BookingError("This tutor does not teach that language.");

    // Guard against double booking with a conditional update.
    const updated = await tx.availabilitySlot.updateMany({ where: { id: slotId, isBooked: false }, data: { isBooked: true } });
    if (updated.count !== 1) throw new BookingError("Sorry, that slot was just booked by someone else.");

    const completed = await tx.booking.count({ where: { tutorId: slot.tutorId, status: "COMPLETED" } });
    const price = sessionPriceCents(slot.tutor.hourlyRateCents, slot.durationMin);
    const fee = feeForClass(price, completed);

    return tx.booking.create({
      data: {
        studentId,
        tutorId: slot.tutorId,
        slotId,
        language,
        startsAt: slot.startsAt,
        durationMin: slot.durationMin,
        priceCents: fee.priceCents,
        feeRateBps: fee.feeRateBps,
        platformFeeCents: fee.platformFeeCents,
        tutorPayoutCents: fee.tutorPayoutCents,
      },
    });
  });
}

export async function payBooking(bookingId: string, studentId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.studentId !== studentId) throw new BookingError("Booking not found.");
  if (booking.status !== "PENDING_PAYMENT") throw new BookingError("This booking is already paid or closed.");
  const { ref } = await getPaymentProvider().chargeStudent({
    bookingId,
    amountCents: booking.priceCents,
    description: `TutConnect ${booking.language} lesson`,
  });
  return prisma.booking.update({ where: { id: bookingId }, data: { status: "CONFIRMED", paymentRef: ref } });
}

/** Tutor marks a class as taught. This settles the final fee and pays the tutor out. */
export async function completeBooking(bookingId: string, tutorUserId: string) {
  const settled = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { tutor: true } });
    if (!booking || booking.tutor.userId !== tutorUserId) throw new BookingError("Booking not found.");
    if (booking.status !== "CONFIRMED") throw new BookingError("Only confirmed (paid) classes can be completed.");
    if (booking.startsAt > new Date()) throw new BookingError("You can mark a class complete once it has started.");

    const completedBefore = await tx.booking.count({ where: { tutorId: booking.tutorId, status: "COMPLETED" } });
    const fee = feeForClass(booking.priceCents, completedBefore);
    return tx.booking.update({
      where: { id: bookingId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        feeRateBps: fee.feeRateBps,
        platformFeeCents: fee.platformFeeCents,
        tutorPayoutCents: fee.tutorPayoutCents,
      },
      include: { tutor: true },
    });
  });
  await getPaymentProvider().payoutTutor({
    bookingId,
    amountCents: settled.tutorPayoutCents,
    tutorAccountId: settled.tutor.stripeAccountId,
  });
  return settled;
}

/** Either party can cancel before the class starts; paid bookings are refunded in full. */
export async function cancelBooking(bookingId: string, userId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { tutor: true } });
  if (!booking || (booking.studentId !== userId && booking.tutor.userId !== userId)) throw new BookingError("Booking not found.");
  if (!["PENDING_PAYMENT", "CONFIRMED"].includes(booking.status)) throw new BookingError("This booking can no longer be cancelled.");
  if (booking.startsAt < new Date()) throw new BookingError("Classes that have started cannot be cancelled.");
  if (booking.status === "CONFIRMED" && booking.paymentRef) {
    await getPaymentProvider().refund({ paymentRef: booking.paymentRef, amountCents: booking.priceCents });
  }
  await prisma.$transaction([
    prisma.booking.update({ where: { id: bookingId }, data: { status: "CANCELLED" } }),
    prisma.availabilitySlot.update({ where: { id: booking.slotId }, data: { isBooked: false } }),
  ]);
}
