"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canSubmit } from "@/lib/application";
import { isLanguage, LANGUAGE_LEVELS, MAX_HOURLY_RATE_CENTS, MIN_HOURLY_RATE_CENTS } from "@/lib/constants";
import { scoreQuiz, QUIZ } from "@/lib/skill-check";
import { getTutorContext, isEditable, snapshotOf } from "@/lib/tutor";
import { readResume } from "@/lib/uploads";
import { isSafeMeetingLink } from "@/lib/policy";
import { sendEmail, link } from "@/lib/email";
import { config } from "@/lib/config";
import { draftLessonPlan } from "@/lib/lesson-plan-ai";

function back(section: string, msg: { error?: string; notice?: string }): never {
  const q = msg.error ? `error=${encodeURIComponent(msg.error)}` : `notice=${encodeURIComponent(msg.notice ?? "")}`;
  redirect(`/apply?${q}#${section}`);
}

async function editableContext() {
  const user = await requireUser(["TUTOR"]);
  const ctx = await getTutorContext(user.id);
  if (!isEditable(ctx.application.status)) back("status", { error: "Your application is under review and can't be edited right now." });
  return ctx;
}

const profileSchema = z.object({
  headline: z.string().trim().min(10, "Headline must be at least 10 characters").max(120),
  bio: z.string().trim().min(80, "Bio must be at least 80 characters").max(3000),
  country: z.string().trim().max(60),
  trialPrice: z.string().trim().max(10),
  meetingLink: z.string().trim().max(300),
  hourlyRate: z.coerce
    .number()
    .min(MIN_HOURLY_RATE_CENTS / 100, `Minimum rate is $${MIN_HOURLY_RATE_CENTS / 100}`)
    .max(MAX_HOURLY_RATE_CENTS / 100, `Maximum rate is $${MAX_HOURLY_RATE_CENTS / 100}`),
});

export async function saveProfile(formData: FormData) {
  // Approved tutors can keep their profile, prices and meeting link up to date.
  const user = await requireUser(["TUTOR"]);
  const { profile, application } = await getTutorContext(user.id);
  if (!isEditable(application.status) && application.status !== "APPROVED") back("status", { error: "Your application is under review and can't be edited right now." });
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("profile", { error: parsed.error.issues[0].message });

  const { trialPrice, meetingLink } = parsed.data;
  let trialPriceCents: number | null = null;
  if (trialPrice !== "") {
    const n = Number(trialPrice);
    if (!Number.isFinite(n) || n < 0 || n > parsed.data.hourlyRate) back("profile", { error: "Trial price must be between $0 and your hourly rate." });
    if (n > 0 && n < 1) back("profile", { error: "A paid trial must be at least $1 (or $0 for free)." });
    trialPriceCents = Math.round(n * 100);
  }
  if (meetingLink && !isSafeMeetingLink(meetingLink)) back("profile", { error: "Meeting link must start with https://" });

  const languages = formData.getAll("language").map(String);
  const levels = formData.getAll("level").map(String);
  const pairs = languages
    .map((language, i) => ({ language, level: levels[i] }))
    .filter((p) => p.language && isLanguage(p.language) && (LANGUAGE_LEVELS as readonly string[]).includes(p.level));
  const unique = [...new Map(pairs.map((p) => [p.language, p])).values()];
  if (unique.length === 0) back("profile", { error: "Add at least one language you teach (Native, C2 or C1 level)." });

  await prisma.$transaction([
    prisma.tutorProfile.update({
      where: { id: profile.id },
      data: {
        headline: parsed.data.headline,
        bio: parsed.data.bio,
        country: parsed.data.country,
        hourlyRateCents: Math.round(parsed.data.hourlyRate * 100),
        trialPriceCents,
        meetingLink: meetingLink || null,
      },
    }),
    prisma.tutorLanguage.deleteMany({ where: { tutorId: profile.id } }),
    prisma.tutorLanguage.createMany({ data: unique.map((p) => ({ ...p, tutorId: profile.id })) }),
  ]);
  revalidatePath("/apply");
  back("profile", { notice: "Profile saved." });
}

export async function uploadResume(formData: FormData) {
  const { application } = await editableContext();
  const file = formData.get("resume");
  if (!(file instanceof File) || file.size === 0) back("resume", { error: "Choose a file to upload." });
  let resume: Awaited<ReturnType<typeof readResume>>;
  try {
    resume = await readResume(file);
  } catch (e) {
    back("resume", { error: (e as Error).message });
  }
  await prisma.tutorApplication.update({
    where: { id: application.id },
    data: { resumeFileName: resume.name, resumeMime: resume.mime, resumeData: new Uint8Array(resume.data), resumeVerified: false },
  });
  revalidatePath("/apply");
  back("resume", { notice: "Resume uploaded." });
}

export async function submitQuiz(formData: FormData) {
  const { application } = await editableContext();
  const answers = Object.fromEntries(
    QUIZ.map((q) => {
      const v = formData.get(q.id);
      return [q.id, v === null ? undefined : Number(v)];
    }),
  );
  const result = scoreQuiz(answers);
  await prisma.tutorApplication.update({
    where: { id: application.id },
    data: {
      skillCheckScore: Math.max(result.score, application.skillCheckScore ?? 0),
      skillCheckPassed: application.skillCheckPassed || result.passed,
    },
  });
  revalidatePath("/apply");
  back(
    "skill",
    result.passed
      ? { notice: `You scored ${result.score}%. Passed!` }
      : { error: `You scored ${result.score}%. You need 75% to pass. Review and try again.` },
  );
}

export async function saveWritingSample(formData: FormData) {
  const { application } = await editableContext();
  const sample = String(formData.get("writingSample") ?? "").trim();
  if (sample.length < 150) back("skill", { error: "Your writing sample needs at least 150 characters." });
  await prisma.tutorApplication.update({ where: { id: application.id }, data: { writingSample: sample.slice(0, 5000) } });
  revalidatePath("/apply");
  back("skill", { notice: "Writing sample saved." });
}

export async function saveLessonPlan(formData: FormData) {
  const { application } = await editableContext();
  const title = String(formData.get("lessonPlanTitle") ?? "").trim();
  const plan = String(formData.get("lessonPlan") ?? "").trim();
  const tool = String(formData.get("lessonPlanAiTool") ?? "").trim();
  if (plan.length < 400) back("plan", { error: "Your lesson plan needs at least 400 characters." });
  if (!tool) back("plan", { error: "Tell us which AI tool you used to draft the plan." });
  await prisma.tutorApplication.update({
    where: { id: application.id },
    data: { lessonPlanTitle: title.slice(0, 200), lessonPlan: plan.slice(0, 20000), lessonPlanAiTool: tool.slice(0, 100), lessonPlanApproved: false },
  });
  revalidatePath("/apply");
  back("plan", { notice: "Lesson plan saved." });
}

export type DraftState = { text?: string; tool?: string; error?: string };

/** Used by the client-side generator (useActionState). Does not save; the tutor edits then saves. */
export async function generateLessonPlan(_prev: DraftState, formData: FormData): Promise<DraftState> {
  await requireUser(["TUTOR"]);
  const language = String(formData.get("language") ?? "");
  const level = String(formData.get("level") ?? "A2");
  const topic = String(formData.get("topic") ?? "").trim();
  const durationMin = Number(formData.get("durationMin") ?? 60);
  const goals = String(formData.get("goals") ?? "").trim();
  if (!isLanguage(language)) return { error: "Pick a language." };
  if (topic.length < 3) return { error: "Describe the lesson topic." };
  try {
    return await draftLessonPlan({ language, level, topic: topic.slice(0, 200), durationMin, goals: goals.slice(0, 500) });
  } catch (e) {
    return { error: (e as Error).message || "Could not generate a draft right now." };
  }
}

export async function submitApplication() {
  const user = await requireUser(["TUTOR"]);
  const ctx = await getTutorContext(user.id);
  if (!isEditable(ctx.application.status)) back("status", { error: "Your application is already submitted." });
  if (!canSubmit(snapshotOf(ctx))) back("status", { error: "Finish every step before submitting." });
  await prisma.$transaction([
    prisma.tutorApplication.update({
      where: { id: ctx.application.id },
      data: { status: "SUBMITTED", submittedAt: new Date(), reviewerNotes: null },
    }),
    prisma.tutorProfile.update({ where: { id: ctx.profile.id }, data: { status: "SUBMITTED" } }),
  ]);
  await sendEmail(config.adminEmails, "New tutor application", `${user.name} (${user.email}) submitted an application.\nReview: ${link("/admin")}`);
  revalidatePath("/apply");
  back("status", { notice: "Application submitted! Our team will review it and schedule your live skill check." });
}
