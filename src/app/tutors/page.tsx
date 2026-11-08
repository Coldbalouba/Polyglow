import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { LANGUAGES } from "@/lib/constants";
import { formatMoney } from "@/lib/fees";
import { statsFor } from "@/lib/tutor-stats";
import { paymentsLive } from "@/lib/config";
import { param, type SearchParams } from "@/components/Flash";
import { Stars } from "@/components/Stars";
import { LocalTime } from "@/components/LocalTime";

export default async function TutorsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const language = param(sp, "language") ?? "";
  const q = (param(sp, "q") ?? "").trim();
  const maxPrice = Number(param(sp, "maxPrice") ?? "") || undefined;
  const sort = param(sp, "sort") ?? "rating";
  const trial = param(sp, "trial") === "1";
  const thisWeek = param(sp, "week") === "1";
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

  const where: Prisma.TutorProfileWhereInput = {
    status: "APPROVED",
    ...(paymentsLive() ? { stripeChargesEnabled: true } : {}),
    ...(language ? { languages: { some: { language } } } : {}),
    ...(maxPrice ? { hourlyRateCents: { lte: maxPrice * 100 } } : {}),
    ...(trial ? { trialPriceCents: { not: null } } : {}),
    ...(thisWeek ? { slots: { some: { isBooked: false, startsAt: { gt: now, lte: weekEnd } } } } : {}),
    ...(q
      ? {
          OR: [
            { headline: { contains: q, mode: "insensitive" } },
            { bio: { contains: q, mode: "insensitive" } },
            { user: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const tutors = await prisma.tutorProfile.findMany({
    where,
    include: {
      user: true,
      languages: true,
      slots: { where: { isBooked: false, startsAt: { gt: now } }, orderBy: { startsAt: "asc" }, take: 1 },
    },
    orderBy: sort === "price" ? { hourlyRateCents: "asc" } : { createdAt: "desc" },
    take: 200,
  });
  const stats = await statsFor(tutors.map((t) => t.id));
  if (sort === "rating") tutors.sort((a, b) => (stats.get(b.id)?.score ?? 0) - (stats.get(a.id)?.score ?? 0));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h1">Find your language tutor</h1>
        <p className="muted mt-1">
          Every tutor here passed our resume review, skill check and lesson-plan review. Nobody can pay for a higher spot.{" "}
          <Link href="/how-it-works#ranking" className="underline">How ranking works</Link>
        </p>
      </div>
      <form className="card grid gap-3 sm:grid-cols-5" method="get">
        <select className="input" name="language" defaultValue={language} aria-label="Language">
          <option value="">All languages</option>
          {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
        </select>
        <input className="input sm:col-span-2" name="q" defaultValue={q} placeholder="Search: exam prep, business, kids…" aria-label="Search" />
        <input className="input" name="maxPrice" type="number" min="5" defaultValue={maxPrice ?? ""} placeholder="Max $/hour" aria-label="Max price per hour" />
        <div className="flex gap-2">
          <select className="input" name="sort" defaultValue={sort} aria-label="Sort">
            <option value="rating">Best match</option>
            <option value="price">Lowest price</option>
            <option value="new">Newest</option>
          </select>
          <button className="btn">Go</button>
        </div>
        <div className="flex flex-wrap gap-4 text-sm sm:col-span-5">
          <label className="flex items-center gap-2"><input type="checkbox" name="trial" value="1" defaultChecked={trial} /> Offers a trial lesson</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="week" value="1" defaultChecked={thisWeek} /> Has open times in the next 7 days</label>
        </div>
      </form>

      {tutors.length === 0 ? (
        <div className="card text-center muted">No tutors match yet. Try another language or clear the filters.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tutors.map((t) => {
            const r = stats.get(t.id);
            return (
              <Link key={t.id} href={`/tutors/${t.id}`} className="card block transition hover:border-brand-500">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
                      {t.user.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold">{t.user.name}</p>
                      <p className="muted">{t.country}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p><span className="text-lg font-bold">{formatMoney(t.hourlyRateCents)}</span><span className="muted">/hr</span></p>
                    {t.trialPriceCents != null && <p className="muted">Trial {t.trialPriceCents === 0 ? "free" : formatMoney(t.trialPriceCents)}</p>}
                  </div>
                </div>
                <p className="mt-3 font-medium">{t.headline}</p>
                <p className="mt-1 text-sm text-brand-700">
                  {t.slots[0] ? <>Next open time: <LocalTime iso={t.slots[0].startsAt.toISOString()} /></> : <span className="muted">No open times right now</span>}
                </p>
                <p className="muted mt-1 line-clamp-2">{t.bio}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {t.languages.map((l) => <span key={l.id} className="badge">{l.language} · {l.level === "NATIVE" ? "Native" : l.level}</span>)}
                  <span className="muted ml-auto">
                    {r && r.count > 0 ? <><Stars rating={r.avg} /> {r.avg.toFixed(1)} ({r.count})</> : "New tutor"} · {r?.completed ?? 0} lessons
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
