import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { feeForClass, formatMoney, formatRate, sessionPriceCents } from "@/lib/fees";
import { completedClassCount } from "@/lib/bookings";
import { Flash, param, type SearchParams } from "@/components/Flash";
import { LocalTime } from "@/components/LocalTime";
import { Stars } from "@/components/Stars";
import { book } from "@/app/actions/bookings";

export default async function TutorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  const tutor = await prisma.tutorProfile.findUnique({
    where: { id },
    include: {
      user: true,
      languages: true,
      slots: { where: { isBooked: false, startsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" }, take: 30 },
    },
  });
  if (!tutor || tutor.status !== "APPROVED") notFound();

  const [reviews, completed] = await Promise.all([
    prisma.review.findMany({
      where: { booking: { tutorId: tutor.id } },
      include: { author: true, booking: { select: { language: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    completedClassCount(tutor.id),
  ]);
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const fee = feeForClass(tutor.hourlyRateCents, completed);
  const canBook = user?.role === "STUDENT";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section className="card space-y-3">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-2xl font-bold text-brand-700">{tutor.user.name.charAt(0)}</div>
            <div>
              <h1 className="h1">{tutor.user.name}</h1>
              <p className="muted">{tutor.country} · {completed} classes taught · {reviews.length ? <><Stars rating={avg} /> {avg.toFixed(1)} ({reviews.length})</> : "New tutor"}</p>
            </div>
          </div>
          <p className="text-lg font-medium">{tutor.headline}</p>
          <div className="flex flex-wrap gap-2">
            {tutor.languages.map((l) => <span key={l.id} className="badge">{l.language} · {l.level === "NATIVE" ? "Native" : l.level}</span>)}
            <span className="badge bg-amber-50 text-amber-800">✓ Vetted: resume, skill check, lesson plan</span>
          </div>
          <p className="whitespace-pre-wrap">{tutor.bio}</p>
        </section>

        <section className="card space-y-4">
          <h2 className="h2">Reviews</h2>
          {reviews.length === 0 && <p className="muted">No reviews yet.</p>}
          {reviews.map((r) => (
            <div key={r.id} className="border-t border-stone-100 pt-3 first:border-0 first:pt-0">
              <p className="text-sm"><Stars rating={r.rating} /> <span className="font-medium">{r.author.name.split(" ")[0]}</span> <span className="muted">· {r.booking.language}</span></p>
              {r.comment && <p className="mt-1 text-sm">{r.comment}</p>}
            </div>
          ))}
        </section>
      </div>

      <aside className="space-y-4">
        <div className="card space-y-3">
          <p><span className="text-2xl font-bold">{formatMoney(tutor.hourlyRateCents)}</span><span className="muted"> / hour</span></p>
          <p className="muted">
            {formatMoney(fee.tutorPayoutCents)} of each hour goes straight to {tutor.user.name.split(" ")[0]}. Our fee is {formatRate(fee.feeRateBps)}
            {fee.feeRateBps === 100 ? " while they complete their first 5 classes" : ""}.
          </p>
        </div>
        <div className="card space-y-3">
          <h2 className="h2">Book a lesson</h2>
          <Flash error={param(sp, "error")} />
          {!user && <p className="muted"><Link className="text-brand-600 underline" href="/login">Log in</Link> or <Link className="text-brand-600 underline" href="/signup">sign up</Link> as a student to book.</p>}
          {user && !canBook && <p className="muted">Only student accounts can book lessons.</p>}
          {tutor.slots.length === 0 && <p className="muted">No open times right now. Check back soon.</p>}
          {tutor.slots.map((s) => (
            <form key={s.id} action={book} className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 p-3">
              <input type="hidden" name="slotId" value={s.id} />
              <input type="hidden" name="tutorId" value={tutor.id} />
              <div className="flex-1 text-sm">
                <p className="font-medium"><LocalTime iso={s.startsAt.toISOString()} /></p>
                <p className="muted">{s.durationMin} min · {formatMoney(sessionPriceCents(tutor.hourlyRateCents, s.durationMin))}</p>
              </div>
              {tutor.languages.length > 1 ? (
                <select name="language" className="input w-auto" aria-label="Language">
                  {tutor.languages.map((l) => <option key={l.id}>{l.language}</option>)}
                </select>
              ) : (
                <input type="hidden" name="language" value={tutor.languages[0]?.language ?? ""} />
              )}
              <button className="btn" disabled={!canBook}>Book</button>
            </form>
          ))}
        </div>
      </aside>
    </div>
  );
}
