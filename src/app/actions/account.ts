"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { destroySession, hashPassword, requireUser, verifyPassword } from "@/lib/auth";

const back = (key: "error" | "notice", msg: string) => redirect(`/account?${key}=${encodeURIComponent(msg)}`);

export async function changePassword(formData: FormData) {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!(await verifyPassword(current, user.passwordHash))) back("error", "Your current password is wrong.");
  if (next.length < 8 || next.length > 200) back("error", "The new password must be at least 8 characters.");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  back("notice", "Password changed.");
}

/**
 * Deletes the account. Payment and lesson records are kept for the other person and for
 * tax and refund rules, but your name, email, password, profile and resume are removed.
 */
export async function deleteAccount(formData: FormData) {
  const user = await requireUser();
  if (user.role === "ADMIN") back("error", "Admins can't delete their account here. Remove the email from ADMIN_EMAILS first.");
  if (String(formData.get("confirm") ?? "").trim() !== "DELETE") back("error", 'Type DELETE in capitals to confirm.');
  if (!(await verifyPassword(String(formData.get("password") ?? ""), user.passwordHash))) back("error", "Your password is wrong.");

  const profile = await prisma.tutorProfile.findUnique({ where: { userId: user.id } });
  const open = await prisma.booking.count({
    where: {
      OR: [{ studentId: user.id }, ...(profile ? [{ tutorId: profile.id }] : [])],
      status: { in: ["PENDING_PAYMENT", "CONFIRMED", "DISPUTED"] },
    },
  });
  if (open > 0) back("error", `You still have ${open} upcoming or unresolved lesson${open > 1 ? "s" : ""}. Cancel or finish them first, then try again.`);

  await prisma.$transaction(async (tx) => {
    if (profile) {
      await tx.availabilitySlot.deleteMany({ where: { tutorId: profile.id, bookings: { none: {} } } });
      await tx.tutorLanguage.deleteMany({ where: { tutorId: profile.id } });
      await tx.tutorApplication.updateMany({
        where: { tutorId: profile.id },
        data: { resumeData: null, resumeFileName: null, resumeMime: null, writingSample: null, lessonPlan: null, lessonPlanTitle: null, reviewerNotes: null },
      });
      await tx.tutorProfile.update({
        where: { id: profile.id },
        data: { status: "DELETED", headline: "", bio: "", country: "", meetingLink: null, trialPriceCents: null },
      });
    }
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await tx.user.update({
      where: { id: user.id },
      data: {
        name: "Deleted user",
        email: `deleted-${user.id}@deleted.invalid`,
        passwordHash: await hashPassword(randomBytes(32).toString("hex")),
      },
    });
  });
  await destroySession();
  redirect(`/login?notice=${encodeURIComponent("Your account was deleted. Thanks for trying Polyglow.")}`);
}
