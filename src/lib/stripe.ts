import "server-only";
import Stripe from "stripe";
import { randomBytes } from "node:crypto";
import { config, paymentsLive } from "./config";

/**
 * Payments via Stripe Connect, set up so the platform pays Stripe nothing per month:
 * - Each tutor gets their own Stripe account, created with "Stripe handles pricing"
 *   controller settings (fees paid by the connected account, Stripe covers losses,
 *   full Stripe dashboard). Stripe charges the platform no Connect fees for this setup.
 * - Lessons are "direct charges" on the tutor's account with an application fee
 *   (Polyglow's 1% or 5%). Money lands in the tutor's Stripe balance right away and
 *   is paid out to their bank on Stripe's normal schedule.
 * - Refunds go back to the student's card, never as site credit.
 *
 * Without STRIPE_SECRET_KEY everything runs in demo mode (no real money).
 */

let stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (!paymentsLive()) throw new Error("Stripe is not configured");
  stripe ??= new Stripe(config.stripeSecretKey);
  return stripe;
}

export async function createTutorAccount(email: string, country?: string) {
  const account = await getStripe().accounts.create({
    email,
    ...(country && /^[A-Z]{2}$/.test(country) ? { country } : {}),
    controller: {
      fees: { payer: "account" },
      losses: { payments: "stripe" },
      stripe_dashboard: { type: "full" },
    },
    capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
    business_profile: { mcc: "8299", product_description: "Online language lessons booked through Polyglow" },
  });
  return account.id;
}

export async function onboardingLink(accountId: string) {
  const link = await getStripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${config.appUrl}/dashboard/payouts?refresh=1`,
    return_url: `${config.appUrl}/dashboard/payouts?return=1`,
  });
  return link.url;
}

export async function accountChargesEnabled(accountId: string) {
  const account = await getStripe().accounts.retrieve(accountId);
  return Boolean(account.charges_enabled);
}

export async function createCheckout(opts: {
  bookingId: string;
  accountId: string;
  amountCents: number;
  applicationFeeCents: number;
  description: string;
  studentEmail: string;
}) {
  return getStripe().checkout.sessions.create(
    {
      mode: "payment",
      customer_email: opts.studentEmail,
      line_items: [
        {
          quantity: 1,
          price_data: { currency: config.currency, unit_amount: opts.amountCents, product_data: { name: opts.description } },
        },
      ],
      payment_intent_data: { application_fee_amount: opts.applicationFeeCents, metadata: { bookingId: opts.bookingId } },
      metadata: { bookingId: opts.bookingId },
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60, // Stripe's minimum is 30 minutes
      success_url: `${config.appUrl}/bookings/${opts.bookingId}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.appUrl}/bookings/${opts.bookingId}?cancelled=1`,
    },
    { stripeAccount: opts.accountId, idempotencyKey: `checkout_${opts.bookingId}` },
  );
}

export async function retrieveCheckout(sessionId: string, accountId: string) {
  return getStripe().checkout.sessions.retrieve(sessionId, { expand: ["payment_intent.latest_charge"] }, { stripeAccount: accountId });
}

export async function expireCheckout(sessionId: string, accountId: string) {
  try {
    await getStripe().checkout.sessions.expire(sessionId, {}, { stripeAccount: accountId });
  } catch {
    // already expired or completed
  }
}

/** Full refund to the student's card, including Polyglow's fee. */
export async function refundLesson(paymentIntentId: string, accountId: string, idempotencyKey: string) {
  return getStripe().refunds.create(
    { payment_intent: paymentIntentId, refund_application_fee: true, reason: "requested_by_customer" },
    { stripeAccount: accountId, idempotencyKey },
  );
}

/** Give part of Polyglow's fee back to the tutor (used when the final fee is lower than the estimate). */
export async function refundApplicationFee(applicationFeeId: string, amountCents: number, idempotencyKey: string) {
  if (amountCents <= 0) return;
  await getStripe().applicationFees.createRefund(applicationFeeId, { amount: amountCents }, { idempotencyKey });
}

export function mockRef(prefix: string) {
  return `mock_${prefix}_${randomBytes(6).toString("hex")}`;
}

/** Pull ids we need later out of a completed Checkout Session. */
export function paymentIdsFrom(session: Stripe.Checkout.Session) {
  const pi = session.payment_intent;
  const paymentIntentId = typeof pi === "string" ? pi : pi?.id ?? null;
  let applicationFeeId: string | null = null;
  if (pi && typeof pi !== "string") {
    const charge = pi.latest_charge;
    if (charge && typeof charge !== "string") {
      const fee = charge.application_fee;
      applicationFeeId = typeof fee === "string" ? fee : fee?.id ?? null;
    }
  }
  return { paymentIntentId, applicationFeeId };
}
