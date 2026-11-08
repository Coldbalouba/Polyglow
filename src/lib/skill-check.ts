/**
 * Automated part of the tutor skill check: a short teaching-methodology quiz.
 * Tutors must score at least PASS_MARK percent. The language-specific part
 * (a written sample + a live call) is reviewed by a human admin.
 */

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  answer: number; // index into options
}

export const PASS_MARK = 75;

export const QUIZ: QuizQuestion[] = [
  {
    id: "q1",
    prompt: "A beginner keeps making the same verb conjugation mistake while speaking. What is usually the best first response?",
    options: [
      "Stop them immediately every time and explain the rule in detail",
      "Recast the sentence correctly and note the pattern to practise later",
      "Ignore it entirely so they stay confident",
      "Switch the lesson to a grammar worksheet",
    ],
    answer: 1,
  },
  {
    id: "q2",
    prompt: "Which lesson objective is the most measurable?",
    options: [
      "Students will understand the past tense",
      "Students will get better at speaking",
      "Students will order a meal in a restaurant using three polite request forms",
      "Students will learn a lot of vocabulary",
    ],
    answer: 2,
  },
  {
    id: "q3",
    prompt: "In a 60-minute conversational lesson, roughly how much of the time should the student be speaking?",
    options: ["About 10%", "About 25%", "About 60–70%", "100% — the tutor should never speak"],
    answer: 2,
  },
  {
    id: "q4",
    prompt: "A student's goal is a job interview in 6 weeks. What should you do first?",
    options: [
      "Start the standard textbook from chapter 1",
      "Run a needs analysis: level check, role, likely questions, and schedule",
      "Give them a list of 500 words to memorise",
      "Tell them six weeks is not enough time",
    ],
    answer: 1,
  },
  {
    id: "q5",
    prompt: "What does CEFR level B1 roughly describe?",
    options: [
      "Can only use isolated words",
      "Can deal with most everyday situations and describe experiences simply",
      "Can understand virtually everything heard or read with ease",
      "Native-like academic fluency",
    ],
    answer: 1,
  },
  {
    id: "q6",
    prompt: "Which is the best way to check comprehension after explaining something?",
    options: [
      "Ask “Do you understand?”",
      "Ask a concept-checking question that requires using the idea",
      "Repeat the explanation louder",
      "Move on; they will ask if confused",
    ],
    answer: 1,
  },
  {
    id: "q7",
    prompt: "An AI tool drafted your lesson plan. What is your responsibility before teaching it?",
    options: [
      "None — AI output is always correct",
      "Check accuracy, adapt it to the student's level and goals, and make it your own",
      "Send it to the student as homework instead",
      "Only check the spelling",
    ],
    answer: 1,
  },
  {
    id: "q8",
    prompt: "What is spaced repetition mainly used for?",
    options: [
      "Making lessons longer",
      "Reviewing material at increasing intervals so it moves into long-term memory",
      "Repeating the same lesson every day",
      "Grading homework",
    ],
    answer: 1,
  },
];

export interface QuizResult {
  score: number; // percentage 0-100
  correct: number;
  total: number;
  passed: boolean;
}

/** Score a set of answers keyed by question id. Unanswered questions count as wrong. */
export function scoreQuiz(answers: Record<string, number | undefined>, quiz: QuizQuestion[] = QUIZ): QuizResult {
  const total = quiz.length;
  const correct = quiz.filter((q) => answers[q.id] === q.answer).length;
  const score = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { score, correct, total, passed: score >= PASS_MARK };
}

/** Quiz without answers, safe to send to the browser. */
export function publicQuiz() {
  return QUIZ.map(({ id, prompt, options }) => ({ id, prompt, options }));
}
