import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { config, paymentsLive } from "@/lib/config";
import { getStripe } from "@/lib/stripe";
import { confirmFromCheckout } from "@/lib/bookings";

/**
 * Stripe Connect webhook. In the Stripe dashboard add an endpoint for
 * "Events on Connected accounts" pointing at /api/stripe/webhook with:
 * checkout.session.completed, checkout.session.async_payment_succeeded,
 * checkout.session.expired, account.updated
 */
export async function POST(req: Request) {
  if (!paymentsLive() || !config.stripeWebhookSecret) return new Response("Stripe not configured", { status: 503 });
  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, req.headers.get("stripe-signature") ?? "", config.stripeWebhookSecret);
  } catch {
    return new Response("Bad signature", { status: 400 });
  }
  const account = event.account;
  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        if (account) await confirmFromCheckout(event.data.object.id, account);
        break;
      case "checkout.session.expired": {
        const bookingId = event.data.object.metadata?.bookingId;
        if (bookingId) {
          const b = await prisma.booking.findUnique({ where: { id: bookingId } });
          if (b?.status === "PENDING_PAYMENT") {
            await prisma.$transaction([
              prisma.booking.update({ where: { id: b.id }, data: { status: "CANCELLED", cancelledBy: "SYSTEM" } }),
              prisma.availabilitySlot.update({ where: { id: b.slotId }, data: { isBooked: false } }),
            ]);
          }
        }
        break;
      }
      case "account.updated": {
        const acct = event.data.object;
        await prisma.tutorProfile.updateMany({ where: { stripeAccountId: acct.id }, data: { stripeChargesEnabled: Boolean(acct.charges_enabled) } });
        break;
      }
    }
  } catch (e) {
    console.error("[stripe webhook]", event.type, e);
    return new Response("Handler error", { status: 500 }); // Stripe retries
  }
  return Response.json({ received: true });
}
