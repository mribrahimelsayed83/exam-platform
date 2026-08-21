import { describe, it, expect } from 'vitest';
import { computeFinalScore, computeMcqScore, gradeSubmission } from './scoring.js';

describe('computeMcqScore', () => {
  it('rounds correct/total to a percentage', () => {
    expect(computeMcqScore(3, 4)).toBe(75);
    expect(computeMcqScore(1, 3)).toBe(33); // rounds down from 33.3
    expect(computeMcqScore(2, 3)).toBe(67); // rounds up from 66.6
  });

  it('scores 100 for an all-essay exam (mcqTotal=0) by convention', () => {
    expect(computeMcqScore(0, 0)).toBe(100);
  });
});

describe('computeFinalScore', () => {
  it('is pure MCQ score when there are no essay points', () => {
    const score = computeFinalScore({ mcqCorrect: 3, mcqTotal: 4, essayEarned: 0, essayMax: 0 });
    expect(score).toBe(75);
  });

  it('is pure essay score when there are no MCQ questions', () => {
    const score = computeFinalScore({ mcqCorrect: 0, mcqTotal: 0, essayEarned: 8, essayMax: 10 });
    expect(score).toBe(80);
  });

  it('is 0 for a degenerate exam with neither MCQ nor essay points', () => {
    expect(computeFinalScore({ mcqCorrect: 0, mcqTotal: 0, essayEarned: 0, essayMax: 0 })).toBe(0);
  });

  it('weights MCQ and essay by question-count vs max-points respectively', () => {
    // 2 MCQ questions (both correct = 100%) + essay worth 10 points, scored 5/10 (50%)
    // weighted average = (100*2 + 50*10) / (2+10) = (200+500)/12 = 58.33 → 58
    const score = computeFinalScore({ mcqCorrect: 2, mcqTotal: 2, essayEarned: 5, essayMax: 10 });
    expect(score).toBe(58);
  });

  it('matches the known-good regression case from production debugging', () => {
    // A mixed exam: 4 MCQ (3 correct = 75%), essay worth 20 points scored 15 (75%)
    const score = computeFinalScore({ mcqCorrect: 3, mcqTotal: 4, essayEarned: 15, essayMax: 20 });
    expect(score).toBe(75);
  });
});

describe('gradeSubmission', () => {
  const questions = [
    { id: 1, type: 'mcq', text: 'Q1', options: ['a','b','c'], correct: 1 },
    { id: 2, type: 'truefalse', text: 'Q2', options: ['صح','خطأ'], correct: 0 },
    { id: 3, type: 'essay', text: 'Q3', max_score: 10 },
  ];

  it('grades MCQ/truefalse automatically and leaves essay ungraded', () => {
    const result = gradeSubmission(questions, { 1: 1, 2: 0, 3: 'my essay answer' });
    expect(result.mcqCorrect).toBe(2);
    expect(result.mcqTotal).toBe(2);
    expect(result.essayTotal).toBe(1);
    expect(result.essayMax).toBe(10);
    expect(result.mcqScore).toBe(100);
    expect(result.gradingStatus).toBe('auto_graded');
    expect(result.finalScore).toBeNull(); // can't finalize until essay is graded
  });

  it('finalizes immediately when there are no essay questions', () => {
    const mcqOnly = questions.filter(q => q.type !== 'essay');
    const result = gradeSubmission(mcqOnly, { 1: 1, 2: 0 });
    expect(result.gradingStatus).toBe('fully_graded');
    expect(result.finalScore).toBe(100);
  });

  it('never trusts a "correct" value from the client answers object', () => {
    // Only questions[].correct (server-side) determines correctness —
    // answers only supplies the student's chosen index.
    const result = gradeSubmission(questions, { 1: 0, 2: 0, 3: '' }); // wrong on Q1
    const q1Review = result.review.find(r => r.questionId === 1);
    expect(q1Review.isCorrect).toBe(false);
    expect(q1Review.correct).toBe(1); // still reports the real correct answer
  });

  it('treats a missing answer as unanswered, not correct', () => {
    const result = gradeSubmission(questions, { 2: 0 }); // Q1 unanswered
    const q1Review = result.review.find(r => r.questionId === 1);
    expect(q1Review.chosen).toBeNull();
    expect(q1Review.isCorrect).toBe(false);
  });
});
