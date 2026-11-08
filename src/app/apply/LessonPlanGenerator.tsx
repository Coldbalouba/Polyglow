"use client";

import { useActionState, useState } from "react";
import { generateLessonPlan, type DraftState } from "@/app/actions/apply";

export function LessonPlanForm({
  languages,
  initialTitle,
  initialPlan,
  initialTool,
  disabled,
  saveAction,
}: {
  languages: string[];
  initialTitle: string;
  initialPlan: string;
  initialTool: string;
  disabled: boolean;
  saveAction: (formData: FormData) => Promise<void>;
}) {
  const [state, generate, pending] = useActionState<DraftState, FormData>(generateLessonPlan, {});
  const [plan, setPlan] = useState(initialPlan);
  const [tool, setTool] = useState(initialTool);
  const [lastApplied, setLastApplied] = useState<string | undefined>(undefined);

  // When a new draft arrives, drop it into the editor so the tutor can refine it.
  if (state.text && state.text !== lastApplied) {
    setLastApplied(state.text);
    setPlan(state.text);
    if (state.tool) setTool(state.tool);
  }

  return (
    <div className="space-y-6">
      <form action={generate} className="grid gap-3 rounded-xl bg-stone-50 p-4 sm:grid-cols-2">
        <p className="sm:col-span-2 text-sm font-medium">Draft with AI</p>
        <div>
          <label className="label" htmlFor="gen-language">Language</label>
          <select className="input" id="gen-language" name="language" disabled={disabled} defaultValue={languages[0]}>
            {languages.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="gen-level">Student level</label>
          <select className="input" id="gen-level" name="level" disabled={disabled} defaultValue="A2">
            {["A1", "A2", "B1", "B2", "C1", "C2"].map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="gen-topic">Topic</label>
          <input className="input" id="gen-topic" name="topic" placeholder="Ordering food at a restaurant" disabled={disabled} />
        </div>
        <div>
          <label className="label" htmlFor="gen-duration">Length</label>
          <select className="input" id="gen-duration" name="durationMin" defaultValue="60" disabled={disabled}>
            {[30, 45, 60, 90].map((d) => <option key={d} value={d}>{d} minutes</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="gen-goals">Student goals (optional)</label>
          <input className="input" id="gen-goals" name="goals" placeholder="Travelling to Spain next month" disabled={disabled} />
        </div>
        <div className="sm:col-span-2 flex items-center gap-3">
          <button className="btn" disabled={disabled || pending || languages.length === 0}>
            {pending ? "Drafting…" : "Generate draft"}
          </button>
          {languages.length === 0 && <span className="muted">Save at least one language in your profile first.</span>}
          {state.error && <span className="text-sm text-red-700">{state.error}</span>}
        </div>
      </form>

      <form action={saveAction} className="space-y-3">
        <div>
          <label className="label" htmlFor="lessonPlanTitle">Lesson title</label>
          <input className="input" id="lessonPlanTitle" name="lessonPlanTitle" defaultValue={initialTitle} disabled={disabled} />
        </div>
        <div>
          <label className="label" htmlFor="lessonPlan">Your lesson plan (edit the AI draft and make it yours)</label>
          <textarea
            className="input min-h-80 font-mono"
            id="lessonPlan"
            name="lessonPlan"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            disabled={disabled}
          />
          <p className="muted mt-1">{plan.trim().length} characters (minimum 400)</p>
        </div>
        <div>
          <label className="label" htmlFor="lessonPlanAiTool">AI tool used</label>
          <input
            className="input"
            id="lessonPlanAiTool"
            name="lessonPlanAiTool"
            value={tool}
            onChange={(e) => setTool(e.target.value)}
            placeholder="e.g. Claude, ChatGPT, Gemini"
            disabled={disabled}
          />
        </div>
        <button className="btn" disabled={disabled}>Save lesson plan</button>
      </form>
    </div>
  );
}
