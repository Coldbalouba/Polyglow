import { describe, expect, it } from "vitest";
import { PASS_MARK, publicQuiz, QUIZ, scoreQuiz } from "./skill-check";

const allCorrect = Object.fromEntries(QUIZ.map((q) => [q.id, q.answer]));

describe("scoreQuiz", () => {
  it("passes with every answer right", () => {
    expect(scoreQuiz(allCorrect)).toEqual({ score: 100, correct: QUIZ.length, total: QUIZ.length, passed: true });
  });
  it("fails with no answers", () => {
    expect(scoreQuiz({})).toMatchObject({ score: 0, passed: false });
  });
  it(`passes at exactly ${PASS_MARK}%`, () => {
    const answers = { ...allCorrect, q1: 0, q2: 0 }; // 6/8 = 75%
    expect(scoreQuiz(answers)).toMatchObject({ score: 75, passed: true });
  });
  it("fails just under the pass mark", () => {
    const answers = { ...allCorrect, q1: 0, q2: 0, q3: 0 }; // 5/8 = 63%
    expect(scoreQuiz(answers).passed).toBe(false);
  });
  it("never leaks answers to the browser", () => {
    for (const q of publicQuiz()) expect(q).not.toHaveProperty("answer");
  });
});
