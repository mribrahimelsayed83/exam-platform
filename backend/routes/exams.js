const router = require('express').Router();
const pool   = require('../db/pool');
const auth   = require('../middleware/auth');
const staff  = auth.staff;
const { notifyGrade } = require('../utils/studentNotif');

router.get('/', auth('student'), async (req, res) => {
  try {
    const { grade, id: studentId } = req.user;
    const now = new Date().toISOString();
    const exams = await pool.query(
      `SELECT e.id, e.title, e.description, e.grade, e.duration, e.pass_score,
              e.starts_at, e.ends_at, e.created_at,
              COUNT(q.id)::int AS question_count,
              s.id AS submission_id, s.mcq_score, s.final_score,
              s.grading_status, s.submitted_at
       FROM exams e
       LEFT JOIN questions q  ON q.exam_id = e.id
       LEFT JOIN submissions s ON s.exam_id = e.id AND s.student_id = $2
       WHERE e.grade = $1 AND e.is_active = TRUE
         AND (e.starts_at IS NULL OR e.starts_at <= $3::timestamptz)
         AND (e.ends_at   IS NULL OR e.ends_at   >= $3::timestamptz)
       GROUP BY e.id, s.id
       ORDER BY e.position ASC, e.id ASC`,
      [grade, studentId, now]
    );
    res.json(exams.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

router.get('/all', staff, async (req, res) => {
  try {
    const exams = await pool.query(
      `SELECT e.id, e.title, e.description, e.grade, e.duration, e.pass_score,
              e.is_active, e.starts_at, e.ends_at, e.exam_comment, e.created_at,
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
router.get('/:id/questions/edit', staff, async (req, res) => {
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
router.put('/:id/questions', staff, async (req, res) => {
  const { questions } = req.body;
  if (!questions?.length)
    return res.status(400).json({ message: 'لازم يكون فيه سؤال واحد على الأقل' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Delete old questions
    await client.query('DELETE FROM questions WHERE exam_id=$1', [req.params.id]);
    // Insert new questions
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
          [req.params.id, q.text, q.type, JSON.stringify(opts), q.correct, i]
        );
      } else {
        if (!q.maxScore || q.maxScore < 1)
          throw new Error(`السؤال ${i+1}: الدرجة القصوى مطلوبة`);
        await client.query(
          `INSERT INTO questions (exam_id,text,type,max_score,position)
           VALUES ($1,$2,'essay',$3,$4)`,
          [req.params.id, q.text, q.maxScore, i]
        );
      }
    }
    await client.query('COMMIT');
    res.json({ message: 'تم تعديل الأسئلة' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ message: err.message || 'خطأ في السيرفر' });
  } finally {
    client.release();
  }
});

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

router.post('/', staff, async (req, res) => {
  const { title, description, grade, duration, passScore, questions, startsAt, endsAt, examComment,
          shuffleQuestions, shuffleOptions } = req.body;
  if (!title || !grade || !questions?.length)
    return res.status(400).json({ message: 'العنوان والصف والأسئلة مطلوبة' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const examRes = await client.query(
      `INSERT INTO exams (title,description,grade,duration,pass_score,starts_at,ends_at,exam_comment,shuffle_questions,shuffle_options)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [title, description||'', Number(grade), duration||30, passScore||50, startsAt||null, endsAt||null, examComment||'',
       !!shuffleQuestions, !!shuffleOptions]
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
router.put('/reorder', staff, async (req, res) => {
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

// ── PUT /exams/:id — edit exam (title, description, grade, duration, passScore, times, comment) ──
router.put('/:id', staff, async (req, res) => {
  const { title, description, grade, duration, passScore, startsAt, endsAt, examComment,
          shuffleQuestions, shuffleOptions } = req.body;
  if (!title || !grade) return res.status(400).json({ message: 'العنوان والصف مطلوبان' });
  try {
    await pool.query(
      `UPDATE exams SET title=$1, description=$2, grade=$3, duration=$4,
              pass_score=$5, starts_at=$6, ends_at=$7, exam_comment=$8,
              shuffle_questions=$9, shuffle_options=$10
       WHERE id=$11`,
      [title, description||'', Number(grade), duration||30,
       passScore||50, startsAt||null, endsAt||null, examComment||'',
       !!shuffleQuestions, !!shuffleOptions, req.params.id]
    );
    res.json({ message: 'تم تعديل الامتحان' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── PUT /exams/:id/comment — update exam comment ──────────────────────────
router.put('/:id/comment', staff, async (req, res) => {
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

router.put('/:id/toggle', staff, async (req, res) => {
  try {
    const r = await pool.query(
      'UPDATE exams SET is_active=NOT is_active WHERE id=$1 RETURNING is_active', [req.params.id]
    );
    res.json({ is_active: r.rows[0].is_active });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

router.delete('/:id', staff, async (req, res) => {
  try {
    await pool.query('DELETE FROM exams WHERE id=$1', [req.params.id]);
    res.json({ message: 'تم حذف الامتحان' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
