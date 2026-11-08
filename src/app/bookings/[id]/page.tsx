import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatMoney, formatRate } from "@/lib/fees";
import { Flash, param, type SearchParams } from "@/components/Flash";
import { LocalTime } from "@/components/LocalTime";
import { cancel, pay } from "@/app/actions/bookings";

export default async function BookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const booking = await prisma.booking.findUnique({ where: { id }, include: { tutor: { include: { user: true } } } });
  if (!booking || (booking.studentId !== user.id && booking.tutor.userId !== user.id)) notFound();
  const isStudent = booking.studentId === user.id;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Flash error={param(sp, "error")} notice={param(sp, "notice")} />
      <div className="card space-y-4">
        <h1 className="h1">{booking.language} lesson with {booking.tutor.user.name}</h1>
        <p><LocalTime iso={booking.startsAt.toISOString()} /> · {booking.durationMin} minutes</p>
        <span className="badge">{booking.status.replace("_", " ").toLowerCase()}</span>
        <dl className="space-y-2 rounded-xl bg-stone-50 p-4 text-sm">
          <Row label="Lesson price" value={formatMoney(booking.priceCents)} strong />
          <Row label="Booking fee for you" value={formatMoney(0)} />
          <Row label={`Goes to your tutor`} value={formatMoney(booking.tutorPayoutCents)} />
          <Row label={`TutConnect fee (${formatRate(booking.feeRateBps)}, from the tutor's share)`} value={formatMoney(booking.platformFeeCents)} />
        </dl>
        {booking.status !== "COMPLETED" && <p className="muted">The fee is final when the class is completed.</p>}
        {isStudent && booking.status === "PENDING_PAYMENT" && (
          <form action={pay} className="space-y-2">
            <input type="hidden" name="bookingId" value={booking.id} />
            <button className="btn w-full">Pay {formatMoney(booking.priceCents)}</button>
            <p className="muted text-center">Demo mode: no card is charged.</p>
          </form>
        )}
        {["PENDING_PAYMENT", "CONFIRMED"].includes(booking.status) && (
          <form action={cancel}>
            <input type="hidden" name="bookingId" value={booking.id} />
            <button className="btn-danger w-full">Cancel booking</button>
          </form>
        )}
        <Link href="/dashboard" className="btn-secondary w-full">Go to dashboard</Link>
      </div>
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
