/**
 * Rules for the selective tutor application. Pure functions so they can be
 * unit tested and shared by the tutor wizard and the admin review screen.
 */

export const MIN_BIO_LENGTH = 80;
export const MIN_WRITING_SAMPLE_LENGTH = 150;
export const MIN_LESSON_PLAN_LENGTH = 400;

export interface ApplicationSnapshot {
  headline: string;
  bio: string;
  hourlyRateCents: number;
  languageCount: number;
  resumePath: string | null;
  skillCheckPassed: boolean;
  writingSample: string | null;
  lessonPlan: string | null;
  lessonPlanAiTool: string | null;
}

export interface Step {
  key: "profile" | "resume" | "skillCheck" | "lessonPlan";
  label: string;
  done: boolean;
  missing: string[];
}

export function applicationSteps(a: ApplicationSnapshot): Step[] {
  const profileMissing: string[] = [];
  if (a.headline.trim().length < 10) profileMissing.push("A headline of at least 10 characters");
  if (a.bio.trim().length < MIN_BIO_LENGTH) profileMissing.push(`A bio of at least ${MIN_BIO_LENGTH} characters`);
  if (a.languageCount < 1) profileMissing.push("At least one language you teach");
  if (a.hourlyRateCents <= 0) profileMissing.push("An hourly rate");

  const resumeMissing = a.resumePath ? [] : ["Upload your resume (PDF, DOC or DOCX)"];

  const skillMissing: string[] = [];
  if (!a.skillCheckPassed) skillMissing.push("Pass the teaching-methodology quiz");
  if ((a.writingSample ?? "").trim().length < MIN_WRITING_SAMPLE_LENGTH)
    skillMissing.push(`A writing sample in your teaching language (${MIN_WRITING_SAMPLE_LENGTH}+ characters)`);

  const planMissing: string[] = [];
  if ((a.lessonPlan ?? "").trim().length < MIN_LESSON_PLAN_LENGTH)
    planMissing.push(`A lesson plan of at least ${MIN_LESSON_PLAN_LENGTH} characters`);
  if (!a.lessonPlanAiTool?.trim()) planMissing.push("Which AI tool you used to draft it");

  return [
    { key: "profile", label: "Profile & languages", done: profileMissing.length === 0, missing: profileMissing },
    { key: "resume", label: "Resume", done: resumeMissing.length === 0, missing: resumeMissing },
    { key: "skillCheck", label: "Skill check", done: skillMissing.length === 0, missing: skillMissing },
    { key: "lessonPlan", label: "AI-assisted lesson plan", done: planMissing.length === 0, missing: planMissing },
  ];
}

export function canSubmit(a: ApplicationSnapshot): boolean {
  return applicationSteps(a).every((s) => s.done);
}

export interface AdminChecklist {
  resumeVerified: boolean;
  liveCheckPassed: boolean;
  lessonPlanApproved: boolean;
}

/** A tutor can only go live when every human check is ticked. */
export function canApprove(c: AdminChecklist): boolean {
  return c.resumeVerified && c.liveCheckPassed && c.lessonPlanApproved;
}
