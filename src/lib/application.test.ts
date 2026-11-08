import { describe, expect, it } from "vitest";
import { applicationSteps, canApprove, canSubmit, type ApplicationSnapshot } from "./application";

const complete: ApplicationSnapshot = {
  headline: "Native Spanish tutor for busy professionals",
  bio: "I have taught Spanish for eight years in Madrid and online, focusing on conversation for business learners.",
  hourlyRateCents: 2500,
  languageCount: 1,
  resumePath: "uploads/resume.pdf",
  skillCheckPassed: true,
  writingSample: "x".repeat(200),
  lessonPlan: "y".repeat(500),
  lessonPlanAiTool: "Claude",
};

describe("tutor application", () => {
  it("can be submitted when every step is complete", () => {
    expect(canSubmit(complete)).toBe(true);
  });
  it("requires a resume", () => {
    const steps = applicationSteps({ ...complete, resumePath: null });
    expect(steps.find((s) => s.key === "resume")?.done).toBe(false);
    expect(canSubmit({ ...complete, resumePath: null })).toBe(false);
  });
  it("requires passing the skill check and a writing sample", () => {
    expect(canSubmit({ ...complete, skillCheckPassed: false })).toBe(false);
    expect(canSubmit({ ...complete, writingSample: "too short" })).toBe(false);
  });
  it("requires an AI-assisted lesson plan with the tool named", () => {
    expect(canSubmit({ ...complete, lessonPlan: "short" })).toBe(false);
    expect(canSubmit({ ...complete, lessonPlanAiTool: "" })).toBe(false);
  });
  it("requires at least one language", () => {
    expect(canSubmit({ ...complete, languageCount: 0 })).toBe(false);
  });
});

describe("admin approval", () => {
  it("needs all three human checks", () => {
    expect(canApprove({ resumeVerified: true, liveCheckPassed: true, lessonPlanApproved: true })).toBe(true);
    expect(canApprove({ resumeVerified: true, liveCheckPassed: false, lessonPlanApproved: true })).toBe(false);
  });
});
