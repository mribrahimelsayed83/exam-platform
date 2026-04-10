# منصة الامتحانات الإلكترونية

**Stack:** React 18 + Tailwind CSS + Node.js + Express + PostgreSQL + JWT

---

## هيكل المشروع

```
exam-platform/
├── backend/
│   ├── db/
│   │   ├── pool.js        ← اتصال PostgreSQL
│   │   ├── schema.sql     ← إنشاء الجداول
│   │   └── seed.js        ← إنشاء حساب المدرس
│   ├── middleware/
│   │   └── auth.js        ← JWT middleware
│   ├── routes/
│   │   ├── auth.js        ← تسجيل دخول + تسجيل طلاب
│   │   ├── exams.js       ← CRUD الامتحانات
│   │   ├── submissions.js ← تسليم + عرض الإجابات
│   │   └── teacher.js     ← إحصائيات + طلاب + إعدادات
│   ├── .env.example
│   └── server.js
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── shared/
    │   │   │   └── Navbar.jsx
    │   │   └── teacher/
    │   │       ├── TeacherHome.jsx
    │   │       ├── CreateExam.jsx
    │   │       ├── ExamsList.jsx
    │   │       ├── SubmissionsList.jsx
    │   │       ├── StudentsList.jsx
    │   │       └── TeacherSettings.jsx
    │   ├── context/
    │   │   └── AuthContext.jsx
    │   ├── pages/
    │   │   ├── LoginPage.jsx
    │   │   ├── RegisterPage.jsx
    │   │   ├── StudentDashboard.jsx
    │   │   ├── TakeExamPage.jsx
    │   │   ├── ExamResultPage.jsx
    │   │   └── TeacherDashboard.jsx
    │   ├── utils/
    │   │   └── api.js     ← Axios instance
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css      ← Tailwind + custom components
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── postcss.config.js
```

---

## الإعداد خطوة بخطوة

### 1. إنشاء قاعدة البيانات

```bash
# افتح psql وأنشئ الـ database
psql -U postgres
CREATE DATABASE exam_platform;
\q
```

### 2. إعداد الـ Backend

```bash
cd backend

# انسخ ملف الإعدادات
cp .env.example .env

# عدّل .env وحط بيانات الـ database
# DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/exam_platform
# JWT_SECRET=اكتب_اي_كلام_سري_طويل_هنا

# ثبت الـ packages
npm install

# أنشئ الجداول وحساب المدرس
node db/seed.js

# شغّل السيرفر
npm run dev
```

### 3. إعداد الـ Frontend

```bash
cd frontend

# ثبت الـ packages
npm install

# شغّل
npm run dev
```

### 4. افتح المتصفح

```
http://localhost:5173
```

---

## بيانات الدخول الافتراضية

| الدور   | اسم المستخدم | كلمة المرور  |
|---------|-------------|--------------|
| مدرس   | teacher     | teacher123   |

> ⚠️ غيّر كلمة المرور من `.env` قبل الـ deployment

---

## الـ API Endpoints

| Method | Endpoint                     | الوصف                    | الصلاحية |
|--------|------------------------------|--------------------------|----------|
| POST   | /api/auth/register           | تسجيل طالب جديد         | عام      |
| POST   | /api/auth/student/login      | دخول طالب                | عام      |
| POST   | /api/auth/teacher/login      | دخول مدرس                | عام      |
| GET    | /api/auth/me                 | بيانات المستخدم الحالي   | JWT      |
| GET    | /api/exams                   | امتحانات الطالب          | student  |
| GET    | /api/exams/all               | كل الامتحانات            | teacher  |
| GET    | /api/exams/:id/questions     | أسئلة امتحان (للحل)      | student  |
| POST   | /api/exams                   | إنشاء امتحان             | teacher  |
| PUT    | /api/exams/:id/toggle        | تفعيل/إيقاف امتحان      | teacher  |
| DELETE | /api/exams/:id               | حذف امتحان               | teacher  |
| POST   | /api/submissions             | تسليم إجابات             | student  |
| GET    | /api/submissions/mine        | نتائج الطالب             | student  |
| GET    | /api/submissions             | كل الإجابات              | teacher  |
| GET    | /api/submissions/:id         | تفاصيل إجابة             | teacher  |
| GET    | /api/teacher/students        | قائمة الطلاب             | teacher  |
| GET    | /api/teacher/stats           | إحصائيات                 | teacher  |
| GET    | /api/teacher/settings        | إعدادات المدرس           | teacher  |
| PUT    | /api/teacher/settings        | حفظ الإعدادات            | teacher  |
