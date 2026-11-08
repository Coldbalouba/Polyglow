import "server-only";
import { randomBytes } from "node:crypto";

/**
 * Payment provider abstraction.
 *
 * MVP ships a mock provider so the full booking flow works without keys.
 * Production plan (Stripe Connect, "separate charges and transfers"):
 *   1. On booking: charge the student the full price to the platform account.
 *   2. On class completion: settle the fee (1% intro / 5% standard) and
 *      create a Transfer of tutorPayoutCents to the tutor's connected account.
 * Settling at completion is what lets the intro rate apply to a tutor's first
 * five *completed* classes exactly.
 */
export interface PaymentProvider {
  name: string;
  chargeStudent(input: { bookingId: string; amountCents: number; description: string }): Promise<{ ref: string }>;
  payoutTutor(input: { bookingId: string; amountCents: number; tutorAccountId: string | null }): Promise<{ ref: string }>;
  refund(input: { paymentRef: string; amountCents: number }): Promise<{ ref: string }>;
}

const mockProvider: PaymentProvider = {
  name: "mock",
  async chargeStudent() {
    return { ref: `mock_ch_${randomBytes(6).toString("hex")}` };
  },
  async payoutTutor() {
    return { ref: `mock_tr_${randomBytes(6).toString("hex")}` };
  },
  async refund() {
    return { ref: `mock_re_${randomBytes(6).toString("hex")}` };
  },
};

export function getPaymentProvider(): PaymentProvider {
  if (process.env.STRIPE_SECRET_KEY) {
    // TODO: implement a Stripe provider (Checkout Session + Transfers) here.
    console.warn("STRIPE_SECRET_KEY is set but the Stripe provider is not implemented yet; using mock payments.");
  }
  return mockProvider;
}
