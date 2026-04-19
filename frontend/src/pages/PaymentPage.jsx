import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/shared/Navbar';
import api from '../utils/api';

export default function PaymentPage() {
  const { examId } = useParams();
  const navigate   = useNavigate();

  const [exam,      setExam]      = useState(null);
  const [iframeUrl, setIframeUrl] = useState('');
  const [loading,   setLoading]   = useState(true);
  const [initiating, setInitiating] = useState(false);
  const [error,     setError]     = useState('');

  // Load exam info + payment status
  useEffect(() => {
    api.get(`/payments/check/${examId}`)
      .then(r => {
        if (r.data.paid) {
          navigate(`/student/exam/${examId}`, { replace: true });
        } else {
          setExam({ price: r.data.price });
          setLoading(false);
        }
      })
      .catch(() => { setError('خطأ في تحميل البيانات'); setLoading(false); });
  }, [examId, navigate]);

  const handlePay = async () => {
    setInitiating(true);
    setError('');
    try {
      const { data } = await api.post('/payments/initiate', { examId: Number(examId) });
      setIframeUrl(data.iframeUrl);
      setExam(d => ({ ...d, title: data.title, amount: data.amount }));
    } catch (err) {
      setError(err.response?.data?.message || 'خطأ في بدء عملية الدفع');
    } finally {
      setInitiating(false);
    }
  };

  if (loading) return <Spinner />;

  // ── PayMob iframe ─────────────���────────────────────────────────────────────
  if (iframeUrl) {
    return (
      <div className="min-h-screen bg-slate-100">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-extrabold text-slate-800">💳 إتمام الدفع</h2>
              <button onClick={() => setIframeUrl('')}
                className="btn-ghost btn-sm text-slate-400">✕ إلغاء</button>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4 text-sm text-orange-700 flex items-center gap-2">
              <span>🔒</span>
              <span>صفحة دفع آمنة — مدعوم من PayMob</span>
            </div>
            <iframe
              src={iframeUrl}
              className="w-full rounded-xl border border-slate-200"
              style={{ height: '600px' }}
              title="PayMob Payment"
              allow="payment"
            />
            <p className="text-xs text-slate-400 text-center mt-3">
              بعد إتمام الدفع سيتم تفعيل الامتحان تلقائياً خلال لحظات
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Payment confirmation screen ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />
      <div className="max-w-md mx-auto px-4 py-12">
        <button onClick={() => navigate('/student?tab=exams')}
          className="text-slate-500 hover:text-slate-800 text-sm mb-5 flex items-center gap-1">
          ← رجوع للامتحانات
        </button>

        <div className="card text-center">
          <div className="text-6xl mb-4">💳</div>
          <h1 className="text-xl font-extrabold text-slate-800 mb-2">الدفع مطلوب</h1>
          <p className="text-slate-500 mb-6 text-sm">
            هذا الامتحان يتطلب رسوم اشتراك للوصول إليه
          </p>

          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 mb-6">
            <div className="text-4xl font-extrabold text-orange-600 mb-1">
              {exam?.price} جنيه
            </div>
            <div className="text-orange-700 text-sm font-semibold">رسوم الامتحان</div>
          </div>

          <div className="space-y-2 text-xs text-slate-500 mb-6">
            <div className="flex items-center gap-2 justify-center">
              <span>✓</span><span>فيزا / ماستركارد</span>
            </div>
            <div className="flex items-center gap-2 justify-center">
              <span>✓</span><span>فوري</span>
            </div>
            <div className="flex items-center gap-2 justify-center">
              <span>✓</span><span>محافظ إلكترونية (فودافون كاش / اورنج كاش)</span>
            </div>
          </div>

          {error && (
            <div className="alert alert-danger mb-4">{error}</div>
          )}

          <button onClick={handlePay} disabled={initiating}
            className="w-full py-3 rounded-xl font-bold text-white text-base transition-all"
            style={{ background: initiating ? '#94a3b8' : '#f97316' }}>
            {initiating
              ? <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                  جاري التحضير...
                </span>
              : `💳 ادفع الآن ${exam?.price} جنيه`
            }
          </button>

          <p className="text-xs text-slate-400 mt-3">
            🔒 مدعوم من PayMob — دفع آمن ومشفر
          </p>
        </div>
      </div>
    </div>
  );
}

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
  </div>
);
