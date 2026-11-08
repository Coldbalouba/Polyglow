"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canApprove } from "@/lib/application";

function back(id: string, msg: { error?: string; notice?: string }): never {
  const q = msg.error ? `error=${encodeURIComponent(msg.error)}` : `notice=${encodeURIComponent(msg.notice ?? "")}`;
  redirect(`/admin/applications/${id}?${q}`);
}

export async function saveChecklist(formData: FormData) {
  await requireUser(["ADMIN"]);
  const id = String(formData.get("applicationId"));
  await prisma.tutorApplication.update({
    where: { id },
    data: {
      resumeVerified: formData.get("resumeVerified") === "on",
      liveCheckPassed: formData.get("liveCheckPassed") === "on",
      lessonPlanApproved: formData.get("lessonPlanApproved") === "on",
      reviewerNotes: String(formData.get("reviewerNotes") ?? "").trim() || null,
    },
  });
  revalidatePath(`/admin/applications/${id}`);
  back(id, { notice: "Checklist saved." });
}

export async function decide(formData: FormData) {
  await requireUser(["ADMIN"]);
  const id = String(formData.get("applicationId"));
  const decision = String(formData.get("decision"));
  const notes = String(formData.get("reviewerNotes") ?? "").trim() || null;
  const app = await prisma.tutorApplication.findUnique({ where: { id } });
  if (!app) redirect("/admin");
  if (app.status !== "SUBMITTED") back(id, { error: "Only submitted applications can be decided." });

  if (decision === "approve") {
    if (!canApprove(app)) back(id, { error: "Tick all three checks (resume, live call, lesson plan) and save before approving." });
    await prisma.$transaction([
      prisma.tutorApplication.update({ where: { id }, data: { status: "APPROVED", reviewedAt: new Date(), reviewerNotes: notes } }),
      prisma.tutorProfile.update({ where: { id: app.tutorId }, data: { status: "APPROVED" } }),
    ]);
  } else if (decision === "reject") {
    if (!notes) back(id, { error: "Add reviewer notes so the tutor knows what to improve." });
    await prisma.$transaction([
      prisma.tutorApplication.update({ where: { id }, data: { status: "REJECTED", reviewedAt: new Date(), reviewerNotes: notes } }),
      prisma.tutorProfile.update({ where: { id: app.tutorId }, data: { status: "REJECTED" } }),
    ]);
  } else {
    back(id, { error: "Unknown decision." });
  }
  revalidatePath("/admin");
  back(id, { notice: decision === "approve" ? "Tutor approved and now listed." : "Changes requested. The tutor can resubmit." });
}
