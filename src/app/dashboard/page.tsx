import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { feeRateBps, formatMoney, formatRate, INTRO_CLASS_COUNT } from "@/lib/fees";
import { getTutorContext } from "@/lib/tutor";
import { SESSION_DURATIONS } from "@/lib/constants";
import { Flash, param, type SearchParams } from "@/components/Flash";
import { LocalTime, TzOffsetInput } from "@/components/LocalTime";
import { addSlot, removeSlot, review } from "@/app/actions/bookings";
import { paymentsLive } from "@/lib/config";

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const sp = await searchParams;
  if (user.role === "ADMIN") redirect("/admin");
  const flash = <Flash error={param(sp, "error")} notice={param(sp, "notice")} />;
  return user.role === "TUTOR" ? <TutorDashboard userId={user.id} flash={flash} /> : <StudentDashboard userId={user.id} name={user.name} flash={flash} />;
}

async function StudentDashboard({ userId, name, flash }: { userId: string; name: string; flash: React.ReactNode }) {
  const bookings = await prisma.booking.findMany({
    where: { studentId: userId },
    include: { tutor: { include: { user: true } }, review: true },
    orderBy: { startsAt: "desc" },
  });
  const now = new Date();
  const upcoming = bookings.filter((b) => ["PENDING_PAYMENT", "CONFIRMED"].includes(b.status) && b.startsAt > now).reverse();
  const toConfirm = bookings.filter((b) => ["CONFIRMED", "DISPUTED"].includes(b.status) && b.startsAt <= now);
  const past = bookings.filter((b) => b.status === "COMPLETED");

  return (
    <div className="space-y-6">
      <h1 className="h1">Hi {name.split(" ")[0]}</h1>
      {flash}
      <section className="card space-y-3">
        <h2 className="h2">Upcoming lessons</h2>
        {upcoming.length === 0 && <p className="muted">Nothing booked. <Link className="text-brand-600 underline" href="/tutors">Find a tutor</Link></p>}
        {upcoming.map((b) => (
          <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-3 first:border-0 first:pt-0">
            <div>
              <p className="font-medium">{b.language} with {b.tutor.user.name}</p>
              <p className="muted"><LocalTime iso={b.startsAt.toISOString()} /> · {b.durationMin} min · {formatMoney(b.priceCents)}</p>
            </div>
            <div className="flex gap-2">
              {b.status === "PENDING_PAYMENT" && <span className="badge bg-amber-50 text-amber-800">Awaiting payment</span>}
              {b.status === "CONFIRMED" && <span className="badge">Confirmed</span>}
              <Link className="btn-secondary" href={`/bookings/${b.id}`}>Open</Link>
            </div>
          </div>
        ))}
      </section>
      {toConfirm.length > 0 && (
        <section className="card space-y-3 border-brand-500">
          <h2 className="h2">How did it go?</h2>
          {toConfirm.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-3">
              <p>{b.language} with {b.tutor.user.name} · <span className="muted"><LocalTime iso={b.startsAt.toISOString()} /></span></p>
              <Link className="btn" href={`/bookings/${b.id}`}>{b.status === "DISPUTED" ? "View report" : "Confirm or report a problem"}</Link>
            </div>
          ))}
        </section>
      )}
      <section className="card space-y-3">
        <h2 className="h2">Past lessons</h2>
        {past.length === 0 && <p className="muted">Completed lessons will show here so you can review your tutor.</p>}
        {past.map((b) => (
          <div key={b.id} className="space-y-2 border-t border-stone-100 pt-3 first:border-0 first:pt-0">
            <p className="font-medium">{b.language} with {b.tutor.user.name} · <span className="muted"><LocalTime iso={b.startsAt.toISOString()} /></span></p>
            {b.review ? (
              <p className="muted">You rated this {b.review.rating}/5.</p>
            ) : (
              <form action={review} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="bookingId" value={b.id} />
                <select name="rating" className="input w-auto" defaultValue="5" aria-label="Rating">
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
                </select>
                <input name="comment" className="input flex-1" placeholder="What did you like?" aria-label="Comment" />
                <button className="btn">Review</button>
              </form>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

async function TutorDashboard({ userId, flash }: { userId: string; flash: React.ReactNode }) {
  const { profile, application } = await getTutorContext(userId);
  if (profile.status !== "APPROVED") {
    return (
      <div className="space-y-6">
        <h1 className="h1">Tutor dashboard</h1>
        {flash}
        <div className="card space-y-3">
          <p>Your profile is not live yet (application status: <span className="font-medium">{application.status.replace("_", " ").toLowerCase()}</span>).</p>
          <Link href="/apply" className="btn">Continue your application</Link>
        </div>
      </div>
    );
  }

  const [bookings, slots, completedAgg] = await Promise.all([
    prisma.booking.findMany({
      where: { tutorId: profile.id, status: { in: ["PENDING_PAYMENT", "CONFIRMED", "DISPUTED"] } },
      include: { student: true },
      orderBy: { startsAt: "asc" },
    }),
    prisma.availabilitySlot.findMany({ where: { tutorId: profile.id, isBooked: false, startsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" } }),
    prisma.booking.aggregate({ where: { tutorId: profile.id, status: "COMPLETED" }, _count: true, _sum: { tutorPayoutCents: true, platformFeeCents: true } }),
  ]);
  const completed = completedAgg._count;
  const nextRate = feeRateBps(completed);
  const introLeft = Math.max(0, INTRO_CLASS_COUNT - completed);
  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h1">Tutor dashboard</h1>
        <div className="flex gap-2">
          <Link href="/apply#profile" className="btn-secondary">Edit profile & prices</Link>
          <Link href="/dashboard/payouts" className="btn-secondary">Payouts</Link>
          <Link href={`/tutors/${profile.id}`} className="btn-secondary">Public profile</Link>
        </div>
      </div>
      {flash}
      {paymentsLive() && !profile.stripeChargesEnabled && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-amber-300 bg-amber-50">
          <p>Connect payouts so students can book and pay you.</p>
          <Link href="/dashboard/payouts" className="btn">Connect payouts</Link>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card"><p className="muted">Classes completed</p><p className="text-2xl font-bold">{completed}</p></div>
        <div className="card"><p className="muted">Earned</p><p className="text-2xl font-bold">{formatMoney(completedAgg._sum.tutorPayoutCents ?? 0)}</p><p className="muted">Fees paid: {formatMoney(completedAgg._sum.platformFeeCents ?? 0)}</p></div>
        <div className="card">
          <p className="muted">Your fee on the next class</p>
          <p className="text-2xl font-bold">{formatRate(nextRate)}</p>
          <p className="muted">{introLeft > 0 ? `${introLeft} more class${introLeft > 1 ? "es" : ""} at the 1% intro rate` : "Standard rate"}</p>
        </div>
      </div>

      <section className="card space-y-3">
        <h2 className="h2">Upcoming classes</h2>
        {bookings.length === 0 && <p className="muted">No bookings yet. Add availability below so students can book you.</p>}
        {bookings.map((b) => (
          <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-3 first:border-0 first:pt-0">
            <div>
              <p className="font-medium">{b.language} with {b.student.name}</p>
              <p className="muted"><LocalTime iso={b.startsAt.toISOString()} /> · {b.durationMin} min · {formatMoney(b.priceCents)} · {b.status === "PENDING_PAYMENT" ? "awaiting payment" : b.startsAt <= now ? "confirms automatically 24h after the lesson" : "paid"}</p>
            </div>
            <div className="flex gap-2">
              {b.status === "DISPUTED" && <span className="badge bg-amber-50 text-amber-800">Problem reported</span>}
              {b.isTrial && <span className="badge">Trial</span>}
              <Link className="btn-secondary" href={`/bookings/${b.id}`}>Open</Link>
            </div>
          </div>
        ))}
      </section>

      <section className="card space-y-4">
        <h2 className="h2">Availability</h2>
        <form action={addSlot} className="grid gap-3 sm:grid-cols-5">
          <TzOffsetInput />
          <div><label className="label" htmlFor="date">Date</label><input className="input" id="date" name="date" type="date" required /></div>
          <div><label className="label" htmlFor="time">Start time</label><input className="input" id="time" name="time" type="time" required /></div>
          <div>
            <label className="label" htmlFor="durationMin">Length</label>
            <select className="input" id="durationMin" name="durationMin" defaultValue="60">
              {SESSION_DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="repeatWeeks">Repeat weekly</label>
            <select className="input" id="repeatWeeks" name="repeatWeeks" defaultValue="1">
              {[1, 2, 4, 8, 12].map((n) => <option key={n} value={n}>{n === 1 ? "Just once" : `${n} weeks`}</option>)}
            </select>
          </div>
          <div className="flex items-end"><button className="btn w-full">Add slot</button></div>
        </form>
        <div className="grid gap-2 sm:grid-cols-2">
          {slots.map((s) => (
            <form key={s.id} action={removeSlot} className="flex items-center justify-between rounded-xl border border-stone-200 px-3 py-2 text-sm">
              <input type="hidden" name="slotId" value={s.id} />
              <span><LocalTime iso={s.startsAt.toISOString()} /> · {s.durationMin} min</span>
              <button className="text-red-700 hover:underline">Remove</button>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
