import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import mr from '../mr.png';
import { useAuth } from '../context/AuthContext';
import SEO from '../components/SEO';

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

function GalleryCarousel({ images, bg, interval = 2000 }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused]   = useState(false);
  const timer = useRef(null);

  const next = useCallback(() => setCurrent(c => (c + 1) % images.length), [images.length]);
  const prev = () => setCurrent(c => (c - 1 + images.length) % images.length);

  useEffect(() => {
    if (paused || images.length <= 1) return;
    timer.current = setInterval(next, interval);
    return () => clearInterval(timer.current);
  }, [paused, next, images.length, interval]);

  if (!images.length) return null;

  return (
    <section className="py-16 bg-slate-50">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-slate-800 mb-2">لحظات من المنصة</h2>
          <p className="text-slate-600">صور المدرس مع الطلاب</p>
        </div>

        <div
          className="relative overflow-hidden rounded-3xl shadow-2xl select-none"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Slides */}
          <div
            className="flex transition-transform duration-700 ease-in-out"
            style={{ transform: `translateX(${current * 100}%)` }}
          >
            {images.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`gallery-${i}`}
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
                className="w-full flex-shrink-0 object-cover"
                style={{ aspectRatio:'16/9', minWidth:'100%' }}
              />
            ))}
          </div>

          {/* Arrows */}
          {images.length > 1 && <>
            <button
              onClick={prev}
              aria-label="الصورة السابقة"
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors text-lg"
            >›</button>
            <button
              onClick={next}
              aria-label="الصورة التالية"
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors text-lg"
            >‹</button>
          </>}

          {/* Counter */}
          <div className="absolute top-3 left-3 bg-black/50 text-white text-xs font-bold px-3 py-1 rounded-full">
            {current + 1} / {images.length}
          </div>
        </div>

        {/* Dots */}
        {images.length > 1 && (
          <div className="flex justify-center gap-1 mt-5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                aria-label={`الصورة ${i + 1}`}
                aria-current={i === current ? 'true' : undefined}
                className="p-2 rounded-full transition-all duration-300 hover:bg-slate-100"
              >
                <span
                  className="block w-2.5 h-2.5 rounded-full transition-all duration-300"
                  style={{ background: i === current ? bg : '#cbd5e1', transform: i === current ? 'scale(1.3)' : 'scale(1)' }}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

const GRADES = {9:'ثالث إعدادي',10:'أول ثانوي',11:'ثاني ثانوي',12:'ثالث ثانوي'};
const MEDALS = { 1:'🥇', 2:'🥈', 3:'🥉', 4:'4️⃣', 5:'5️⃣' };

const DEFAULT_SECTIONS = [
  { key:'stats',        label:'📊 الأرقام',     visible: true },
  { key:'gallery',      label:'📸 معرض الصور', visible: true },
  { key:'courses',      label:'📚 الكورسات',   visible: true },
  { key:'features',     label:'✨ المميزات',    visible: true },
  { key:'testimonials', label:'💬 آراء الطلاب',visible: true },
  { key:'honor_board',  label:'🏆 لوحة الشرف', visible: true },
  { key:'cta',          label:'🎯 CTA',        visible: true },
];

function parseSections(raw) {
  try {
    const stored = Array.isArray(raw) ? raw : JSON.parse(raw || '[]');
    if (!stored.length) return DEFAULT_SECTIONS;
    const storedKeys = new Set(stored.map(s => s.key));
    const extras = DEFAULT_SECTIONS.filter(d => !storedKeys.has(d.key));
    return [
      ...stored.map(s => ({ ...DEFAULT_SECTIONS.find(d => d.key === s.key), ...s })),
      ...extras,
    ];
  } catch { return DEFAULT_SECTIONS; }
}
const MEDAL_STYLES = {
  1: 'bg-gradient-to-br from-yellow-50 to-amber-50 border-amber-300 shadow-amber-100',
  2: 'bg-gradient-to-br from-slate-50 to-gray-100 border-slate-300 shadow-slate-100',
  3: 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-300 shadow-orange-100',
  4: 'bg-white border-slate-200',
  5: 'bg-white border-slate-200',
};

export default function LandingPage() {
  const [data, setData]             = useState(null);
  const [honorBoard, setHonorBoard] = useState([]);
  const [courses, setCourses]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [dark, setDark]             = useState(() => document.documentElement.classList.contains('dark'));
  const { user, logout }            = useAuth();
  const navigate                    = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get('/landing'),
      api.get('/landing/honor-board'),
      api.get('/landing/courses'),
    ]).then(([land, honor, crs]) => {
      setData(land.data);
      setHonorBoard(honor.data);
      setCourses(crs.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  if (!data) return null;

  const features        = Array.isArray(data.features)     ? data.features     : JSON.parse(data.features     || '[]');
  const testimonials    = Array.isArray(data.testimonials) ? data.testimonials : JSON.parse(data.testimonials || '[]');
  const gallery         = Array.isArray(data.gallery)      ? data.gallery      : JSON.parse(data.gallery      || '[]');
  const galleryInterval = (Number(data.gallery_interval) || 2) * 1000;
  const bg              = data.hero_bg_color || '#2563eb';
  const sections        = parseSections(data.sections_config);

  const siteUrl = 'https://mribrahimfarouk.com';
  const seoTitle = data.hero_name
    ? `${data.hero_name} | ${data.platform_tagline || 'منصة تعليمية'}`
    : undefined;
  const seoDesc = data.hero_desc ||
    `منصة ${data.hero_name || 'التعليم'} — امتحانات إلكترونية وفيديوهات تعليمية لمراحل ثالث إعدادي والثانوية العامة.`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'EducationalOrganization',
        name: data.platform_tagline || 'منصة تعليمية',
        url: siteUrl,
        description: seoDesc,
        inLanguage: 'ar',
        founder: { '@type': 'Person', name: data.hero_name || '' },
        ...(data.facebook  ? { sameAs: [data.facebook]  } : {}),
        ...(data.youtube   ? { sameAs: [data.youtube]   } : {}),
      },
      ...(courses.length ? [{
        '@type': 'ItemList',
        name: 'الكورسات المتاحة',
        itemListElement: courses.slice(0, 10).map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Course',
            name: c.title,
            description: c.description || c.title,
            provider: { '@type': 'EducationalOrganization', name: data.platform_tagline || 'منصة تعليمية' },
          },
        })),
      }] : []),
    ],
  };

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      <SEO
        title={seoTitle}
        description={seoDesc}
        url="/"
        jsonLd={jsonLd}
      />

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
              aria-label={dark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
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

      {/* ── Main Content ───────────────────────────────────────────────── */}
      <main>

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
                  <img src={data.hero_image || mr} alt={data.hero_name}
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

      {/* ── Dynamic Sections ────────────────────────────────────────────── */}
      {sections.filter(s => s.visible).map(s => {
        switch (s.key) {

          case 'stats': return (
            <section key="stats" className="py-16 bg-white">
              <div className="max-w-5xl mx-auto px-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  {[{num:data.stat1_num,label:data.stat1_label},{num:data.stat2_num,label:data.stat2_label},
                    {num:data.stat3_num,label:data.stat3_label},{num:data.stat4_num,label:data.stat4_label}].map((s,i) => (
                    <div key={i} className="text-center p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                      <div className="text-4xl font-extrabold mb-1" style={{color:bg}}>{s.num}</div>
                      <div className="text-slate-500 font-semibold text-sm">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );

          case 'gallery': return gallery.length > 0
            ? <GalleryCarousel key="gallery" images={gallery} bg={bg} interval={galleryInterval} />
            : null;

          case 'courses': return courses.length > 0 ? (
            <section key="courses" className="py-20 bg-white">
              <div className="max-w-6xl mx-auto px-4">
                <div className="text-center mb-14">
                  <h2 className="text-3xl font-extrabold text-slate-800 mb-3">الكورسات المتاحة</h2>
                  <p className="text-slate-600 text-lg">اختر الكورس المناسب لك وابدأ رحلتك</p>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {courses.map(c => (
                    <div key={c.id} className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 bg-white">
                      <div className="relative aspect-video bg-gradient-to-br from-blue-100 to-blue-200">
                        {c.thumbnail
                          ? <img src={c.thumbnail} alt={c.title} loading="lazy" decoding="async" className="w-full h-full object-cover"/>
                          : <div className="w-full h-full flex items-center justify-center text-5xl">📚</div>
                        }
                        <div className="absolute top-2 right-2">
                          <span className="bg-white/90 text-xs font-bold px-2 py-1 rounded-full text-slate-700">
                            {GRADES[c.grade] || `صف ${c.grade}`}
                          </span>
                        </div>
                        <div className="absolute bottom-2 left-2">
                          <span className="bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                            {c.lessons_count > 0 ? `${c.lessons_count} درس` : `${c.items_count} عنصر`}
                          </span>
                        </div>
                      </div>
                      <div className="p-5">
                        <h3 className="font-extrabold text-slate-800 text-lg mb-1 line-clamp-2">{c.title}</h3>
                        {c.description && <p className="text-slate-500 text-sm mb-4 line-clamp-2">{c.description}</p>}
                        <Link to={user ? (user.role === 'student' ? '/student' : '/teacher') : '/register'}
                          className="block text-center font-bold py-2.5 rounded-xl text-sm transition-all hover:opacity-90"
                          style={{background:bg, color:'white'}}>
                          {user ? 'ادخل المنصة ←' : 'سجّل للوصول ←'}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null;

          case 'features': return features.length > 0 ? (
            <section key="features" className="py-20 bg-slate-50">
              <div className="max-w-5xl mx-auto px-4">
                <div className="text-center mb-14">
                  <h2 className="text-3xl font-extrabold text-slate-800 mb-3">لماذا تنضم إلينا؟</h2>
                  <p className="text-slate-600 text-lg">كل ما تحتاجه في مكان واحد</p>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                  {features.map((f,i) => (
                    <div key={i} className="bg-white rounded-2xl p-7 border border-slate-100 shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 text-center">
                      <div className="text-5xl mb-4">{f.icon}</div>
                      <h3 className="text-lg font-bold text-slate-800 mb-2">{f.title}</h3>
                      <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null;

          case 'testimonials': return testimonials.length > 0 ? (
            <section key="testimonials" className="py-20 bg-white">
              <div className="max-w-5xl mx-auto px-4">
                <div className="text-center mb-14">
                  <h2 className="text-3xl font-extrabold text-slate-800 mb-3">ماذا يقول طلابنا؟</h2>
                  <p className="text-slate-600 text-lg">آراء حقيقية من طلابنا</p>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {testimonials.map((t,i) => (
                    <div key={i} className="bg-slate-50 rounded-2xl p-6 border border-slate-100 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-1 mb-4">
                        <span aria-hidden="true" className="flex gap-0.5">
                          {[1,2,3,4,5].map(n=><span key={n} className="text-amber-500 text-lg">★</span>)}
                        </span>
                        <span className="sr-only">5 من 5 نجوم</span>
                      </div>
                      <p className="text-slate-700 leading-relaxed mb-4 text-sm">"{t.text}"</p>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{background:bg}}>
                          {t.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{t.name}</p>
                          {t.grade && <p className="text-xs text-slate-500">{t.grade}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null;

          case 'honor_board': return honorBoard.length > 0 ? (
            <section key="honor_board" className="py-20 bg-slate-50">
              <div className="max-w-3xl mx-auto px-4">
                <div className="text-center mb-12">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold mb-4 text-white" style={{background:bg}}>
                    🏆 لوحة الشرف
                  </div>
                  <h2 className="text-3xl font-extrabold text-slate-800 mb-2">أبطال المنصة</h2>
                  <p className="text-slate-600">أعلى الطلاب أداءً من جميع الصفوف</p>
                </div>
                <div className="space-y-3">
                  {honorBoard.map((s,i) => (
                    <div key={i} className={`p-4 rounded-2xl border-2 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${MEDAL_STYLES[s.rank]||'bg-white border-slate-200'}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="text-2xl flex-shrink-0 w-8 text-center">{MEDALS[s.rank]||s.rank}</div>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-extrabold text-base flex-shrink-0 shadow-sm" style={{background:bg}}>
                          {s.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-extrabold text-slate-800 truncate">{s.name}</p>
                          <p className="text-xs text-slate-400">{GRADES[s.grade]||`صف ${s.grade}`}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-around pt-2 border-t border-black/5">
                        <div className="text-center"><p className="text-xs text-slate-500">الامتحانات</p><p className="font-bold text-slate-700">{s.exam_count}</p></div>
                        <div className="text-center"><p className="text-xs text-slate-500">المتوسط</p><p className="font-bold text-emerald-600">{s.avg_score}%</p></div>
                        <div className="text-center"><p className="text-xs text-slate-500">النقاط</p><p className="font-extrabold text-lg" style={{color:bg}}>{s.honor_score}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-center text-xs text-slate-500 mt-6">النقاط = متوسط الدرجات × عدد الامتحانات — يُحدَّث تلقائياً</p>
              </div>
            </section>
          ) : null;

          case 'cta': return (
            <section key="cta" className="py-20" style={{background:`linear-gradient(135deg, ${bg} 0%, ${bg}cc 100%)`}}>
              <div className="max-w-3xl mx-auto px-4 text-center text-white">
                <h2 className="text-3xl lg:text-4xl font-extrabold mb-4">
                  {user ? `أهلاً بك، ${user.name}!` : data.cta_title}
                </h2>
                <p className="text-white/80 text-lg mb-8">
                  {user ? 'كل شيء جاهز لك — ادخل المنصة وابدأ' : data.cta_desc}
                </p>
                {user ? (
                  <button onClick={() => navigate(user.role==='student'?'/student':'/teacher')}
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
          );

          default: return null;
        }
      })}

      </main>

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
                  aria-label="واتساب"
                  className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-lg hover:opacity-80 transition-opacity">
                  💬
                </a>
              )}
              {data.telegram && (
                <a href={data.telegram} target="_blank" rel="noreferrer"
                  aria-label="تليجرام"
                  className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-lg hover:opacity-80 transition-opacity">
                  ✈️
                </a>
              )}
              {data.facebook && (
                <a href={data.facebook} target="_blank" rel="noreferrer"
                  aria-label="فيسبوك"
                  className="w-10 h-10 bg-blue-700 rounded-full flex items-center justify-center text-lg hover:opacity-80 transition-opacity">
                  👤
                </a>
              )}
              {data.youtube && (
                <a href={data.youtube} target="_blank" rel="noreferrer"
                  aria-label="يوتيوب"
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
