"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { BookingError, cancelBooking, createBooking, openDispute, payBookingDemo, studentConfirmLesson } from "@/lib/bookings";
import { link, sendEmail, signature } from "@/lib/email";
import { paymentsLive } from "@/lib/config";
import { getTutorContext } from "@/lib/tutor";
import { SESSION_DURATIONS } from "@/lib/constants";

function messageOf(e: unknown) {
  if (e instanceof BookingError) return e.message;
  console.error(e);
  return "Something went wrong. Please try again.";
}

export async function book(formData: FormData) {
  const user = await requireUser(["STUDENT"]);
  const slotId = String(formData.get("slotId") ?? "");
  const tutorId = String(formData.get("tutorId") ?? "");
  const language = String(formData.get("language") ?? "");
  let target: string;
  try {
    target = (await createBooking(user, slotId, language)).redirectTo;
  } catch (e) {
    redirect(`/tutors/${tutorId}?error=${encodeURIComponent(messageOf(e))}`);
  }
  redirect(target);
}

/** Demo mode only: marks the booking paid without real money. */
export async function payDemo(formData: FormData) {
  const user = await requireUser(["STUDENT"]);
  const id = String(formData.get("bookingId"));
  try {
    await payBookingDemo(id, user.id);
  } catch (e) {
    redirect(`/bookings/${id}?error=${encodeURIComponent(messageOf(e))}`);
  }
  redirect(`/bookings/${id}?notice=${encodeURIComponent("Payment received. Your lesson is confirmed!")}`);
}

export async function cancel(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("bookingId"));
  let notice = "Booking cancelled.";
  try {
    const outcome = await cancelBooking(id, user.id);
    if (outcome.allowed && outcome.refund === "FULL") notice = "Booking cancelled. A full refund is on its way to the card used.";
    if (outcome.allowed && outcome.status === "LATE_CANCELLED") notice = "Booking cancelled. Because it was within 12 hours, the tutor keeps the payment.";
  } catch (e) {
    redirect(`/bookings/${id}?error=${encodeURIComponent(messageOf(e))}`);
  }
  revalidatePath("/dashboard");
  redirect(`/dashboard?notice=${encodeURIComponent(notice)}`);
}

export async function confirmLesson(formData: FormData) {
  const user = await requireUser(["STUDENT"]);
  const id = String(formData.get("bookingId"));
  try {
    await studentConfirmLesson(id, user.id);
  } catch (e) {
    redirect(`/bookings/${id}?error=${encodeURIComponent(messageOf(e))}`);
  }
  redirect(`/bookings/${id}?notice=${encodeURIComponent("Thanks for confirming! Leave a review below.")}`);
}

const DISPUTE_REASONS = ["TUTOR_NO_SHOW", "TECHNICAL", "QUALITY", "OTHER"] as const;

export async function reportProblem(formData: FormData) {
  const user = await requireUser(["STUDENT"]);
  const id = String(formData.get("bookingId"));
  const reason = String(formData.get("reason"));
  const details = String(formData.get("details") ?? "").trim().slice(0, 2000);
  if (!(DISPUTE_REASONS as readonly string[]).includes(reason)) redirect(`/bookings/${id}?error=${encodeURIComponent("Pick a reason.")}`);
  try {
    await openDispute(id, user.id, reason, details);
  } catch (e) {
    redirect(`/bookings/${id}?error=${encodeURIComponent(messageOf(e))}`);
  }
  redirect(`/bookings/${id}?notice=${encodeURIComponent("Thanks for telling us. We'll review it within 48 hours.")}`);
}

export async function sendMessage(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("bookingId"));
  const body = String(formData.get("body") ?? "").trim().slice(0, 2000);
  const b = await prisma.booking.findUnique({ where: { id }, include: { student: true, tutor: { include: { user: true } } } });
  if (!b || (b.studentId !== user.id && b.tutor.userId !== user.id)) redirect("/dashboard");
  if (!body) redirect(`/bookings/${id}#messages`);
  await prisma.message.create({ data: { bookingId: id, authorId: user.id, body } });
  const other = b.studentId === user.id ? b.tutor.user : b.student;
  await sendEmail(other.email, `New message from ${user.name}`, `${user.name} wrote:\n\n${body}\n\nReply: ${link(`/bookings/${id}#messages`)}${signature}`);
  revalidatePath(`/bookings/${id}`);
  redirect(`/bookings/${id}#messages`);
}

const reviewSchema = z.object({
  bookingId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).default(""),
});

export async function review(formData: FormData) {
  const rawBack = String(formData.get("back") ?? "");
  const back = /^\/[a-z]/i.test(rawBack) ? rawBack : "/dashboard";
  const user = await requireUser(["STUDENT"]);
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`${back}?error=${encodeURIComponent("Pick a rating from 1 to 5.")}`);
  const booking = await prisma.booking.findUnique({ where: { id: parsed.data.bookingId }, include: { review: true } });
  if (!booking || booking.studentId !== user.id || booking.status !== "COMPLETED")
    redirect(`${back}?error=${encodeURIComponent("You can only review classes you have completed.")}`);
  if (booking.review) redirect(`${back}?error=${encodeURIComponent("You already reviewed this class.")}`);
  await prisma.review.create({
    data: { bookingId: booking.id, authorId: user.id, rating: parsed.data.rating, comment: parsed.data.comment },
  });
  revalidatePath("/dashboard");
  redirect(`${back}?notice=${encodeURIComponent("Thanks for your review!")}`);
}

const slotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  durationMin: z.coerce.number().refine((d) => (SESSION_DURATIONS as readonly number[]).includes(d)),
  repeatWeeks: z.coerce.number().int().min(1).max(12).default(1),
  tzOffset: z.coerce.number().int().min(-840).max(840).default(0),
});

/** Tutor adds an open slot (optionally repeating weekly). Times are entered in the tutor's local time. */
export async function addSlot(formData: FormData) {
  const user = await requireUser(["TUTOR"]);
  const { profile } = await getTutorContext(user.id);
  if (profile.status !== "APPROVED") redirect(`/dashboard?error=${encodeURIComponent("You can add availability once approved.")}`);
  if (paymentsLive() && !profile.stripeChargesEnabled) redirect(`/dashboard/payouts?error=${encodeURIComponent("Connect payouts first so students can pay you.")}`);
  const parsed = slotSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/dashboard?error=${encodeURIComponent("Enter a valid date, time and length.")}`);
  const { date, time, durationMin, repeatWeeks, tzOffset } = parsed.data;
  // tzOffset is the browser's getTimezoneOffset() (minutes behind UTC).
  const base = new Date(`${date}T${time}:00Z`).getTime() + tzOffset * 60_000;
  const starts = Array.from({ length: repeatWeeks }, (_, i) => new Date(base + i * 7 * 24 * 3600 * 1000)).filter((d) => d > new Date());
  if (starts.length === 0) redirect(`/dashboard?error=${encodeURIComponent("Pick a time in the future.")}`);
  await prisma.availabilitySlot.createMany({ data: starts.map((startsAt) => ({ tutorId: profile.id, startsAt, durationMin })) });
  revalidatePath("/dashboard");
  redirect(`/dashboard?notice=${encodeURIComponent(`Added ${starts.length} slot${starts.length > 1 ? "s" : ""}.`)}`);
}

export async function removeSlot(formData: FormData) {
  const user = await requireUser(["TUTOR"]);
  const { profile } = await getTutorContext(user.id);
  await prisma.availabilitySlot.deleteMany({
    where: { id: String(formData.get("slotId")), tutorId: profile.id, isBooked: false, bookings: { none: {} } },
  });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
