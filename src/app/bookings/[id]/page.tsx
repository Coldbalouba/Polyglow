import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatMoney, formatRate } from "@/lib/fees";
import { paymentsLive } from "@/lib/config";
import { confirmFromCheckout } from "@/lib/bookings";
import { canOpenDispute, canStudentConfirm, FREE_CANCEL_HOURS } from "@/lib/policy";
import { Flash, param, type SearchParams } from "@/components/Flash";
import { LocalTime } from "@/components/LocalTime";
import { googleCalendarUrl } from "@/lib/ics";
import { calendarEventFor } from "@/lib/booking-calendar";
import { cancel, confirmLesson, payDemo, reportProblem, review, sendMessage } from "@/app/actions/bookings";

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  LATE_CANCELLED: "Cancelled late",
  DISPUTED: "Under review",
};

export default async function BookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;

  // Returning from Stripe Checkout: confirm immediately instead of waiting for the webhook.
  const sessionId = param(sp, "session_id");
  if (sessionId && paymentsLive()) {
    const b = await prisma.booking.findUnique({ where: { id }, include: { tutor: true } });
    if (b?.status === "PENDING_PAYMENT" && b.studentId === user.id && b.checkoutSessionId === sessionId && b.tutor.stripeAccountId) {
      await confirmFromCheckout(sessionId, b.tutor.stripeAccountId).catch((e) => console.error(e));
    }
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      tutor: { include: { user: true } },
      student: true,
      review: true,
      dispute: true,
      messages: { include: { author: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!booking || (booking.studentId !== user.id && booking.tutor.userId !== user.id)) notFound();
  const isStudent = booking.studentId === user.id;
  const other = isStudent ? booking.tutor.user.name : booking.student.name;
  const active = ["PENDING_PAYMENT", "CONFIRMED"].includes(booking.status) && booking.startsAt > new Date();
  const notice = param(sp, "notice") ?? (sessionId && booking.status === "CONFIRMED" ? "Payment received. Your lesson is confirmed!" : undefined);

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        <Flash error={param(sp, "error") ?? (param(sp, "cancelled") ? "Payment was cancelled. Your slot is held for 30 minutes." : undefined)} notice={notice} />
        <div className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="h1">{booking.isTrial ? "Trial " : ""}{booking.language} lesson</h1>
            <span className="badge">{STATUS_LABEL[booking.status] ?? booking.status}</span>
          </div>
          <p>With <span className="font-medium">{other}</span> · <LocalTime iso={booking.startsAt.toISOString()} /> · {booking.durationMin} min</p>

          {["CONFIRMED", "DISPUTED", "COMPLETED"].includes(booking.status) && booking.meetingUrl && (
            <a href={booking.meetingUrl} target="_blank" rel="noreferrer" className="btn w-full">Join lesson video</a>
          )}
          {booking.status === "CONFIRMED" && booking.startsAt > new Date() && (
            <div className="flex flex-wrap gap-2 text-sm">
              <a href={`/bookings/${booking.id}/calendar`} className="btn-secondary">Add to calendar (.ics)</a>
              <a href={googleCalendarUrl(calendarEventFor(booking, isStudent))} target="_blank" rel="noreferrer" className="btn-secondary">Add to Google Calendar</a>
            </div>
          )}

          <dl className="space-y-2 rounded-xl bg-stone-50 p-4 text-sm">
            <Row label="Lesson price" value={formatMoney(booking.priceCents)} strong />
            <Row label="Booking or service fee for the student" value={formatMoney(0)} />
            <Row label={`Polyglow fee (${formatRate(booking.feeRateBps)}, from the tutor's share)`} value={formatMoney(booking.platformFeeCents)} />
            <Row label="Tutor receives (before Stripe's card fee)" value={formatMoney(booking.tutorPayoutCents)} />
            {booking.refundedCents > 0 && <Row label="Refunded to card" value={formatMoney(booking.refundedCents)} strong />}
          </dl>

          {isStudent && booking.status === "PENDING_PAYMENT" && !paymentsLive() && (
            <form action={payDemo} className="space-y-2">
              <input type="hidden" name="bookingId" value={booking.id} />
              <button className="btn w-full">Pay {formatMoney(booking.priceCents)} (demo)</button>
              <p className="muted text-center">Demo mode: no card is charged.</p>
            </form>
          )}
          {isStudent && booking.status === "PENDING_PAYMENT" && paymentsLive() && (
            <form action={cancel}><input type="hidden" name="bookingId" value={booking.id} /><p className="muted mb-2">Didn&apos;t finish paying? Release the slot or book again from the tutor&apos;s page.</p><button className="btn-secondary w-full">Release this slot</button></form>
          )}

          {isStudent && canStudentConfirm(booking) && (
            <form action={confirmLesson}>
              <input type="hidden" name="bookingId" value={booking.id} />
              <button className="btn w-full">The lesson happened ✓</button>
              <p className="muted mt-1 text-center">If you don&apos;t confirm or report a problem, lessons confirm automatically 24 hours after they end.</p>
            </form>
          )}

          {isStudent && booking.status === "COMPLETED" && !booking.review && (
            <form action={review} className="space-y-2">
              <input type="hidden" name="bookingId" value={booking.id} />
              <input type="hidden" name="back" value={`/bookings/${booking.id}`} />
              <p className="label">Rate this lesson</p>
              <div className="flex gap-2">
                <select name="rating" className="input w-auto" defaultValue="5" aria-label="Rating">
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
                </select>
                <input name="comment" className="input flex-1" placeholder="What did you like?" aria-label="Comment" />
                <button className="btn">Post</button>
              </div>
            </form>
          )}

          {booking.dispute && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="font-medium">Problem reported: {booking.dispute.reason.replaceAll("_", " ").toLowerCase()}</p>
              <p>Status: {booking.dispute.status === "OPEN" ? "our team will decide within 48 hours" : booking.dispute.status === "REFUNDED" ? "student refunded" : "lesson confirmed, tutor paid"}</p>
              {booking.dispute.resolutionNote && <p className="mt-1">Note: {booking.dispute.resolutionNote}</p>}
            </div>
          )}

          {active && (
            <form action={cancel}>
              <input type="hidden" name="bookingId" value={booking.id} />
              <button className="btn-danger w-full">Cancel lesson</button>
              <p className="muted mt-1 text-center">
                {isStudent
                  ? `Free cancellation (full refund to your card) up to ${FREE_CANCEL_HOURS} hours before. After that the tutor keeps the payment.`
                  : "If you cancel, the student gets a full refund. Frequent cancellations lower your ranking."}
              </p>
            </form>
          )}

          {isStudent && !booking.dispute && canOpenDispute(booking) && (
            <details className="rounded-xl border border-stone-200 p-3">
              <summary className="cursor-pointer text-sm font-medium">Report a problem</summary>
              <form action={reportProblem} className="mt-3 space-y-2">
                <input type="hidden" name="bookingId" value={booking.id} />
                <select name="reason" className="input" required defaultValue="" aria-label="Reason">
                  <option value="" disabled>What went wrong?</option>
                  <option value="TUTOR_NO_SHOW">Tutor didn&apos;t show up</option>
                  <option value="TECHNICAL">Technical problems stopped the lesson</option>
                  <option value="QUALITY">Lesson was far below what was promised</option>
                  <option value="OTHER">Something else</option>
                </select>
                <textarea name="details" className="input" placeholder="Tell us what happened" />
                <button className="btn-secondary">Send to Polyglow</button>
              </form>
            </details>
          )}
        </div>
        <Link href="/dashboard" className="btn-secondary w-full">Back to dashboard</Link>
      </div>

      <section id="messages" className="card space-y-3 lg:col-span-2">
        <h2 className="h2">Messages</h2>
        <p className="muted">Talk to {other} about goals and materials. Both of you get an email for new messages.</p>
        <div className="max-h-96 space-y-2 overflow-auto">
          {booking.messages.length === 0 && <p className="muted">No messages yet.</p>}
          {booking.messages.map((m) => (
            <div key={m.id} className={`rounded-xl p-3 text-sm ${m.authorId === user.id ? "bg-brand-50" : "bg-stone-50"}`}>
              <p className="font-medium">{m.authorId === user.id ? "You" : m.author.name} <span className="muted"><LocalTime iso={m.createdAt.toISOString()} /></span></p>
              <p className="whitespace-pre-wrap">{m.body}</p>
            </div>
          ))}
        </div>
        <form action={sendMessage} className="space-y-2">
          <input type="hidden" name="bookingId" value={booking.id} />
          <textarea name="body" className="input" placeholder="Write a message" required maxLength={2000} />
          <button className="btn">Send</button>
        </form>
      </section>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className={strong ? "font-medium" : "text-stone-600"}>{label}</dt>
      <dd className={strong ? "font-bold" : ""}>{value}</dd>
    </div>
  );
}
