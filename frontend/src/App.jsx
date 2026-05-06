import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

import LoginPage            from './pages/LoginPage';
import RegisterPage         from './pages/RegisterPage';
import ForgotPasswordPage   from './pages/ForgotPasswordPage';
import ResetPasswordPage    from './pages/ResetPasswordPage';
import StudentDashboard     from './pages/StudentDashboard';
import TakeExamPage         from './pages/TakeExamPage';
import ExamResultPage       from './pages/ExamResultPage';
import TeacherDashboard     from './pages/TeacherDashboard';
import VideosPage           from './pages/VideosPage';
import LandingPage          from './pages/LandingPage';
import StudentMyReport          from './pages/StudentMyReport';
import PersonalExamPage         from './pages/PersonalExamPage';
import TakePersonalExamPage     from './pages/TakePersonalExamPage';
import PersonalExamResultPage   from './pages/PersonalExamResultPage';
import PaymentPage              from './pages/PaymentPage';
import PaymentResultPage        from './pages/PaymentResultPage';
import NotFoundPage             from './pages/NotFoundPage';

function RequireAuth({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  );
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
  );
}
