import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const TYPES = {
  exam:     { icon: '📝', label: 'امتحان',  bg: 'bg-violet-100', text: 'text-violet-700' },
  student:  { icon: '👤', label: 'طالب',    bg: 'bg-blue-100',   text: 'text-blue-700'   },
  playlist: { icon: '🎬', label: 'مجموعة',  bg: 'bg-emerald-100',text: 'text-emerald-700'},
  video:    { icon: '🎥', label: 'فيديو',   bg: 'bg-amber-100',  text: 'text-amber-700'  },
};

export default function SearchModal({ onClose }) {
  const [q, setQ]           = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive]   = useState(0);
  const inputRef = useRef(null);
  const timer    = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Debounced search
  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/search?q=${encodeURIComponent(q.trim())}`);
        setResults(data);
        setActive(0);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
  }, [q]);

  const goTo = (r) => {
    onClose();
    const isStaff = user?.role === 'teacher' || user?.role === 'assistant';
    if (isStaff) {
      if (r.type === 'student')                                    navigate('/teacher/students');
      else if (r.type === 'exam')                                  navigate('/teacher/exams');
      else                                                         navigate('/teacher/videos');
    } else {
      if (r.type === 'exam')                                       navigate('/student?tab=exams');
      else                                                         navigate('/student/videos');
    }
  };

  const onKey = (e) => {
    if (e.key === 'Escape')    { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    if (e.key === 'Enter' && results[active]) goTo(results[active]);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[9999] flex items-start justify-center pt-16 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <span className="text-slate-400 text-lg flex-shrink-0">🔍</span>
          <input
            ref={inputRef}
            className="flex-1 outline-none text-slate-800 text-sm placeholder-slate-400 bg-transparent"
            placeholder="ابحث عن طالب، امتحان، فيديو..."
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onKey}
          />
          {loading
            ? <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0"/>
            : q && <button onClick={() => setQ('')} className="text-slate-400 hover:text-slate-600 text-sm flex-shrink-0">✕</button>
          }
        </div>

        {/* Results list */}
        <div className="max-h-72 overflow-y-auto">
          {q.trim().length < 2 ? (
            <div className="py-10 text-center text-slate-400 text-sm">
              <div className="text-3xl mb-2">🔍</div>
              <p>اكتب حرفين على الأقل للبحث</p>
            </div>
          ) : !loading && results.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">
              <div className="text-3xl mb-2">😕</div>
              <p>لا توجد نتائج لـ «{q}»</p>
            </div>
          ) : results.map((r, i) => {
            const cfg = TYPES[r.type] || { icon: '📄', label: r.type, bg: 'bg-slate-100', text: 'text-slate-600' };
            return (
              <button
                key={`${r.type}-${r.id}-${i}`}
                onClick={() => goTo(r)}
                className={`w-full text-right px-4 py-3 flex items-center gap-3 transition-colors border-b border-slate-50 last:border-0
                  ${i === active ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
              >
                <span className="text-xl flex-shrink-0">{cfg.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{r.title}</p>
                  {r.subtitle && (
                    <p className="text-xs text-slate-400 truncate mt-0.5">{r.subtitle}</p>
                  )}
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.bg} ${cfg.text}`}>
                  {cfg.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono">↵</kbd> فتح</span>
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono">↑↓</kbd> تنقل</span>
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono">Esc</kbd> إغلاق</span>
        </div>
      </div>
    </div>
  );
}
