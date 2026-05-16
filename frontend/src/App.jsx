import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

const LoginPage            = lazy(() => import('./pages/LoginPage'));
const RegisterPage         = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage   = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage    = lazy(() => import('./pages/ResetPasswordPage'));
const LandingPage          = lazy(() => import('./pages/LandingPage'));
const StudentDashboard     = lazy(() => import('./pages/StudentDashboard'));
const TakeExamPage         = lazy(() => import('./pages/TakeExamPage'));
const ExamResultPage       = lazy(() => import('./pages/ExamResultPage'));
const TeacherDashboard     = lazy(() => import('./pages/TeacherDashboard'));
const VideosPage           = lazy(() => import('./pages/VideosPage'));
const StudentMyReport      = lazy(() => import('./pages/StudentMyReport'));
const PersonalExamPage         = lazy(() => import('./pages/PersonalExamPage'));
const TakePersonalExamPage     = lazy(() => import('./pages/TakePersonalExamPage'));
const PersonalExamResultPage   = lazy(() => import('./pages/PersonalExamResultPage'));
const PaymentPage              = lazy(() => import('./pages/PaymentPage'));
const PaymentResultPage        = lazy(() => import('./pages/PaymentResultPage'));
const NotFoundPage             = lazy(() => import('./pages/NotFoundPage'));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  );
}

function RequireAuth({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace/>;
  if (role) {
    const allowed = Array.isArray(role) ? role : [role];
    if (!allowed.includes(user.role)) return <Navigate to="/login" replace/>;
  }
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/"              element={<LandingPage />}/>
        <Route path="/login"            element={<LoginPage />}/>
        <Route path="/register"         element={<RegisterPage />}/>
        <Route path="/forgot-password"  element={<ForgotPasswordPage />}/>
        <Route path="/reset-password"   element={<ResetPasswordPage />}/>

        <Route path="/student" element={
          <RequireAuth role="student"><StudentDashboard/></RequireAuth>
        }/>
        <Route path="/student/exam/:id" element={
          <RequireAuth role="student"><TakeExamPage/></RequireAuth>
        }/>
        <Route path="/student/result/:id" element={
          <RequireAuth role="student"><ExamResultPage/></RequireAuth>
        }/>
        <Route path="/student/videos" element={
          <RequireAuth role="student"><VideosPage/></RequireAuth>
        }/>
        <Route path="/student/my-report" element={
          <RequireAuth role="student"><StudentMyReport/></RequireAuth>
        }/>
        <Route path="/student/personal-exam" element={
          <RequireAuth role="student"><PersonalExamPage/></RequireAuth>
        }/>
        <Route path="/student/personal-exam/take" element={
          <RequireAuth role="student"><TakePersonalExamPage/></RequireAuth>
        }/>
        <Route path="/student/personal-exam/result/:id" element={
          <RequireAuth role="student"><PersonalExamResultPage/></RequireAuth>
        }/>
        <Route path="/student/payment/:examId" element={
          <RequireAuth role="student"><PaymentPage/></RequireAuth>
        }/>
        <Route path="/student/payment-result" element={
          <RequireAuth role="student"><PaymentResultPage/></RequireAuth>
        }/>

        {/* المدرس والمساعد — نفس الـ dashboard */}
        <Route path="/teacher/*" element={
          <RequireAuth role={['teacher','assistant']}><TeacherDashboard/></RequireAuth>
        }/>

        <Route path="/" element={
          user
            ? <Navigate to={user.role==='student'?'/student':'/teacher'} replace/>
            : <Navigate to="/login" replace/>
        }/>
        <Route path="*" element={<NotFoundPage/>}/>
      </Routes>
    </Suspense>
  );
}
