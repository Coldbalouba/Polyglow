import Link from "next/link";
import { signup } from "@/app/actions/auth";
import { Flash, param, type SearchParams } from "@/components/Flash";

export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const role = param(sp, "role") === "TUTOR" ? "TUTOR" : "STUDENT";
  return (
    <div className="mx-auto max-w-md card">
      <h1 className="h1 mb-2">{role === "TUTOR" ? "Apply to teach" : "Start learning"}</h1>
      <p className="muted mb-6">
        {role === "TUTOR"
          ? "TutConnect is selective. After signing up you will upload your resume, take a skill check and submit an AI-assisted lesson plan for review."
          : "Find a vetted language tutor and book your first lesson."}
      </p>
      <Flash error={param(sp, "error")} />
      <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
        <Link href="/signup?role=STUDENT" className={role === "STUDENT" ? "btn" : "btn-secondary"}>I want to learn</Link>
        <Link href="/signup?role=TUTOR" className={role === "TUTOR" ? "btn" : "btn-secondary"}>I want to teach</Link>
      </div>
      <form action={signup} className="space-y-4">
        <input type="hidden" name="role" value={role} />
        <div><label className="label" htmlFor="name">Full name</label><input className="input" id="name" name="name" required /></div>
        <div><label className="label" htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" required /></div>
        <div><label className="label" htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" minLength={8} required /></div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="terms" required className="mt-1" />
          <span>I agree to the <Link className="text-brand-600 underline" href="/terms" target="_blank">Terms</Link> and <Link className="text-brand-600 underline" href="/privacy" target="_blank">Privacy Policy</Link>.</span>
        </label>
        <button className="btn w-full">Create account</button>
      </form>
      <p className="muted mt-4">Already have an account? <Link className="text-brand-600 underline" href="/login">Log in</Link></p>
    </div>
  );
}
