const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
const auth    = require('../middleware/auth');

// GET /api/personal-exam/questions
// Returns all distinct wrong MCQ questions for the logged-in student (from past submissions)
router.get('/questions', auth('student'), async (req, res) => {
  try {
    const studentId = req.user.id;

    const { rows: submissions } = await pool.query(
      `SELECT review FROM submissions WHERE student_id = $1 AND review IS NOT NULL`,
      [studentId]
    );

    // Collect wrong questions (deduplicated by questionId — last seen wins)
    const wrongMap = new Map();
    for (const sub of submissions) {
      const raw = sub.review;
      const mcqList = Array.isArray(raw)
        ? raw.filter(q => q.type === 'mcq')
        : (raw && Array.isArray(raw.MCQ) ? raw.MCQ : []);
      for (const q of mcqList) {
        if (!q.isCorrect && q.questionId) {
          wrongMap.set(q.questionId, {
            id:      q.questionId,
            text:    q.question,
            type:    'mcq',
            options: q.options,
            correct: q.correct,
          });
        }
      }
    }

    // Convert to array and shuffle (Fisher-Yates)
    let questions = Array.from(wrongMap.values());
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }

    res.json({ questions, total: questions.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// POST /api/personal-exam/submit
// Grade and save a personal exam attempt
router.post('/submit', auth('student'), async (req, res) => {
  try {
    const studentId = req.user.id;
    const { questions, answers } = req.body;
    // questions: [{id, text, options, correct}]
    // answers:   {questionId: chosenIndex}

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: 'لا توجد أسئلة' });
    }

    let correct = 0;
    const review = [];

    for (const q of questions) {
      const chosen    = answers[q.id] ?? answers[String(q.id)];
      const isCorrect = chosen === q.correct;
      if (isCorrect) correct++;
      review.push({
        questionId: q.id,
        question:   q.text,
        options:    q.options,
        correct:    q.correct,
        chosen:     chosen ?? null,
        isCorrect,
      });
    }

    const total = questions.length;
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;

    const { rows } = await pool.query(
      `INSERT INTO personal_exam_submissions
         (student_id, answers, review, score, total, correct_count)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [studentId, JSON.stringify(answers), JSON.stringify(review), score, total, correct]
    );

    res.json({ submissionId: rows[0].id, score, correct, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في التسليم' });
  }
});

// GET /api/personal-exam/history
// Last 10 personal exam attempts for the logged-in student
router.get('/history', auth('student'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, score, total, correct_count, submitted_at
       FROM personal_exam_submissions
       WHERE student_id = $1
       ORDER BY submitted_at DESC
       LIMIT 10`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// GET /api/personal-exam/result/:id
// Full result detail (with review) for one attempt
router.get('/result/:id', auth('student'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM personal_exam_submissions
       WHERE id = $1 AND student_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'غير موجود' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

module.exports = router;
