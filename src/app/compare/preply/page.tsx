import Link from "next/link";

export const metadata = { title: "Polyglow vs Preply · an honest comparison" };

const ROWS: [string, string, string][] = [
  ["Commission on a tutor's lessons", "33% for new tutors, falling to 18% only after 400+ hours taught", "1% for a tutor's first 5 lessons, then 5%"],
  ["Trial lessons", "Preply keeps 100% of each new student's trial lesson fee", "Tutor is paid for trials; tutor sets the trial price (or makes it free)"],
  ["How students pay", "Subscription that renews every 28 days; single lessons aren't sold apart from the trial", "Pay per lesson. No subscription, nothing renews"],
  ["Unused lessons", "Unscheduled lessons expire at renewal", "Nothing to expire"],
  ["Extra fees for students", "Processing fees and tax added at checkout", "None. Students pay the listed price"],
  ["Refunds", "Discretionary, requested within 28 days, can take up to 30 days to approve", "Automatic to your card for cancellations 12h+ ahead or tutor cancellations; no-show reports decided within 48h"],
  ["Getting paid (tutors)", "Withdraw through Preply via Payoneer, PayPal or Skrill", "Paid straight into the tutor's own Stripe account; no withdrawal fee from us"],
];

const SOURCES = [
  ["Preply review (onlinecourseing.com, 2026): subscriptions, trial, refunds, commission", "https://onlinecourseing.com/preply-review/"],
  ["Preply Help Center: how the subscription model works", "https://help.preply.com/en/articles/5275491-how-subscription-model-works"],
  ["Actual Fluency: Preply review (trial lesson commission, credit expiry)", "https://actualfluency.com/preply-review-great-for-students-so-so-for-teachers"],
  ["Andromeda Jones: online language tutoring platforms guide (commission tiers)", "https://andromedajones.substack.com/p/online-language-tutoring-a-viable"],
];

export default function ComparePreply() {
  return (
    <article className="mx-auto max-w-5xl space-y-6">
      <h1 className="h1">Polyglow vs Preply</h1>
      <p className="text-lg text-stone-600">
        Preply is a huge marketplace with lots of tutors and students, and a good video classroom. If size is what you need, it&apos;s a real option.
        We built Polyglow for people who want lower fees, simpler payments and clearer rules. Here are the differences, with sources.
      </p>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-stone-50">
            <tr><th className="p-4">Topic</th><th className="p-4">Preply (as publicly reported)</th><th className="p-4">Polyglow</th></tr>
          </thead>
          <tbody>
            {ROWS.map(([topic, them, us]) => (
              <tr key={topic} className="border-t border-stone-100 align-top">
                <td className="p-4 font-medium">{topic}</td>
                <td className="p-4 text-stone-600">{them}</td>
                <td className="p-4 font-medium text-brand-700">{us}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card space-y-2 text-sm">
        <p className="font-medium">Where Preply is ahead today</p>
        <ul className="list-disc space-y-1 pl-5 text-stone-600">
          <li>Far more tutors and languages to choose from. We&apos;re new and selective.</li>
          <li>A built-in video classroom. We use your tutor&apos;s link or a free Jitsi room.</li>
          <li>Mobile apps. We&apos;re web only for now.</li>
          <li>Wider payout options for tutors in countries Stripe doesn&apos;t cover yet.</li>
        </ul>
      </div>
      <div className="space-y-1 text-sm">
        <p className="font-medium">Sources (checked November 2026; policies change, so check Preply&apos;s current terms):</p>
        <ul className="list-disc pl-5">
          {SOURCES.map(([label, href]) => <li key={href}><a className="underline" href={href} target="_blank" rel="noreferrer">{label}</a></li>)}
        </ul>
        <p className="muted">Polyglow is not affiliated with Preply. &quot;Preply&quot; is a trademark of its owner, used here only to compare.</p>
      </div>
      <div className="flex gap-3">
        <Link href="/tutors" className="btn">Find a tutor</Link>
        <Link href="/signup?role=TUTOR" className="btn-secondary">Apply to teach</Link>
      </div>
    </article>
  );
}
