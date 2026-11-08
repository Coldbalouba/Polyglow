"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { BookingError, cancelBooking, completeBooking, createBooking, payBooking } from "@/lib/bookings";
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
  let bookingId: string;
  try {
    bookingId = (await createBooking(user.id, slotId, language)).id;
  } catch (e) {
    redirect(`/tutors/${tutorId}?error=${encodeURIComponent(messageOf(e))}`);
  }
  redirect(`/bookings/${bookingId}`);
}

export async function pay(formData: FormData) {
  const user = await requireUser(["STUDENT"]);
  const id = String(formData.get("bookingId"));
  try {
    await payBooking(id, user.id);
  } catch (e) {
    redirect(`/bookings/${id}?error=${encodeURIComponent(messageOf(e))}`);
  }
  redirect(`/bookings/${id}?notice=${encodeURIComponent("Payment received. Your lesson is confirmed!")}`);
}

export async function cancel(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("bookingId"));
  try {
    await cancelBooking(id, user.id);
  } catch (e) {
    redirect(`/dashboard?error=${encodeURIComponent(messageOf(e))}`);
  }
  revalidatePath("/dashboard");
  redirect(`/dashboard?notice=${encodeURIComponent("Booking cancelled. Any payment has been refunded.")}`);
}

export async function complete(formData: FormData) {
  const user = await requireUser(["TUTOR"]);
  const id = String(formData.get("bookingId"));
  try {
    await completeBooking(id, user.id);
  } catch (e) {
    redirect(`/dashboard?error=${encodeURIComponent(messageOf(e))}`);
  }
  revalidatePath("/dashboard");
  redirect(`/dashboard?notice=${encodeURIComponent("Class marked as completed and payout sent.")}`);
}

const reviewSchema = z.object({
  bookingId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).default(""),
});

export async function review(formData: FormData) {
  const user = await requireUser(["STUDENT"]);
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/dashboard?error=${encodeURIComponent("Pick a rating from 1 to 5.")}`);
  const booking = await prisma.booking.findUnique({ where: { id: parsed.data.bookingId }, include: { review: true } });
  if (!booking || booking.studentId !== user.id || booking.status !== "COMPLETED")
    redirect(`/dashboard?error=${encodeURIComponent("You can only review classes you have completed.")}`);
  if (booking.review) redirect(`/dashboard?error=${encodeURIComponent("You already reviewed this class.")}`);
  await prisma.review.create({
    data: { bookingId: booking.id, authorId: user.id, rating: parsed.data.rating, comment: parsed.data.comment },
  });
  revalidatePath("/dashboard");
  redirect(`/dashboard?notice=${encodeURIComponent("Thanks for your review!")}`);
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
