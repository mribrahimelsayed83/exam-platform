import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/shared/Navbar';

// PayMob redirects here after payment with query params:
// ?success=true/false&order_id=...&transaction_id=...
export default function PaymentResultPage() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const [countdown, setCountdown] = useState(5);

  const success    = params.get('success') === 'true';
  const orderId    = params.get('order_id') || params.get('id');

  // Auto-redirect after success
  useEffect(() => {
    if (!success) return;
    const t = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(t); navigate('/student?tab=exams'); }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [success, navigate]);

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />
      <div className="max-w-md mx-auto px-4 py-16 text-center">

        {success ? (
          <div className="card">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-2xl font-extrabold text-emerald-600 mb-2">تم الدفع بنجاح!</h1>
            <p className="text-slate-500 mb-2">تم تفعيل وصولك للامتحان</p>
            {orderId && (
              <p className="text-xs text-slate-400 mb-6">رقم الطلب: {orderId}</p>
            )}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
              <p className="text-emerald-700 text-sm font-semibold">
                سيتم تحويلك للامتحانات خلال {countdown} ثانية...
              </p>
            </div>
            <button onClick={() => navigate('/student?tab=exams')}
              className="btn-primary btn-block">
              اذهب للامتحانا�� الآن
            </button>
          </div>
        ) : (
          <div className="card">
            <div className="text-6xl mb-4">❌</div>
            <h1 className="text-2xl font-extrabold text-red-600 mb-2">فشل الدفع</h1>
            <p className="text-slate-500 mb-6">
              لم يتم إتمام عملية الدفع — يمكنك المحاولة مرة أخرى
            </p>
            <div className="flex gap-3">
              <button onClick={() => navigate(-1)} className="btn-primary flex-1">
                حاول مرة أخرى
              </button>
              <button onClick={() => navigate('/student')} className="btn-secondary flex-1">
                الرئيسية
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
