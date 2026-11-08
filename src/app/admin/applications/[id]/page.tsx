import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatMoney } from "@/lib/fees";
import { Flash, param, type SearchParams } from "@/components/Flash";
import { decide, saveChecklist } from "@/app/actions/admin";

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  await requireUser(["ADMIN"]);
  const { id } = await params;
  const sp = await searchParams;
  const app = await prisma.tutorApplication.findUnique({
    where: { id },
    omit: { resumeData: true },
    include: { tutor: { include: { user: true, languages: true } } },
  });
  if (!app) notFound();
  const { tutor } = app;

  return (
    <div className="space-y-6">
      <Link href="/admin" className="muted">← All applications</Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="h1">{tutor.user.name}</h1>
          <p className="muted">{tutor.user.email} · {tutor.country || "Country not set"} · {formatMoney(tutor.hourlyRateCents)}/hour</p>
        </div>
        <span className="badge">{app.status}</span>
      </div>
      <Flash error={param(sp, "error")} notice={param(sp, "notice")} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card space-y-2">
            <h2 className="h2">Profile</h2>
            <p className="font-medium">{tutor.headline}</p>
            <p className="whitespace-pre-wrap text-sm">{tutor.bio}</p>
            <p className="text-sm">Languages: {tutor.languages.map((l) => `${l.language} (${l.level})`).join(", ")}</p>
          </section>
          <section className="card space-y-2">
            <h2 className="h2">Resume</h2>
            {app.resumeFileName ? (
              <a className="text-brand-600 underline" href={`/admin/resume/${app.id}`}>Download {app.resumeFileName}</a>
            ) : <p className="muted">No resume uploaded.</p>}
          </section>
          <section className="card space-y-2">
            <h2 className="h2">Skill check</h2>
            <p className="text-sm">Methodology quiz: {app.skillCheckScore ?? "—"}% {app.skillCheckPassed ? "(passed)" : "(not passed)"}</p>
            <p className="label mt-3">Writing sample</p>
            <p className="whitespace-pre-wrap rounded-xl bg-stone-50 p-3 text-sm">{app.writingSample || "—"}</p>
          </section>
          <section className="card space-y-2">
            <h2 className="h2">Lesson plan: {app.lessonPlanTitle || "Untitled"}</h2>
            <p className="muted">Drafted with: {app.lessonPlanAiTool || "—"}</p>
            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-xl bg-stone-50 p-3 text-sm">{app.lessonPlan || "—"}</pre>
          </section>
        </div>

        <aside className="space-y-6">
          <form action={saveChecklist} className="card space-y-3">
            <h2 className="h2">Vetting checklist</h2>
            <input type="hidden" name="applicationId" value={app.id} />
            <Check name="resumeVerified" label="Resume verified" checked={app.resumeVerified} />
            <Check name="liveCheckPassed" label="Live skill call passed" checked={app.liveCheckPassed} />
            <Check name="lessonPlanApproved" label="Lesson plan approved" checked={app.lessonPlanApproved} />
            <label className="label" htmlFor="reviewerNotes">Notes to tutor</label>
            <textarea className="input min-h-24" id="reviewerNotes" name="reviewerNotes" defaultValue={app.reviewerNotes ?? ""} />
            <button className="btn-secondary w-full">Save checklist</button>
          </form>
          {app.status === "SUBMITTED" && (
            <form action={decide} className="card space-y-3">
              <h2 className="h2">Decision</h2>
              <input type="hidden" name="applicationId" value={app.id} />
              <textarea className="input min-h-20" name="reviewerNotes" placeholder="Notes (required to request changes)" defaultValue={app.reviewerNotes ?? ""} />
              <div className="grid grid-cols-2 gap-2">
                <button className="btn" name="decision" value="approve">Approve</button>
                <button className="btn-danger" name="decision" value="reject">Request changes</button>
              </div>
              <p className="muted">Approval requires all three checks to be saved as ticked.</p>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}

function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} /> {label}
    </label>
  );
}
