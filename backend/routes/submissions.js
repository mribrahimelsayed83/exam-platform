const router = require('express').Router();
const notify = require('../utils/teacherNotif');
const pool   = require('../db/pool');
const auth          = require('../middleware/auth');
const staff         = auth.staff;

// ── POST /submissions — student submits exam ──────────────────────────────
router.post('/', auth('student'), async (req, res) => {
  const { examId, answers } = req.body; // answers: { questionId: value }
  const studentId = req.user.id;
  if (!examId || !answers)
    return res.status(400).json({ message: 'بيانات ناقصة' });

  try {
    const existing = await pool.query(
      'SELECT id FROM submissions WHERE exam_id=$1 AND student_id=$2',
      [examId, studentId]
    );
    if (existing.rows.length)
      return res.status(409).json({ message: 'سبق وأديت هذا الامتحان' });

    const examRes = await pool.query('SELECT * FROM exams WHERE id=$1', [examId]);
    if (!examRes.rows[0]) return res.status(404).json({ message: 'الامتحان مش موجود' });
    const exam = examRes.rows[0];

    const questionsRes = await pool.query(
      'SELECT * FROM questions WHERE exam_id=$1 ORDER BY position', [examId]
    );
    const questions = questionsRes.rows;

    // ── Grade MCQ questions automatically ──
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
      } else {
        // essay — not graded yet
        essayTotal++;
        essayMax += q.max_score || 10;
        return {
          questionId: q.id, type: 'essay',
          question: q.text,
          maxScore: q.max_score || 10,
          answer: chosen || '',       // إجابة الطالب
          earnedScore: null,          // الدرجة (بيحطها المصحح)
          comment: '',                // تعليق المصحح
          graded: false,
        };
      }
    });

    const mcqScore = mcqTotal > 0 ? Math.round((mcqCorrect / mcqTotal) * 100) : 100;
    const gradingStatus = essayTotal > 0 ? 'auto_graded' : 'fully_graded';
    // finalScore = null لو في مقالي لسه — بيتحسب بعد تصحيح المقالي
    const finalScore = essayTotal === 0 ? mcqScore : null;

    const result = await pool.query(
      `INSERT INTO submissions
         (exam_id, student_id, mcq_score, mcq_correct, mcq_total,
          essay_total, essay_graded, essay_score, essay_max,
          final_score, grading_status, answers, review)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id, submitted_at`,
      [examId, studentId, mcqScore, mcqCorrect, mcqTotal,
       essayTotal, 0, null, essayMax,
       finalScore, gradingStatus,
       JSON.stringify(answers), JSON.stringify(review)]
    );

    // notify teacher
    const stuRes = await pool.query('SELECT name FROM students WHERE id=$1', [studentId]);
    const stuName = stuRes.rows[0]?.name || 'طالب';
    notify('submission',
      '📋 تسليم امتحان جديد',
      `${stuName} سلّم امتحان "${exam.title}" — الدرجة: ${finalScore !== null ? finalScore+'%' : 'قيد التصحيح'}`,
      'submission', result.rows[0].id
    );
    res.status(201).json({
      submissionId: result.rows[0].id,
      mcqScore, mcqCorrect, mcqTotal,
      essayTotal, essayMax,
      finalScore,
      passed: finalScore !== null ? finalScore >= exam.pass_score : null,
      passScore: exam.pass_score,
      gradingStatus,
      examComment: exam.exam_comment || '',
      review,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── GET /submissions/mine — student results list ──────────────────────────
router.get('/mine', auth('student'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.mcq_score, s.mcq_correct, s.mcq_total,
              s.essay_total, s.essay_graded, s.essay_score, s.essay_max,
              s.final_score, s.grading_status, s.submitted_at,
              e.title AS exam_title, e.pass_score, e.id AS exam_id,
              e.exam_comment
       FROM submissions s
       JOIN exams e ON e.id = s.exam_id
       WHERE s.student_id=$1
       ORDER BY s.submitted_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── GET /submissions/mine/:id — full detail for student (with review + comment) ──
router.get('/mine/:id', auth('student'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*,
              e.title AS exam_title, e.pass_score,
              e.exam_comment
       FROM submissions s
       JOIN exams e ON e.id = s.exam_id
       WHERE s.id=$1 AND s.student_id=$2`,
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'مش موجود' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── GET /submissions/my-report — full personal report for logged-in student ──
router.get('/my-report', auth('student'), async (req, res) => {
  const studentId = req.user.id;
  try {
    const [studentRes, subsRes, viewsRes] = await Promise.all([
      pool.query(
        `SELECT id, name, username, grade, phone, parent_phone, email, status, created_at
         FROM students WHERE id=$1`,
        [studentId]
      ),
      pool.query(
        `SELECT s.id, s.mcq_score, s.mcq_correct, s.mcq_total,
                s.essay_total, s.essay_graded, s.essay_score, s.essay_max,
                s.final_score, s.grading_status, s.submitted_at, s.review,
                e.title AS exam_title, e.pass_score, e.exam_comment, e.duration
         FROM submissions s
         JOIN exams e ON e.id = s.exam_id
         WHERE s.student_id=$1
         ORDER BY s.submitted_at DESC`,
        [studentId]
      ),
      pool.query(
        `SELECT vv.title, vv.viewed_at, vv.item_id
         FROM video_views vv
         WHERE vv.student_id=$1
         ORDER BY vv.viewed_at DESC`,
        [studentId]
      ),
    ]);
    if (!studentRes.rows[0]) return res.status(404).json({ message: 'الطالب مش موجود' });
    res.json({
      student:     studentRes.rows[0],
      submissions: subsRes.rows,
      video_views: viewsRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── GET /submissions — staff sees all ────────────────────────────────────
router.get('/', staff, async (req, res) => {
  try {
    const { exam_id, grade, grading_status } = req.query;
    let query = `
      SELECT s.id, s.mcq_score, s.mcq_total, s.essay_total, s.essay_graded,
             s.final_score, s.grading_status, s.submitted_at,
             st.name AS student_name, st.grade AS student_grade, st.username,
             e.title AS exam_title, e.pass_score, e.id AS exam_id
      FROM submissions s
      JOIN students st ON st.id=s.student_id
      JOIN exams    e  ON e.id=s.exam_id
      WHERE 1=1
    `;
    const params = [];
    if (exam_id)        { params.push(exam_id);        query += ` AND e.id=$${params.length}`; }
    if (grade)          { params.push(grade);           query += ` AND st.grade=$${params.length}`; }
    if (grading_status) { params.push(grading_status);  query += ` AND s.grading_status=$${params.length}`; }
    query += ' ORDER BY s.submitted_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── GET /submissions/:id — full detail for staff ──────────────────────────
router.get('/:id', staff, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*,
              st.name AS student_name, st.grade AS student_grade, st.phone, st.parent_phone,
              e.title AS exam_title, e.pass_score, e.exam_comment
       FROM submissions s
       JOIN students st ON st.id = s.student_id
       JOIN exams    e  ON e.id  = s.exam_id
       WHERE s.id=$1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'مش موجود' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── PUT /submissions/:id/grade-essay — staff grades essay questions ────────
router.put('/:id/grade-essay', staff, async (req, res) => {
  // body: { grades: { questionId: { score: 8, comment: 'كويس' } } }
  const { grades } = req.body;
  if (!grades) return res.status(400).json({ message: 'grades مطلوبة' });

  try {
    const subRes = await pool.query(
      'SELECT * FROM submissions WHERE id=$1', [req.params.id]
    );
    if (!subRes.rows[0]) return res.status(404).json({ message: 'مش موجود' });
    const sub = subRes.rows[0];

    const examRes = await pool.query('SELECT * FROM exams WHERE id=$1', [sub.exam_id]);
    const exam = examRes.rows[0];

    // Update review with grades
    const review = sub.review.map(r => {
      if (r.type !== 'essay') return r;
      const g = grades[r.questionId];
      if (!g) return r;
      return {
        ...r,
        earnedScore: Number(g.score),
        comment: g.comment || '',
        graded: true,
      };
    });

    const essayItems   = review.filter(r => r.type === 'essay');
    const gradedItems  = essayItems.filter(r => r.graded);
    const essayGraded  = gradedItems.length;
    const essayEarned  = gradedItems.reduce((sum, r) => sum + (r.earnedScore || 0), 0);
    const allGraded    = essayGraded === sub.essay_total;
    const gradingStatus = allGraded ? 'fully_graded' : 'partial';

    // ── Compute final score when fully graded ──
    // Formula: weighted average of MCQ + Essay
    // MCQ weight = mcq_total questions, Essay weight = essay_max points
    let finalScore = null;
    if (allGraded) {
      const mcqPoints   = sub.mcq_total;   // عدد أسئلة MCQ
      const essayPoints = sub.essay_max;   // مجموع الدرجات القصوى للمقالي

      if (mcqPoints + essayPoints === 0) {
        finalScore = 0;
      } else if (mcqPoints === 0) {
        // امتحان مقالي بحت
        finalScore = Math.round((essayEarned / essayPoints) * 100);
      } else if (essayPoints === 0) {
        // امتحان MCQ بحت
        finalScore = sub.mcq_score;
      } else {
        // مختلط — MCQ كنسبة + مقالي كنسبة، متوسط مرجّح بعدد الأسئلة
        const mcqPct   = (sub.mcq_correct / sub.mcq_total) * 100;
        const essayPct = (essayEarned / essayPoints) * 100;
        finalScore = Math.round((mcqPct * mcqPoints + essayPct * essayPoints) / (mcqPoints + essayPoints));
      }
    }

    await pool.query(
      `UPDATE submissions SET
         review=$1, essay_graded=$2, essay_score=$3,
         final_score=$4, grading_status=$5
       WHERE id=$6`,
      [JSON.stringify(review), essayGraded, essayEarned, finalScore, gradingStatus, req.params.id]
    );

    res.json({
      message: allGraded ? 'تم التصحيح الكامل' : 'تم حفظ التصحيح الجزئي',
      gradingStatus, essayGraded, total: sub.essay_total,
      finalScore,
      passed: finalScore !== null ? finalScore >= exam.pass_score : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── DELETE /submissions/:id/retake — staff deletes submission to allow retake
router.delete('/:id/retake', staff, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM submissions WHERE id=$1 RETURNING id, student_id, exam_id',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'الإجابة مش موجودة' });
    res.json({ message: 'تم السماح بإعادة الامتحان' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
