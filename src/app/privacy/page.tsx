export const metadata = { title: "Privacy Policy · TutConnect" };

export default function Privacy() {
  return (
    <article className="mx-auto max-w-3xl space-y-4 text-sm leading-6">
      <h1 className="h1">Privacy Policy</h1>
      <p className="muted">Last updated: November 2026.</p>
      <h2 className="h2">What we collect</h2>
      <ul className="list-disc pl-5">
        <li>Account data: name, email, hashed password.</li>
        <li>Tutor applications: profile, resume, quiz score, writing sample and lesson plan. Resumes are visible only to our reviewers.</li>
        <li>Bookings, messages between students and tutors, reviews and problem reports.</li>
        <li>Payment details are handled by Stripe. We never see or store card numbers.</li>
      </ul>
      <h2 className="h2">How we use it</h2>
      <p>To run the marketplace: vetting tutors, booking and paying for lessons, sending emails about your account and lessons, and resolving disputes. We don&apos;t sell your data and don&apos;t use advertising trackers.</p>
      <h2 className="h2">Who we share it with</h2>
      <p>Service providers that run the site: Stripe (payments), Resend (email), Netlify (hosting), Neon (database), and, for tutors who use the AI draft feature, Anthropic (lesson-plan drafting; only the lesson details you type are sent). Your tutor or student sees your name, messages and booking details.</p>
      <h2 className="h2">Your choices</h2>
      <p>You can ask us to export or delete your data by emailing support. We keep payment records as long as tax law requires.</p>
      <h2 className="h2">Cookies</h2>
      <p>We use one essential cookie to keep you logged in. No tracking cookies.</p>
      <p className="muted">This is a starting template. Have a lawyer review it, especially if you serve users in the EU/UK (GDPR).</p>
    </article>
  );
}
