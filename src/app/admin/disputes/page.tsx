import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatMoney } from "@/lib/fees";
import { Flash, param, type SearchParams } from "@/components/Flash";
import { LocalTime } from "@/components/LocalTime";
import { settleDispute } from "@/app/actions/admin";

export default async function DisputesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser(["ADMIN"]);
  const sp = await searchParams;
  const disputes = await prisma.dispute.findMany({
    where: { status: "OPEN" },
    include: { booking: { include: { student: true, tutor: { include: { user: true } }, messages: { include: { author: true }, orderBy: { createdAt: "asc" } } } } },
    orderBy: { createdAt: "asc" },
  });
  return (
    <div className="space-y-6">
      <Link href="/admin" className="muted">← Admin</Link>
      <h1 className="h1">Open disputes</h1>
      <p className="muted">Goal: decide every dispute within 48 hours. Refunds go back to the student&apos;s card.</p>
      <Flash error={param(sp, "error")} notice={param(sp, "notice")} />
      {disputes.length === 0 && <div className="card muted">No open disputes. 🎉</div>}
      {disputes.map((d) => {
        const b = d.booking;
        return (
          <div key={d.id} className="card space-y-3">
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-semibold">{b.student.name} vs {b.tutor.user.name} · {b.language}</p>
              <span className="badge">{d.reason.replaceAll("_", " ").toLowerCase()}</span>
            </div>
            <p className="muted"><LocalTime iso={b.startsAt.toISOString()} /> · {b.durationMin} min · {formatMoney(b.priceCents)} · opened <LocalTime iso={d.createdAt.toISOString()} /></p>
            {d.details && <p className="rounded-xl bg-stone-50 p-3 text-sm">{d.details}</p>}
            {b.messages.length > 0 && (
              <details className="text-sm"><summary className="cursor-pointer">Messages ({b.messages.length})</summary>
                {b.messages.map((m) => <p key={m.id} className="mt-1"><span className="font-medium">{m.author.name}:</span> {m.body}</p>)}
              </details>
            )}
            <form action={settleDispute} className="space-y-2">
              <input type="hidden" name="bookingId" value={b.id} />
              <textarea className="input" name="note" placeholder="Note to both parties (optional)" />
              <div className="flex gap-2">
                <button className="btn" name="decision" value="refund">Refund student</button>
                <button className="btn-secondary" name="decision" value="release">Lesson happened: pay tutor</button>
              </div>
            </form>
          </div>
        );
      })}
    </div>
  );
}
