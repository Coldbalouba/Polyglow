"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { paymentsLive } from "@/lib/config";
import { getTutorContext } from "@/lib/tutor";
import { createTutorAccount, onboardingLink } from "@/lib/stripe";

export async function startPayoutOnboarding(formData: FormData) {
  const user = await requireUser(["TUTOR"]);
  if (!paymentsLive()) redirect("/dashboard/payouts?error=" + encodeURIComponent("Payments are in demo mode."));
  const { profile } = await getTutorContext(user.id);
  if (profile.status !== "APPROVED") redirect("/dashboard/payouts?error=" + encodeURIComponent("You can connect payouts once approved."));
  let accountId = profile.stripeAccountId;
  let url: string;
  try {
    if (!accountId) {
      const country = String(formData.get("country") ?? "").toUpperCase();
      accountId = await createTutorAccount(user.email, country || undefined);
      await prisma.tutorProfile.update({ where: { id: profile.id }, data: { stripeAccountId: accountId } });
    }
    url = await onboardingLink(accountId);
  } catch (e) {
    console.error(e);
    redirect("/dashboard/payouts?error=" + encodeURIComponent((e as Error).message || "Stripe error"));
  }
  redirect(url);
}
