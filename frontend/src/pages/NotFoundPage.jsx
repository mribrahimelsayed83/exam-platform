import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4" dir="rtl">
      <div className="text-center max-w-md">
        <div className="text-8xl font-extrabold text-blue-600 mb-2">404</div>
        <div className="text-6xl mb-6">🔍</div>
        <h1 className="text-2xl font-extrabold text-slate-800 mb-3">الصفحة مش موجودة</h1>
        <p className="text-slate-500 mb-8">يبدو إن الرابط ده غلط أو الصفحة اتحذفت.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
          >
            🏠 الصفحة الرئيسية
          </button>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 transition-colors"
          >
            ← ارجع للخلف
          </button>
        </div>
      </div>
    </div>
  );
}
