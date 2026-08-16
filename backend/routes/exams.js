const router = require('express').Router();
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');
const staff  = auth.staff;
const perm   = auth.permission('exams');
const { notifyGrade } = require('../utils/studentNotif');

router.get('/', auth('student'), async (req, res) => {
  try {
    const { grade, id: studentId } = req.user;
    const now = new Date().toISOString();
    const exams = await pool.query(
      `SELECT e.id, e.title, e.description, e.grade, e.duration, e.pass_score,
              e.starts_at, e.ends_at, e.created_at, e.price, e.require_previous_exams,
              e.position,
              COUNT(q.id)::int AS question_count,
              s.id AS submission_id, s.mcq_score, s.final_score,
              s.grading_status, s.submitted_at,
              (e.price > 0 AND p.id IS NULL) AS needs_payment,
              (p.status = 'paid') AS is_paid
       FROM exams e
       LEFT JOIN questions q    ON q.exam_id = e.id
       LEFT JOIN submissions s  ON s.exam_id = e.id AND s.student_id = $2
       LEFT JOIN payments p     ON p.exam_id = e.id AND p.student_id = $2 AND p.status = 'paid'
       WHERE e.grade = $1 AND e.is_active = TRUE
         AND (e.starts_at IS NULL OR e.starts_at <= $3::timestamptz)
         AND (e.ends_at   IS NULL OR e.ends_at   >= $3::timestamptz)
       GROUP BY e.id, s.id, p.id
       ORDER BY e.position ASC, e.id ASC`,
      [grade, studentId, now]
    );
    const rows = exams.rows;
    // Mark each exam as locked if require_previous_exams=true and any earlier exam is incomplete
    const completedIds = new Set(rows.filter(e => e.submission_id).map(e => e.id));
    let anythingIncomplete = false;
    const result = rows.map(e => {
      let locked = false;
      if (e.require_previous_exams) {
        locked = anythingIncomplete;
      }
      if (!e.submission_id) anythingIncomplete = true;
      return { ...e, locked };
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

router.get('/all', staff, perm, async (req, res) => {
  try {
    const exams = await pool.query(
      `SELECT e.id, e.title, e.description, e.grade, e.duration, e.pass_score,
              e.is_active, e.starts_at, e.ends_at, e.exam_comment, e.created_at,
              e.price, e.shuffle_questions, e.shuffle_options,
              COUNT(DISTINCT q.id)::int  AS question_count,
              COUNT(DISTINCT s.id)::int  AS submission_count,
              COUNT(DISTINCT q.id) FILTER (WHERE q.type='essay')::int AS essay_count
       FROM exams e
       LEFT JOIN questions q  ON q.exam_id = e.id
       LEFT JOIN submissions s ON s.exam_id = e.id
       GROUP BY e.id ORDER BY e.created_at DESC`
    );
    res.json(exams.rows);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── GET /exams/:id/questions/edit — staff gets questions with correct answers ──
router.get('/:id/questions/edit', staff, perm, async (req, res) => {
  try {
    const questions = await pool.query(
      `SELECT id, text, type, options, correct, max_score, position
       FROM questions WHERE exam_id=$1 ORDER BY position`,
      [req.params.id]
    );
    res.json(questions.rows);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── PUT /exams/:id/questions — staff replaces all questions ───────────────
// Existing question rows are UPDATEd in place (id preserved) instead of
// delete+reinsert, so that already-submitted answers (keyed by question id)
// stay matchable — this is what lets regradeSubmissionsForExam() below
// recompute scores after the teacher fixes a wrong correct-answer.
router.put('/:id/questions', staff, perm, async (req, res) => {
  const { questions } = req.body;
  if (!questions?.length)
    return res.status(400).json({ message: 'لازم يكون فيه سؤال واحد على الأقل' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: existing } = await client.query(
      'SELECT id FROM questions WHERE exam_id=$1', [req.params.id]
    );
    const existingIds = new Set(existing.map(r => r.id));
    const keptIds = new Set();

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text) throw new Error(`السؤال ${i+1}: النص مطلوب`);

      let opts = null, correct = null, maxScore = null;
      if (q.type === 'mcq' || q.type === 'truefalse') {
        opts = q.type === 'truefalse' ? ['صح','خطأ'] : q.options;
        if (!opts || opts.length < 2 || q.correct === undefined)
          throw new Error(`السؤال ${i+1}: ناقص`);
        correct = q.correct;
      } else {
        if (!q.maxScore || q.maxScore < 1)
          throw new Error(`السؤال ${i+1}: الدرجة القصوى مطلوبة`);
        maxScore = q.maxScore;
      }

      if (q.id && existingIds.has(q.id)) {
        keptIds.add(q.id);
        await client.query(
          `UPDATE questions SET text=$1, type=$2, options=$3, correct=$4, max_score=$5, position=$6
           WHERE id=$7`,
          [q.text, q.type, opts ? JSON.stringify(opts) : null, correct, maxScore, i, q.id]
        );
      } else {
        const { rows: [inserted] } = await client.query(
          `INSERT INTO questions (exam_id,text,type,options,correct,max_score,position)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [req.params.id, q.text, q.type, opts ? JSON.stringify(opts) : null, correct, maxScore, i]
        );
        keptIds.add(inserted.id);
      }
    }

    const removedIds = [...existingIds].filter(id => !keptIds.has(id));
    if (removedIds.length) {
      await client.query('DELETE FROM questions WHERE id = ANY($1::int[])', [removedIds]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(400).json({ message: err.message || 'خطأ في السيرفر' });
  } finally {
    client.release();
  }

  try {
    await regradeSubmissionsForExam(req.params.id);
  } catch (err) {
    console.error('Regrade error:', err);
  }
  res.json({ message: 'تم تعديل الأسئلة' });
});

// ── Recompute existing submissions' MCQ scores against updated correct
// answers — runs after questions are edited, even for already-graded exams.
async function regradeSubmissionsForExam(examId) {
  const { rows: qRows } = await pool.query(
    `SELECT id, text, options, correct FROM questions WHERE exam_id=$1 AND type IN ('mcq','truefalse')`,
    [examId]
  );
  const qMap = new Map(qRows.map(q => [q.id, q]));

  const { rows: subs } = await pool.query(
    `SELECT id, review, mcq_total, essay_total, essay_score, essay_max, grading_status
     FROM submissions WHERE exam_id=$1`,
    [examId]
  );

  for (const sub of subs) {
    const newReview = sub.review.map(r => {
      if (r.type !== 'mcq') return r;
      const q = qMap.get(r.questionId);
      if (!q) return r; // question deleted since submission — keep original snapshot
      const isCorrect = r.chosen !== null && r.chosen !== undefined && Number(r.chosen) === q.correct;
      return { ...r, question: q.text, options: q.options, correct: q.correct, isCorrect };
    });

    const mcqCorrect = newReview.filter(r => r.type === 'mcq' && r.isCorrect).length;
    const mcqScore = sub.mcq_total > 0 ? Math.round((mcqCorrect / sub.mcq_total) * 100) : 100;

    let finalScore = null;
    if (sub.essay_total === 0) {
      finalScore = mcqScore;
    } else if (sub.grading_status === 'fully_graded') {
      const mcqPoints = sub.mcq_total, essayPoints = sub.essay_max, essayEarned = sub.essay_score || 0;
      if (mcqPoints + essayPoints === 0) finalScore = 0;
      else if (mcqPoints === 0) finalScore = Math.round((essayEarned / essayPoints) * 100);
      else if (essayPoints === 0) finalScore = mcqScore;
      else {
        const mcqPct = (mcqCorrect / mcqPoints) * 100;
        const essayPct = (essayEarned / essayPoints) * 100;
        finalScore = Math.round((mcqPct * mcqPoints + essayPct * essayPoints) / (mcqPoints + essayPoints));
      }
    }
    // else: essay still pending grading — final_score stays null until graded,
    // and grade-essay will read the updated mcq_correct/mcq_score below then.

    await pool.query(
      `UPDATE submissions SET review=$1, mcq_correct=$2, mcq_score=$3, final_score=$4 WHERE id=$5`,
      [JSON.stringify(newReview), mcqCorrect, mcqScore, finalScore, sub.id]
    );
  }
}

router.get('/:id/questions', auth('student'), async (req, res) => {
  try {
    const { id: studentId, grade } = req.user;
    const now = new Date().toISOString();
    const examRes = await pool.query(
      `SELECT * FROM exams WHERE id=$1 AND grade=$2 AND is_active=TRUE
         AND (starts_at IS NULL OR starts_at <= $3::timestamptz)
         AND (ends_at   IS NULL OR ends_at   >= $3::timestamptz)`,
      [req.params.id, grade, now]
    );
    if (!examRes.rows[0])
      return res.status(404).json({ message: 'الامتحان مش متاح دلوقتي أو مش لصفك' });

    const examRow = examRes.rows[0];

    // Prerequisite guard — check if student completed all previous exams
    if (examRow.require_previous_exams) {
      const { rows: incomplete } = await pool.query(
        `SELECT e.id FROM exams e
         LEFT JOIN submissions s ON s.exam_id = e.id AND s.student_id = $1
         WHERE e.grade = $2 AND e.is_active = TRUE AND s.id IS NULL
           AND (e.position < $3 OR (e.position = $3 AND e.id < $4))`,
        [studentId, examRow.grade, examRow.position, examRow.id]
      );
      if (incomplete.length > 0)
        return res.status(403).json({ message: 'يجب إكمال جميع الامتحانات السابقة أولاً' });
    }

    // Payment guard — block access if exam has a price and student hasn't paid
    if (examRow.price && examRow.price > 0) {
      const { rows: payRows } = await pool.query(
        `SELECT id FROM payments WHERE exam_id=$1 AND student_id=$2 AND status='paid'`,
        [req.params.id, studentId]
      );
      if (!payRows.length)
        return res.status(402).json({ message: 'هذا الامتحان مدفوع — يرجى الدفع أولاً', needsPayment: true, price: examRow.price });
    }

    const subCheck = await pool.query(
      'SELECT id FROM submissions WHERE exam_id=$1 AND student_id=$2',
      [req.params.id, studentId]
    );
    if (subCheck.rows.length)
      return res.status(409).json({ message: 'سبق وأديت هذا الامتحان' });

    const questions = await pool.query(
      `SELECT id, text, type, options, max_score, position
       FROM questions WHERE exam_id=$1 ORDER BY position`,
      [req.params.id]
    );
    const exam = examRes.rows[0];
    res.json({
      exam: { id: exam.id, title: exam.title, description: exam.description,
              duration: exam.duration, ends_at: exam.ends_at,
              shuffle_questions: !!exam.shuffle_questions,
              shuffle_options:   !!exam.shuffle_options },
      questions: questions.rows,
    });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

router.post('/', staff, perm, async (req, res) => {
  const { title, description, grade, duration, passScore, questions, startsAt, endsAt, examComment,
          shuffleQuestions, shuffleOptions, price, requirePreviousExams } = req.body;
  if (!title || !grade || !questions?.length)
    return res.status(400).json({ message: 'العنوان والصف والأسئلة مطلوبة' });
  if (questions.length > 200)
    return res.status(400).json({ message: 'الحد الأقصى 200 سؤال في الامتحان' });

  const validPrice     = Math.max(0, Number(price) || 0);
  const validPassScore = Math.min(100, Math.max(0, Number(passScore) || 50));
  const validDuration  = Math.max(1, Number(duration) || 30);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const examRes = await client.query(
      `INSERT INTO exams (title,description,grade,duration,pass_score,starts_at,ends_at,exam_comment,shuffle_questions,shuffle_options,price,require_previous_exams)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [title, description||'', Number(grade), validDuration, validPassScore, startsAt||null, endsAt||null, examComment||'',
       !!shuffleQuestions, !!shuffleOptions, validPrice, !!requirePreviousExams]
    );
    const examId = examRes.rows[0].id;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text) throw new Error(`السؤال ${i+1}: النص مطلوب`);
      if (q.type === 'mcq' || q.type === 'truefalse') {
        const opts = q.type === 'truefalse' ? ['صح','خطأ'] : q.options;
        if (!opts || opts.length < 2 || q.correct === undefined)
          throw new Error(`السؤال ${i+1}: ناقص`);
        await client.query(
          `INSERT INTO questions (exam_id,text,type,options,correct,position)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [examId, q.text, q.type, JSON.stringify(opts), q.correct, i]
        );
      } else {
        if (!q.maxScore || q.maxScore < 1)
          throw new Error(`السؤال ${i+1}: الدرجة القصوى للمقالي مطلوبة`);
        await client.query(
          `INSERT INTO questions (exam_id,text,type,max_score,position)
           VALUES ($1,$2,'essay',$3,$4)`,
          [examId, q.text, q.maxScore, i]
        );
      }
    }
    await client.query('COMMIT');
    notifyGrade(Number(grade), '📝 امتحان جديد', `تم إضافة امتحان جديد: ${title}`);
    res.status(201).json({ message: 'تم إنشاء الامتحان', examId });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ message: err.message || 'خطأ في السيرفر' });
  } finally {
    client.release();
  }
});

// ── PUT /exams/reorder — reorder exams by teacher ──────────────────────────
router.put('/reorder', staff, perm, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ message: 'ids مطلوب' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < ids.length; i++) {
      await client.query('UPDATE exams SET position=$1 WHERE id=$2', [i, ids[i]]);
    }
    await client.query('COMMIT');
    res.json({ message: 'تم الترتيب' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'خطأ في الترتيب' });
  } finally { client.release(); }
});

// ── PUT /exams/:id — edit exam ────────────────────────────────────────────
router.put('/:id', staff, perm, async (req, res) => {
  const { title, description, grade, duration, passScore, startsAt, endsAt, examComment,
          shuffleQuestions, shuffleOptions, price, requirePreviousExams } = req.body;
  if (!title || !grade) return res.status(400).json({ message: 'العنوان والصف مطلوبان' });
  const validPrice     = Math.max(0, Number(price) || 0);
  const validPassScore = Math.min(100, Math.max(0, Number(passScore) || 50));
  const validDuration  = Math.max(1, Number(duration) || 30);
  try {
    await pool.query(
      `UPDATE exams SET title=$1, description=$2, grade=$3, duration=$4,
              pass_score=$5, starts_at=$6, ends_at=$7, exam_comment=$8,
              shuffle_questions=$9, shuffle_options=$10, price=$11,
              require_previous_exams=$12
       WHERE id=$13`,
      [title, description||'', Number(grade), validDuration,
       validPassScore, startsAt||null, endsAt||null, examComment||'',
       !!shuffleQuestions, !!shuffleOptions, validPrice,
       !!requirePreviousExams, req.params.id]
    );
    res.json({ message: 'تم تعديل الامتحان' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── PUT /exams/:id/comment — update exam comment ──────────────────────────
router.put('/:id/comment', staff, perm, async (req, res) => {
  try {
    await pool.query(
      'UPDATE exams SET exam_comment=$1 WHERE id=$2',
      [req.body.examComment || '', req.params.id]
    );
    res.json({ message: 'تم حفظ التعليق' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

router.put('/:id/toggle', staff, perm, async (req, res) => {
  try {
    const r = await pool.query(
      'UPDATE exams SET is_active=NOT is_active WHERE id=$1 RETURNING is_active', [req.params.id]
    );
    res.json({ is_active: r.rows[0].is_active });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

router.delete('/:id', auth('teacher'), async (req, res) => {
  try {
    await pool.query('DELETE FROM exams WHERE id=$1', [req.params.id]);
    res.json({ message: 'تم حذف الامتحان' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
