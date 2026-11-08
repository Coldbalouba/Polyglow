import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { LANGUAGES } from "@/lib/constants";
import { formatMoney } from "@/lib/fees";
import { ratingsFor } from "@/lib/tutor-stats";
import { param, type SearchParams } from "@/components/Flash";
import { Stars } from "@/components/Stars";

export default async function TutorsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const language = param(sp, "language") ?? "";
  const q = (param(sp, "q") ?? "").trim();
  const maxPrice = Number(param(sp, "maxPrice") ?? "") || undefined;
  const sort = param(sp, "sort") ?? "rating";

  const where: Prisma.TutorProfileWhereInput = {
    status: "APPROVED",
    ...(language ? { languages: { some: { language } } } : {}),
    ...(maxPrice ? { hourlyRateCents: { lte: maxPrice * 100 } } : {}),
    ...(q ? { OR: [{ headline: { contains: q } }, { bio: { contains: q } }, { user: { name: { contains: q } } }] } : {}),
  };
  const tutors = await prisma.tutorProfile.findMany({
    where,
    include: { user: true, languages: true, _count: { select: { bookings: { where: { status: "COMPLETED" } } } } },
    orderBy: sort === "price" ? { hourlyRateCents: "asc" } : { createdAt: "desc" },
    take: 60,
  });
  const ratings = await ratingsFor(tutors.map((t) => t.id));
  if (sort === "rating") tutors.sort((a, b) => (ratings.get(b.id)?.avg ?? 0) - (ratings.get(a.id)?.avg ?? 0));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h1">Find your language tutor</h1>
        <p className="muted mt-1">Every tutor here passed our resume review, skill check and lesson-plan review.</p>
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
            <option value="rating">Top rated</option>
            <option value="price">Lowest price</option>
            <option value="new">Newest</option>
          </select>
          <button className="btn">Go</button>
        </div>
      </form>

      {tutors.length === 0 ? (
        <div className="card text-center muted">No tutors match yet. Try another language or clear the filters.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {tutors.map((t) => {
            const r = ratings.get(t.id);
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
                  <p className="text-right"><span className="text-lg font-bold">{formatMoney(t.hourlyRateCents)}</span><span className="muted">/hr</span></p>
                </div>
                <p className="mt-3 font-medium">{t.headline}</p>
                <p className="muted mt-1 line-clamp-2">{t.bio}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {t.languages.map((l) => <span key={l.id} className="badge">{l.language} · {l.level === "NATIVE" ? "Native" : l.level}</span>)}
                  <span className="muted ml-auto">
                    {r ? <><Stars rating={r.avg} /> {r.avg.toFixed(1)} ({r.count})</> : "New tutor"} · {t._count.bookings} classes
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
