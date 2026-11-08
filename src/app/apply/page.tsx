import { requireUser } from "@/lib/auth";
import { applicationSteps } from "@/lib/application";
import { LANGUAGE_LEVELS, LANGUAGES } from "@/lib/constants";
import { PASS_MARK, publicQuiz } from "@/lib/skill-check";
import { getTutorContext, isEditable, snapshotOf } from "@/lib/tutor";
import { Flash, param, type SearchParams } from "@/components/Flash";
import {
  saveLessonPlan, saveProfile, saveWritingSample, submitApplication, submitQuiz, uploadResume,
} from "@/app/actions/apply";
import { LessonPlanForm } from "./LessonPlanGenerator";

const LANGUAGE_ROWS = 3;

export default async function ApplyPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const user = await requireUser(["TUTOR"]);
  const ctx = await getTutorContext(user.id);
  const { profile, application } = ctx;
  const steps = applicationSteps(snapshotOf(ctx));
  const editable = isEditable(application.status);
  const ready = steps.every((s) => s.done);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="h1">Your tutor application</h1>
        <p className="muted mt-1">TutConnect is selective. Complete all four steps, then submit for review.</p>
      </div>
      <Flash error={param(sp, "error")} notice={param(sp, "notice")} />

      <section id="status" className="card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="muted">Status</p>
            <p className="text-lg font-semibold">{statusLabel(application.status)}</p>
            {application.reviewerNotes && (
              <p className="mt-2 text-sm"><span className="font-medium">Reviewer notes:</span> {application.reviewerNotes}</p>
            )}
          </div>
          {editable && (
            <form action={submitApplication}>
              <button className="btn" disabled={!ready}>Submit for review</button>
            </form>
          )}
        </div>
        <ol className="mt-6 grid gap-3 sm:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.key} className={`rounded-xl border p-3 text-sm ${s.done ? "border-brand-100 bg-brand-50" : "border-stone-200"}`}>
              <p className="font-medium">{s.done ? "✓" : i + 1}. {s.label}</p>
              {s.missing.map((m) => <p key={m} className="muted mt-1">• {m}</p>)}
            </li>
          ))}
        </ol>
      </section>

      <section id="profile" className="card space-y-4">
        <h2 className="h2">1. Profile & languages</h2>
        <form action={saveProfile} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="headline">Headline</label>
            <input className="input" id="headline" name="headline" defaultValue={profile.headline} placeholder="Certified French tutor for exam prep" disabled={!editable} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="bio">About you and how you teach</label>
            <textarea className="input min-h-32" id="bio" name="bio" defaultValue={profile.bio} disabled={!editable} />
          </div>
          <div>
            <label className="label" htmlFor="country">Country</label>
            <input className="input" id="country" name="country" defaultValue={profile.country} disabled={!editable} />
          </div>
          <div>
            <label className="label" htmlFor="hourlyRate">Hourly rate (USD)</label>
            <input className="input" id="hourlyRate" name="hourlyRate" type="number" min="5" max="200" step="1" defaultValue={profile.hourlyRateCents / 100} disabled={!editable} />
          </div>
          <div className="sm:col-span-2 space-y-2">
            <p className="label">Languages you teach (Native, C2 or C1 only)</p>
            {Array.from({ length: LANGUAGE_ROWS }).map((_, i) => {
              const current = profile.languages[i];
              return (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <select className="input" name="language" defaultValue={current?.language ?? ""} disabled={!editable} aria-label={`Language ${i + 1}`}>
                    <option value="">—</option>
                    {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
                  </select>
                  <select className="input" name="level" defaultValue={current?.level ?? "NATIVE"} disabled={!editable} aria-label={`Level ${i + 1}`}>
                    {LANGUAGE_LEVELS.map((l) => <option key={l} value={l}>{l === "NATIVE" ? "Native" : l}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
          <div className="sm:col-span-2"><button className="btn" disabled={!editable}>Save profile</button></div>
        </form>
      </section>

      <section id="resume" className="card space-y-4">
        <h2 className="h2">2. Resume</h2>
        {application.resumeFileName && <p className="text-sm">Current file: <span className="font-medium">{application.resumeFileName}</span></p>}
        <form action={uploadResume} className="flex flex-wrap items-center gap-3">
          <input className="input max-w-md" type="file" name="resume" accept=".pdf,.doc,.docx" disabled={!editable} />
          <button className="btn" disabled={!editable}>Upload</button>
        </form>
        <p className="muted">PDF, DOC or DOCX, up to 5 MB. Only TutConnect reviewers can see it.</p>
      </section>

      <section id="skill" className="card space-y-6">
        <div>
          <h2 className="h2">3. Skill check</h2>
          <p className="muted">
            Part A is a teaching-methodology quiz (pass mark {PASS_MARK}%). Part B is a writing sample in the language you teach.
            After you submit, a reviewer will also run a short live call with you.
          </p>
        </div>
        <div className="rounded-xl bg-stone-50 p-4 text-sm">
          Quiz: {application.skillCheckPassed ? <span className="badge">Passed ({application.skillCheckScore}%)</span> : application.skillCheckScore != null ? `Best score ${application.skillCheckScore}%, not passed yet` : "Not taken yet"}
        </div>
        {!application.skillCheckPassed && (
          <form action={submitQuiz} className="space-y-5">
            {publicQuiz().map((q, i) => (
              <fieldset key={q.id} className="space-y-2" disabled={!editable}>
                <legend className="font-medium">{i + 1}. {q.prompt}</legend>
                {q.options.map((o, oi) => (
                  <label key={oi} className="flex items-start gap-2 text-sm">
                    <input type="radio" name={q.id} value={oi} required className="mt-1" /> {o}
                  </label>
                ))}
              </fieldset>
            ))}
            <button className="btn" disabled={!editable}>Submit quiz</button>
          </form>
        )}
        <form action={saveWritingSample} className="space-y-2">
          <label className="label" htmlFor="writingSample">
            Part B: In your teaching language, explain to a learner when to use one tricky grammar point (150+ characters).
          </label>
          <textarea className="input min-h-32" id="writingSample" name="writingSample" defaultValue={application.writingSample ?? ""} disabled={!editable} />
          <button className="btn" disabled={!editable}>Save writing sample</button>
        </form>
      </section>

      <section id="plan" className="card space-y-4">
        <div>
          <h2 className="h2">4. AI-assisted lesson plan</h2>
          <p className="muted">
            Use AI to draft a lesson plan, then review and adapt it. Reviewers look for a clear objective, sensible timings,
            high student talking time, and your own touch.
          </p>
        </div>
        <LessonPlanForm
          languages={profile.languages.map((l) => l.language)}
          initialTitle={application.lessonPlanTitle ?? ""}
          initialPlan={application.lessonPlan ?? ""}
          initialTool={application.lessonPlanAiTool ?? ""}
          disabled={!editable}
          saveAction={saveLessonPlan}
        />
      </section>
    </div>
  );
}

function statusLabel(status: string) {
  switch (status) {
    case "IN_PROGRESS": return "In progress";
    case "SUBMITTED": return "Submitted, under review";
    case "APPROVED": return "Approved. You are live on TutConnect!";
    case "REJECTED": return "Changes requested. Update your application and resubmit.";
    default: return status;
  }
}
