import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { paymentsLive } from "@/lib/config";
import { getTutorContext } from "@/lib/tutor";
import { accountChargesEnabled } from "@/lib/stripe";
import { Flash, param, type SearchParams } from "@/components/Flash";
import { startPayoutOnboarding } from "@/app/actions/payouts";

export default async function PayoutsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser(["TUTOR"]);
  const sp = await searchParams;
  let { profile } = await getTutorContext(user.id);
  // Refresh status when returning from Stripe.
  if (paymentsLive() && profile.stripeAccountId) {
    const enabled = await accountChargesEnabled(profile.stripeAccountId).catch(() => profile.stripeChargesEnabled);
    if (enabled !== profile.stripeChargesEnabled) {
      await prisma.tutorProfile.update({ where: { id: profile.id }, data: { stripeChargesEnabled: enabled } });
      profile = { ...profile, stripeChargesEnabled: enabled };
    }
  }
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/dashboard" className="muted">← Dashboard</Link>
      <h1 className="h1">Payouts</h1>
      <Flash error={param(sp, "error")} notice={param(sp, "notice")} />
      <div className="card space-y-4">
        {!paymentsLive() ? (
          <p>Payments are in <strong>demo mode</strong> on this server (no Stripe key configured). Bookings work without real money.</p>
        ) : profile.stripeChargesEnabled ? (
          <>
            <p className="text-lg font-semibold text-brand-700">✓ Payouts are connected</p>
            <p className="muted">Lesson payments go straight into your own Stripe account and are paid to your bank on Stripe&apos;s schedule (usually a few business days). Polyglow never holds your money and charges no withdrawal fees.</p>
            <a className="btn-secondary" href="https://dashboard.stripe.com" target="_blank" rel="noreferrer">Open your Stripe dashboard</a>
          </>
        ) : (
          <>
            <p>Connect a Stripe account so students can pay you. It takes about 5 minutes: Stripe asks for your ID and bank details.</p>
            <ul className="muted list-disc space-y-1 pl-5">
              <li>Money goes to <strong>your</strong> Stripe account the moment a student pays.</li>
              <li>Polyglow takes 1% (first 5 classes) or 5%. Stripe&apos;s card processing fee (about 2.9% + 30¢ in the US) is deducted by Stripe.</li>
              <li>No withdrawal fees from us, no minimum balance.</li>
            </ul>
            <form action={startPayoutOnboarding} className="flex flex-wrap items-end gap-3">
              {!profile.stripeAccountId && (
                <div>
                  <label className="label" htmlFor="country">Your country (2-letter code)</label>
                  <input className="input w-28 uppercase" id="country" name="country" maxLength={2} placeholder="US" required />
                </div>
              )}
              <button className="btn">{profile.stripeAccountId ? "Continue Stripe setup" : "Connect with Stripe"}</button>
            </form>
            <p className="muted">Stripe supports tutors in about 46 countries. <a className="underline" href="https://stripe.com/global" target="_blank" rel="noreferrer">See the list</a>.</p>
          </>
        )}
      </div>
    </div>
  );
}
