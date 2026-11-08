import "server-only";
import { prisma } from "./db";
import type { ApplicationSnapshot } from "./application";

/** Load (and lazily create) the tutor profile + application for a tutor user. */
export async function getTutorContext(userId: string) {
  const existing = await prisma.tutorProfile.findUnique({
    where: { userId },
    include: { languages: true, application: { omit: { resumeData: true } } },
  });
  const profile =
    existing ??
    (await prisma.tutorProfile.create({
      data: { userId, application: { create: {} } },
      include: { languages: true, application: { omit: { resumeData: true } } },
    }));
  const application =
    profile.application ?? (await prisma.tutorApplication.create({ data: { tutorId: profile.id }, omit: { resumeData: true } }));
  return { profile, application };
}

export function snapshotOf(ctx: Awaited<ReturnType<typeof getTutorContext>>): ApplicationSnapshot {
  const { profile, application } = ctx;
  return {
    headline: profile.headline,
    bio: profile.bio,
    hourlyRateCents: profile.hourlyRateCents,
    languageCount: profile.languages.length,
    resumePath: application.resumeFileName,
    skillCheckPassed: application.skillCheckPassed,
    writingSample: application.writingSample,
    lessonPlan: application.lessonPlan,
    lessonPlanAiTool: application.lessonPlanAiTool,
  };
}

/** Tutors can edit their application only while it is in progress or after a rejection. */
export function isEditable(status: string) {
  return status === "IN_PROGRESS" || status === "REJECTED";
}
