import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export interface LessonPlanRequest {
  language: string;
  level: string; // e.g. "A2"
  topic: string;
  durationMin: number;
  goals?: string;
}

export interface LessonPlanDraft {
  text: string;
  tool: string; // recorded on the application so reviewers know the source
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

const SYSTEM = `You are an experienced language-teaching coach helping a tutor draft a lesson plan.
Write a practical plan the tutor can adapt. Use these sections with markdown headings:
Objective (one measurable can-do statement), Warm-up, Presentation, Controlled practice,
Free practice, Feedback & error correction, Homework, and Materials. Give timings that add up
to the lesson length. Keep student talking time high. Plain markdown, no preamble.`;

/**
 * Draft a lesson plan with Claude when ANTHROPIC_API_KEY is configured.
 * Without a key, returns a structured template so the flow still works in local dev.
 * Tutors are expected to review and edit the draft before submitting it.
 */
export async function draftLessonPlan(req: LessonPlanRequest): Promise<LessonPlanDraft> {
  if (!process.env.ANTHROPIC_API_KEY) return { text: templatePlan(req), tool: "TutConnect template (no AI key configured)" };

  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium" },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `Language: ${req.language}\nStudent level (CEFR): ${req.level}\nTopic: ${req.topic}\n` +
          `Lesson length: ${req.durationMin} minutes\nStudent goals: ${req.goals || "general conversation"}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The AI declined this request. Try rephrasing the topic.");
  }
  const text = response.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("\n")
    .trim();
  if (!text) throw new Error("The AI returned an empty draft. Please try again.");
  return { text, tool: `Claude (${MODEL})` };
}

export function templatePlan(req: LessonPlanRequest): string {
  const d = req.durationMin;
  const t = (share: number) => Math.max(3, Math.round(d * share));
  return `## Objective
By the end of this ${d}-minute ${req.language} lesson, a ${req.level} student can talk about "${req.topic}" using the target vocabulary and structures in a short conversation.

## Warm-up (${t(0.1)} min)
Personal questions connected to ${req.topic} to activate prior knowledge.

## Presentation (${t(0.2)} min)
Introduce 8–10 key words and one grammar pattern in context, using a short dialogue.

## Controlled practice (${t(0.2)} min)
Gap-fill and substitution drills; concept-checking questions.

## Free practice (${t(0.35)} min)
Role-play built around the student's goals: ${req.goals || "everyday conversation"}.

## Feedback & error correction (${t(0.1)} min)
Review noted errors, recast, and have the student self-correct.

## Homework
A short voice note or paragraph on ${req.topic} using today's vocabulary.

## Materials
Dialogue handout, vocabulary list, role-play cards.

_Edit this draft: add your own examples, check accuracy, and adapt it to your student._`;
}
