import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import mr from '../mr.png';
import { useAuth } from '../context/AuthContext';

function UserNavMenu({ user, bg, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const dest = user.role === 'student' ? '/student' : '/teacher';

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90"
        style={{ background: bg }}>
        <span>👤</span>
        <span className="hidden sm:block max-w-[120px] truncate">{user.name}</span>
        <span className="text-xs opacity-70">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-12 bg-white rounded-2xl shadow-2xl border border-slate-100 min-w-[180px] z-50 overflow-hidden" dir="rtl">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
            <p className="text-xs text-slate-400">مرحباً</p>
            <p className="font-bold text-slate-800 text-sm truncate">{user.name}</p>
          </div>
          <button onClick={() => { navigate(dest); setOpen(false); }}
            className="w-full text-right px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
            🏠 ادخل المنصة
          </button>
          {user.role === 'student' && (
            <button onClick={() => { navigate('/student?tab=results'); setOpen(false); }}
              className="w-full text-right px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
              📊 نتائجي
            </button>
          )}
          <div className="border-t border-slate-100"/>
          <button onClick={onLogout}
            className="w-full text-right px-4 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 flex items-center gap-2">
            🚪 خروج
          </button>
        </div>
      )}
    </div>
  );
}

export default function LandingPage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [dark, setDark]       = useState(() => document.documentElement.classList.contains('dark'));
  const { user, logout }      = useAuth();
  const navigate              = useNavigate();

  useEffect(() => {
    api.get('/landing').then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  if (!data) return null;

  const features     = Array.isArray(data.features)     ? data.features     : JSON.parse(data.features     || '[]');
  const testimonials = Array.isArray(data.testimonials) ? data.testimonials : JSON.parse(data.testimonials || '[]');
  const bg           = data.hero_bg_color || '#2563eb';

  return (
    <div className="min-h-screen bg-white" dir="rtl">

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{background:bg}}/>
            <span className="font-extrabold text-slate-800 text-lg">{data.platform_tagline || 'منصة الامتحانات'}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const isDark = document.documentElement.classList.toggle('dark');
                localStorage.setItem('theme', isDark ? 'dark' : 'light');
                setDark(isDark);
              }}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-lg"
            >
              {dark ? '☀️' : '🌙'}
            </button>
            {user ? (
              <UserNavMenu user={user} bg={bg} onLogout={() => { logout(); }} />
            ) : (
              <>
                <Link to="/login" className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors">
                  تسجيل الدخول
                </Link>
                <Link to="/register"
                  className="text-sm font-bold text-white px-4 py-2 rounded-xl transition-all hover:opacity-90"
                  style={{background:bg}}>
                  سجّل الآن
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section style={{background:`linear-gradient(135deg, ${bg} 0%, ${bg}dd 60%, ${bg}99 100%)`}}
        className="relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10"
          style={{backgroundImage:'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize:'32px 32px'}}/>

        <div className="max-w-6xl mx-auto px-4 py-20 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            {/* Text */}
            <div className="flex-1 text-white text-center lg:text-right">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"/>
                {data.hero_title}
              </div>
              <h1 className="text-4xl lg:text-6xl font-extrabold mb-4 leading-tight">
                {data.hero_name}
              </h1>
              <p className="text-lg lg:text-xl text-white/80 mb-8 max-w-lg leading-relaxed">
                {data.hero_desc}
              </p>
              {user ? (
                <div className="flex flex-col items-center lg:items-start gap-4">
                  <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur px-4 py-2 rounded-full text-white/90 text-sm font-semibold">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"/>
                    أهلاً، {user.name}! أنت مسجل دخولك
                  </div>
                  <button
                    onClick={() => navigate(user.role === 'student' ? '/student' : '/teacher')}
                    className="group flex items-center gap-3 bg-white font-extrabold px-10 py-4 rounded-2xl text-lg shadow-2xl hover:shadow-white/30 hover:-translate-y-1 transition-all duration-200"
                    style={{color:bg}}>
                    <span>ادخل المنصة الآن</span>
                    <span className="text-xl group-hover:translate-x-[-4px] transition-transform">←</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                  <Link to="/register"
                    className="bg-white font-bold px-8 py-3 rounded-xl text-base hover:shadow-lg transition-all hover:-translate-y-0.5"
                    style={{color:bg}}>
                    ابدأ الآن مجاناً ←
                  </Link>
                  <Link to="/login"
                    className="border-2 border-white/60 text-white font-bold px-8 py-3 rounded-xl text-base hover:bg-white/10 transition-all">
                    تسجيل الدخول
                  </Link>
                </div>
              )}
            </div>

            {/* Teacher image / avatar */}
            <div className="flex-shrink-0">
              <div className="w-56 h-56 lg:w-72 lg:h-72 rounded-3xl overflow-hidden bg-white/20 border-4 border-white/30 shadow-2xl">
                {data.hero_image ? (
                  <img src={ mr || data.hero_image} alt={data.hero_name}
                    className="w-full h-full object-cover"/>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    <span className="text-8xl">👨‍🏫</span>
                    <span className="text-white/70 text-sm mt-2 font-semibold">{data.hero_name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="white" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            <path d="M0,30 C360,60 1080,0 1440,30 L1440,60 L0,60 Z"/>
          </svg>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {num:data.stat1_num, label:data.stat1_label},
              {num:data.stat2_num, label:data.stat2_label},
              {num:data.stat3_num, label:data.stat3_label},
              {num:data.stat4_num, label:data.stat4_label},
            ].map((s,i) => (
              <div key={i} className="text-center p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-4xl font-extrabold mb-1" style={{color:bg}}>{s.num}</div>
                <div className="text-slate-500 font-semibold text-sm">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      {features.length > 0 && (
        <section className="py-20 bg-slate-50">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-extrabold text-slate-800 mb-3">لماذا تنضم إلينا؟</h2>
              <p className="text-slate-500 text-lg">كل ما تحتاجه في مكان واحد</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {features.map((f,i) => (
                <div key={i}
                  className="bg-white rounded-2xl p-7 border border-slate-100 shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 text-center">
                  <div className="text-5xl mb-4">{f.icon}</div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">{f.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Testimonials ───────────────────────────────────────────────── */}
      {testimonials.length > 0 && (
        <section className="py-20 bg-white">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl font-extrabold text-slate-800 mb-3">ماذا يقول طلابنا؟</h2>
              <p className="text-slate-500 text-lg">آراء حقيقية من طلابنا</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {testimonials.map((t,i) => (
                <div key={i}
                  className="bg-slate-50 rounded-2xl p-6 border border-slate-100 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-1 mb-4">
                    {[1,2,3,4,5].map(s=>(
                      <span key={s} className="text-amber-400 text-lg">★</span>
                    ))}
                  </div>
                  <p className="text-slate-700 leading-relaxed mb-4 text-sm">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                      style={{background:bg}}>
                      {t.name?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{t.name}</p>
                      {t.grade && <p className="text-xs text-slate-400">{t.grade}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className="py-20" style={{background:`linear-gradient(135deg, ${bg} 0%, ${bg}cc 100%)`}}>
        <div className="max-w-3xl mx-auto px-4 text-center text-white">
          <h2 className="text-3xl lg:text-4xl font-extrabold mb-4">
            {user ? `أهلاً بك، ${user.name}!` : data.cta_title}
          </h2>
          <p className="text-white/80 text-lg mb-8">
            {user ? 'كل شيء جاهز لك — ادخل المنصة وابدأ' : data.cta_desc}
          </p>
          {user ? (
            <button
              onClick={() => navigate(user.role === 'student' ? '/student' : '/teacher')}
              className="inline-flex items-center gap-3 bg-white font-extrabold px-12 py-4 rounded-2xl text-lg hover:shadow-2xl transition-all hover:-translate-y-1"
              style={{color:bg}}>
              ادخل المنصة الآن ←
            </button>
          ) : (
            <Link to="/register"
              className="inline-block bg-white font-bold px-10 py-4 rounded-xl text-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
              style={{color:bg}}>
              سجّل مجاناً الآن ←
            </Link>
          )}
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="text-center lg:text-right">
              <div className="text-xl font-extrabold mb-1">{data.platform_tagline}</div>
              <div className="text-slate-400 text-sm">{data.hero_name} — {data.hero_title}</div>
            </div>

            {/* Social links */}
            <div className="flex items-center gap-4">
              {data.whatsapp && (
                <a href={`https://wa.me/${data.whatsapp}`} target="_blank" rel="noreferrer"
                  className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-lg hover:opacity-80 transition-opacity">
                  💬
                </a>
              )}
              {data.telegram && (
                <a href={data.telegram} target="_blank" rel="noreferrer"
                  className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-lg hover:opacity-80 transition-opacity">
                  ✈️
                </a>
              )}
              {data.facebook && (
                <a href={data.facebook} target="_blank" rel="noreferrer"
                  className="w-10 h-10 bg-blue-700 rounded-full flex items-center justify-center text-lg hover:opacity-80 transition-opacity">
                  👤
                </a>
              )}
              {data.youtube && (
                <a href={data.youtube} target="_blank" rel="noreferrer"
                  className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-lg hover:opacity-80 transition-opacity">
                  ▶️
                </a>
              )}
            </div>

            <div className="flex gap-4 text-sm">
              <Link to="/login" className="text-slate-400 hover:text-white transition-colors">تسجيل الدخول</Link>
              <Link to="/register" className="text-slate-400 hover:text-white transition-colors">إنشاء حساب</Link>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-6 text-center text-slate-500 text-xs">
            © {new Date().getFullYear()} {data.platform_tagline} — جميع الحقوق محفوظة
          </div>
        </div>
      </footer>
    </div>
  );
}
