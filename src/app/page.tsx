import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/fees";

export default async function Home() {
  const tutorCount = await prisma.tutorProfile.count({ where: { status: "APPROVED" } });
  const example = 3000;
  return (
    <div className="space-y-16">
      <section className="grid items-center gap-10 md:grid-cols-2">
        <div className="space-y-6">
          <span className="badge">Languages only · Vetted tutors · Fair fees</span>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Learn a language with tutors who are actually appreciated.
          </h1>
          <p className="text-lg text-stone-600">
            Every TutConnect tutor sent a resume, passed a skill check and submitted a real lesson plan before
            teaching a single class. And because we only take 1–5%, more of what you pay goes to your tutor.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/tutors" className="btn">Browse {tutorCount > 0 ? `${tutorCount} ` : ""}tutors</Link>
            <Link href="/signup?role=TUTOR" className="btn-secondary">Apply to teach</Link>
          </div>
        </div>
        <div className="card space-y-4">
          <h2 className="h2">Where a {formatMoney(example)} lesson goes</h2>
          <FeeRow label="Tutor's first 5 classes" fee={example * 0.01} payout={example * 0.99} rate="1%" />
          <FeeRow label="From the 6th class on" fee={example * 0.05} payout={example * 0.95} rate="5%" />
          <p className="muted">Students pay the tutor&apos;s listed price. No booking fees added on top.</p>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {[
          ["1. Resume", "Tutors share their teaching and language background. We verify it."],
          ["2. Skill check", "A methodology quiz, a written sample in the language, and a live call with our team."],
          ["3. Lesson plan", "Tutors draft a real lesson plan with AI and make it their own, so there is always something to give."],
        ].map(([title, body]) => (
          <div key={title} className="card">
            <h3 className="mb-2 font-semibold">{title}</h3>
            <p className="muted">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

function FeeRow({ label, fee, payout, rate }: { label: string; fee: number; payout: number; rate: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-stone-50 p-4">
      <div>
        <p className="font-medium">{label}</p>
        <p className="muted">Platform fee {rate}: {formatMoney(Math.round(fee))}</p>
      </div>
      <p className="text-lg font-bold text-brand-700">{formatMoney(Math.round(payout))}<span className="muted"> to tutor</span></p>
    </div>
  );
}
