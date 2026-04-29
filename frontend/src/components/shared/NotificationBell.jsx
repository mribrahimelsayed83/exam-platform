import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

const getDismissed = (uid) => {
  try { return new Set(JSON.parse(localStorage.getItem(`notif_dismissed_${uid}`)) || []); }
  catch { return new Set(); }
};
const saveDismissed = (uid, set) => {
  const arr = [...set].slice(-500);
  localStorage.setItem(`notif_dismissed_${uid}`, JSON.stringify(arr));
};

export default function NotificationBell() {
  const { user } = useAuth();
  const [count, setCount]         = useState(0);
  const [notifs, setNotifs]       = useState([]);
  const [open, setOpen]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected]   = useState(new Set());
  const ref       = useRef(null);
  const prevCount = useRef(null);
  const audioCtx  = useRef(null);

  useEffect(() => {
    const unlock = () => {
      if (!audioCtx.current)
        audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.current.state === 'suspended') audioCtx.current.resume();
    };
    document.addEventListener('click', unlock);
    document.addEventListener('keydown', unlock);
    return () => { document.removeEventListener('click', unlock); document.removeEventListener('keydown', unlock); };
  }, []);

  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSelectMode(false); setSelected(new Set()); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const playSound = () => {
    try {
      const ctx = audioCtx.current;
      if (!ctx || ctx.state !== 'running') return;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      [[0, 880], [0.18, 1100]].forEach(([delay, freq]) => {
        const osc = ctx.createOscillator();
        osc.connect(gain);
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.35);
      });
    } catch {}
  };

  const fetchCount = async () => {
    try {
      const { data } = await api.get('/notifications/unread-count');
      const newCount = Number(data.count);
      if (prevCount.current !== null && newCount > prevCount.current) playSound();
      prevCount.current = newCount;
      setCount(newCount);
    } catch {}
  };

  const openPanel = async () => {
    if (open) { setOpen(false); setSelectMode(false); setSelected(new Set()); return; }
    setOpen(true);
    setLoading(true);
    try {
      const { data } = await api.get('/notifications');
      const dismissed = getDismissed(user?.id);
      setNotifs(data.filter(n => !dismissed.has(n.id)));
    } finally { setLoading(false); }
  };

  const markAllRead = async () => {
    setNotifs(n => n.map(x => ({ ...x, is_read: true })));
    setCount(0);
    prevCount.current = 0;
    api.post('/notifications/read-all').catch(() => {});
  };

  const markRead = (notifId) => {
    setNotifs(prev => prev.map(x => x.id === notifId ? { ...x, is_read: true } : x));
    setCount(c => { const next = Math.max(0, c - 1); prevCount.current = next; return next; });
    api.post(`/notifications/${notifId}/read`).catch(() => {});
  };

  const toggleSelect = (id) => {
    setSelected(s => { const ns = new Set(s); ns.has(id) ? ns.delete(id) : ns.add(id); return ns; });
  };

  const selectAll = () => setSelected(new Set(notifs.map(n => n.id)));
  const clearSelection = () => setSelected(new Set());

  const deleteSelected = () => {
    if (!selected.size) return;
    const dismissed = getDismissed(user?.id);
    selected.forEach(id => dismissed.add(id));
    saveDismissed(user?.id, dismissed);
    const unreadDeleted = notifs.filter(n => selected.has(n.id) && !n.is_read).length;
    setNotifs(n => n.filter(x => !selected.has(x.id)));
    setCount(c => { const next = Math.max(0, c - unreadDeleted); prevCount.current = next; return next; });
    setSelected(new Set());
    setSelectMode(false);
  };

  const visibleNotifs = notifs;
  const allSelected = visibleNotifs.length > 0 && selected.size === visibleNotifs.length;

  return (
    <div className="relative" ref={ref}>
      <button onClick={openPanel} className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
        <span className="text-xl">🔔</span>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden" dir="rtl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            {selectMode ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">{selected.size} محدَّد</span>
                  <button onClick={allSelected ? clearSelection : selectAll}
                    className="text-xs text-blue-600 hover:underline font-semibold">
                    {allSelected ? 'إلغاء الكل' : 'تحديد الكل'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {selected.size > 0 && (
                    <button onClick={deleteSelected}
                      className="text-xs text-red-500 hover:underline font-semibold">
                      حذف ({selected.size})
                    </button>
                  )}
                  <button onClick={() => { setSelectMode(false); setSelected(new Set()); }}
                    className="text-xs text-slate-400 hover:text-slate-600 font-semibold">
                    إلغاء
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-bold text-slate-800 text-sm">الإشعارات</h3>
                <div className="flex items-center gap-3">
                  {count > 0 && (
                    <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline font-semibold">
                      تعليم الكل
                    </button>
                  )}
                  {visibleNotifs.length > 0 && (
                    <button onClick={() => setSelectMode(true)}
                      className="text-xs text-slate-500 hover:text-slate-700 font-semibold flex items-center gap-1">
                      ☑ تحديد
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
              </div>
            ) : visibleNotifs.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <div className="text-3xl mb-2">🔔</div>
                <p className="text-sm">لا توجد إشعارات</p>
              </div>
            ) : (
              visibleNotifs.map(n => {
                const isRead = !!n.is_read;
                const isSelected = selected.has(n.id);
                return (
                  <div
                    key={n.id}
                    onClick={() => selectMode ? toggleSelect(n.id) : (!isRead && markRead(n.id))}
                    className={`px-4 py-3 border-b border-slate-50 transition-colors flex items-start gap-2
                      ${selectMode ? 'cursor-pointer hover:bg-slate-50' : ''}
                      ${!isRead && !selectMode ? 'bg-blue-50 cursor-pointer hover:bg-blue-100' : 'bg-white'}
                      ${isSelected ? '!bg-blue-100' : ''}`}
                  >
                    {selectMode && (
                      <div className={`w-4 h-4 rounded border-2 flex-shrink-0 mt-1 flex items-center justify-center transition-all
                        ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                        {isSelected && <span className="text-white text-[10px] font-bold">✓</span>}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {!isRead && !selectMode && <span className="w-2 h-2 bg-blue-500 rounded-full inline-block ml-1.5 mb-0.5"/>}
                      <p className="font-semibold text-sm text-slate-800">{n.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.body}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(n.created_at).toLocaleDateString('ar-EG', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
