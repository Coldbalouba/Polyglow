import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatMoney } from "@/lib/fees";
import { param, type SearchParams } from "@/components/Flash";

const FILTERS = ["SUBMITTED", "IN_PROGRESS", "APPROVED", "REJECTED"] as const;

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser(["ADMIN"]);
  const sp = await searchParams;
  const status = (FILTERS as readonly string[]).includes(param(sp, "status") ?? "") ? param(sp, "status")! : "SUBMITTED";

  const [apps, counts, revenue, openDisputes] = await Promise.all([
    prisma.tutorApplication.findMany({
      where: { status },
      omit: { resumeData: true },
      include: { tutor: { include: { user: true, languages: true } } },
      orderBy: { submittedAt: "asc" },
    }),
    prisma.tutorApplication.groupBy({ by: ["status"], _count: true }),
    prisma.booking.aggregate({ where: { status: "COMPLETED" }, _sum: { platformFeeCents: true, tutorPayoutCents: true }, _count: true }),
    prisma.dispute.count({ where: { status: "OPEN" } }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h1">Admin</h1>
        <Link href="/admin/disputes" className="btn-secondary">Disputes ({openDisputes})</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Completed classes" value={String(revenue._count)} />
        <Stat label="Paid to tutors" value={formatMoney(revenue._sum.tutorPayoutCents ?? 0)} />
        <Stat label="Platform fees" value={formatMoney(revenue._sum.platformFeeCents ?? 0)} />
      </div>
      <div className="card space-y-4">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link key={f} href={`/admin?status=${f}`} className={f === status ? "btn" : "btn-secondary"}>
              {f.replace("_", " ").toLowerCase()} ({count(f)})
            </Link>
          ))}
        </div>
        {apps.length === 0 ? (
          <p className="muted">No applications here.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-stone-500">
              <tr><th className="py-2">Tutor</th><th>Languages</th><th>Quiz</th><th>Submitted</th><th /></tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id} className="border-t border-stone-100">
                  <td className="py-3"><p className="font-medium">{a.tutor.user.name}</p><p className="muted">{a.tutor.user.email}</p></td>
                  <td>{a.tutor.languages.map((l) => l.language).join(", ") || "—"}</td>
                  <td>{a.skillCheckScore != null ? `${a.skillCheckScore}%` : "—"}</td>
                  <td>{a.submittedAt?.toLocaleDateString() ?? "—"}</td>
                  <td className="text-right"><Link className="btn-secondary" href={`/admin/applications/${a.id}`}>Review</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="muted">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
