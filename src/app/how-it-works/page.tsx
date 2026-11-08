import Link from "next/link";
import { DISPUTE_WINDOW_HOURS, FREE_CANCEL_HOURS, NEW_TUTOR_BOOST, RANKING_PRIOR_RATING, RANKING_PRIOR_WEIGHT } from "@/lib/policy";

export const metadata = { title: "How Polyglow works · fees, refunds, ranking" };

export default function HowItWorks() {
  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <h1 className="h1">How Polyglow works</h1>
      <p className="text-lg text-stone-600">Plain rules, written down, the same for everyone.</p>

      <Section id="fees" title="Fees">
        <li>Students pay the tutor&apos;s price. <strong>No booking, service or processing fee on top.</strong></li>
        <li>Polyglow keeps <strong>1%</strong> of each of a tutor&apos;s first 5 completed lessons, then <strong>5%</strong>. That&apos;s it.</li>
        <li>Trial lessons are normal lessons: the tutor is paid for them (minus the same 1–5%). Tutors choose the trial price, or offer it free.</li>
        <li>Card processing is charged by Stripe, not us (about 2.9% + 30¢ in the US; it varies by country) and comes out of the tutor&apos;s share. We show this openly instead of hiding it.</li>
      </Section>

      <Section id="students" title="For students">
        <li>Pay per lesson. <strong>No subscription, nothing auto-renews, credits never expire</strong> because there are no credits.</li>
        <li>Cancel for free up to {FREE_CANCEL_HOURS} hours before a lesson. The refund goes back to your card, not into site credit.</li>
        <li>If your tutor cancels, you get a full refund, always.</li>
        <li>Tutor didn&apos;t show up or the lesson fell apart? Click &quot;Report a problem&quot; any time up to {DISPUTE_WINDOW_HOURS} hours after the lesson. A real person reviews it within 48 hours, and if the lesson didn&apos;t happen you get your money back.</li>
        <li>Message your tutor before the lesson about goals and materials.</li>
      </Section>

      <Section id="tutors" title="For tutors">
        <li>Your money goes straight into <strong>your own Stripe account</strong> when the student pays. We never hold it, and there are no withdrawal fees from us.</li>
        <li>Late student cancellations (under {FREE_CANCEL_HOURS} hours) are paid to you. Your time was reserved.</li>
        <li>Lessons confirm automatically {DISPUTE_WINDOW_HOURS} hours after they end, so you never chase students for confirmations.</li>
        <li>Use your own Zoom or Google Meet link, or a free Jitsi room we create per lesson.</li>
        <li>Set your own prices. We don&apos;t push you to lower them, and you can change them any time.</li>
      </Section>

      <Section id="ranking" title="How search ranking works">
        <li><strong>Nobody can pay for a better position.</strong> There are no ads or boosts for sale.</li>
        <li>&quot;Best match&quot; uses a Bayesian average rating: every tutor starts as if they had {RANKING_PRIOR_WEIGHT} reviews of {RANKING_PRIOR_RATING} stars. One lucky 5-star review can&apos;t beat a long track record, and one unfair review can&apos;t sink a new tutor.</li>
        <li>New tutors (fewer than 5 lessons) get a small +{NEW_TUTOR_BOOST} boost so they can be discovered.</li>
        <li>Tutors who cancel on students drop slightly (each cancellation in the last 90 days, capped).</li>
        <li>Hours taught, price, and how much commission we earn from you do <strong>not</strong> affect ranking. You can also sort by price or newest.</li>
      </Section>

      <Section id="vetting" title="Who can teach">
        <li>Languages only. Native, C2 or C1 level.</li>
        <li>Every tutor uploads a resume, passes a teaching-methodology quiz and a writing check, submits an AI-assisted lesson plan they adapted themselves, and has a live call with our team.</li>
      </Section>

      <p className="muted">Questions? <Link className="underline" href="/compare/preply">See how we compare</Link>, or read the <Link className="underline" href="/terms">Terms</Link>.</p>
    </article>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card space-y-3">
      <h2 className="h2">{title}</h2>
      <ul className="list-disc space-y-2 pl-5">{children}</ul>
    </section>
  );
}
