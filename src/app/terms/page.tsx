import { DISPUTE_WINDOW_HOURS, FREE_CANCEL_HOURS } from "@/lib/policy";

export const metadata = { title: "Terms of Service · Polyglow" };

export default function Terms() {
  return (
    <article className="prose mx-auto max-w-3xl space-y-4 text-sm leading-6">
      <h1 className="h1">Terms of Service</h1>
      <p className="muted">Last updated: November 2026. Plain-language summary first; the rules below are binding.</p>
      <h2 className="h2">1. What Polyglow is</h2>
      <p>Polyglow is a marketplace that connects language students with independent tutors. Tutors are not our employees. Each lesson is an agreement between the student and the tutor; we provide booking, payments (through Stripe), messaging and dispute handling.</p>
      <h2 className="h2">2. Accounts</h2>
      <p>You must be at least 18, or have a parent or guardian create and supervise the account. Keep your login safe and give accurate information. We may suspend accounts that break these terms.</p>
      <h2 className="h2">3. Tutors</h2>
      <p>Tutors must pass our application review. Tutors set their own prices and are responsible for their own taxes. Payments go to the tutor&apos;s own Stripe account and are subject to Stripe&apos;s Connected Account Agreement. Polyglow charges an application fee of 1% on each of a tutor&apos;s first five completed lessons and 5% after that. If the fee taken at payment is higher than the final fee, the difference is returned to the tutor.</p>
      <h2 className="h2">4. Payments, cancellations and refunds</h2>
      <ul className="list-disc pl-5">
        <li>Students pay the listed price when booking. We add no booking or service fees.</li>
        <li>Students may cancel for a full refund to the original payment method up to {FREE_CANCEL_HOURS} hours before the lesson. Later cancellations are not refunded and the tutor is paid.</li>
        <li>If a tutor cancels, the student is refunded in full.</li>
        <li>Students may report a problem from the start of a lesson until {DISPUTE_WINDOW_HOURS} hours after it ends. We review reports and may refund the student or release the payment to the tutor. Our decision is final within the platform but doesn&apos;t limit your legal rights.</li>
        <li>Lessons not reported within that window are confirmed automatically.</li>
      </ul>
      <h2 className="h2">5. Conduct</h2>
      <p>Be respectful. No harassment, discrimination, illegal content, or misuse of other users&apos; personal data. Don&apos;t book lessons to move payments outside the platform for lessons arranged here.</p>
      <h2 className="h2">6. Liability</h2>
      <p>We work hard to vet tutors, but we can&apos;t guarantee learning outcomes. To the extent the law allows, our liability for any claim is limited to the fees Polyglow received for the lesson involved.</p>
      <h2 className="h2">7. Changes and contact</h2>
      <p>We&apos;ll post changes here and email users about important ones. Contact: the support email shown in our emails.</p>
      <p className="muted">This is a starting template. Have a lawyer review it for your country before relying on it.</p>
    </article>
  );
}
