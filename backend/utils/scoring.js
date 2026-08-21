// Pure scoring functions — no DB access, so these can run in a test without
// a database. Previously this exact combination formula was duplicated
// between submissions.js (grade-essay) and exams.js (regrade-on-edit); a
// change to one and not the other would have silently made them disagree.

// Weighted average of MCQ + essay, weighted by question count vs max points
// (matches the original ad-hoc formula both call sites used).
function computeFinalScore({ mcqCorrect, mcqTotal, essayEarned, essayMax }) {
  const mcqPoints   = mcqTotal;
  const essayPoints = essayMax;
  if (mcqPoints + essayPoints === 0) return 0;
  if (mcqPoints === 0) return Math.round((essayEarned / essayPoints) * 100);
  if (essayPoints === 0) return computeMcqScore(mcqCorrect, mcqTotal);

  const mcqPct   = (mcqCorrect / mcqPoints) * 100;
  const essayPct = (essayEarned / essayPoints) * 100;
  return Math.round((mcqPct * mcqPoints + essayPct * essayPoints) / (mcqPoints + essayPoints));
}

// mcqTotal === 0 (an all-essay exam) scores 100 on the MCQ portion by
// convention, matching the original submit-time grading behavior.
function computeMcqScore(mcqCorrect, mcqTotal) {
  return mcqTotal > 0 ? Math.round((mcqCorrect / mcqTotal) * 100) : 100;
}

// Grades a student's raw answers against the authoritative question list at
// submission time — the correct answers always come from `questions`
// (server-side), never trusted from the client's `answers` object.
function gradeSubmission(questions, answers) {
  let mcqCorrect = 0, mcqTotal = 0;
  let essayTotal = 0, essayMax = 0;

  const review = questions.map(q => {
    const chosen = answers[q.id];
    if (q.type === 'mcq' || q.type === 'truefalse') {
      mcqTotal++;
      const isCorrect = chosen !== undefined && Number(chosen) === q.correct;
      if (isCorrect) mcqCorrect++;
      return {
        questionId: q.id, type: 'mcq',
        question: q.text, options: q.options,
        correct: q.correct,
        chosen: chosen !== undefined ? Number(chosen) : null,
        isCorrect,
      };
    }
    essayTotal++;
    essayMax += q.max_score || 10;
    return {
      questionId: q.id, type: 'essay',
      question: q.text,
      maxScore: q.max_score || 10,
      answer: chosen || '',
      earnedScore: null,
      comment: '',
      graded: false,
    };
  });

  const mcqScore = computeMcqScore(mcqCorrect, mcqTotal);
  const gradingStatus = essayTotal > 0 ? 'auto_graded' : 'fully_graded';
  const finalScore = essayTotal === 0 ? mcqScore : null;

  return { review, mcqCorrect, mcqTotal, essayTotal, essayMax, mcqScore, gradingStatus, finalScore };
}

module.exports = { computeFinalScore, computeMcqScore, gradeSubmission };
