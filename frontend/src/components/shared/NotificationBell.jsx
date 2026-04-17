import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';

export default function NotificationBell() {
  const [count, setCount]     = useState(0);
  const [notifs, setNotifs]   = useState([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const ref       = useRef(null);
  const prevCount = useRef(null);
  const audioCtx  = useRef(null);

  // Create + unlock AudioContext on first user interaction
  useEffect(() => {
    const unlock = () => {
      if (!audioCtx.current) {
        audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.current.state === 'suspended') {
        audioCtx.current.resume();
      }
    };
    document.addEventListener('click', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);

  // Poll every 5 seconds — compare OUTSIDE setCount to avoid side-effects in updater
  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, 5000);
    return () => clearInterval(id);
  }, []);

  // Close on outside click
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
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
      // Compare BEFORE updating state — no side effects inside setCount
      if (prevCount.current !== null && newCount > prevCount.current) {
        playSound();
      }
      prevCount.current = newCount;
      setCount(newCount);
    } catch {}
  };

  const openPanel = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setLoading(true);
    try {
      const { data } = await api.get('/notifications');
      setNotifs(data);
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    // Optimistic update first
    setNotifs(n => n.map(x => ({ ...x, is_read: true })));
    setCount(0);
    prevCount.current = 0;
    api.post('/notifications/read-all').catch(() => {});
  };

  const markRead = (notifId) => {
    // Optimistic update immediately — don't wait for API
    setNotifs(prev => prev.map(x => x.id === notifId ? { ...x, is_read: true } : x));
    setCount(c => {
      const next = Math.max(0, c - 1);
      prevCount.current = next;
      return next;
    });
    api.post(`/notifications/${notifId}/read`).catch(() => {});
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={openPanel}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <span className="text-xl">🔔</span>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden" dir="rtl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-sm">الإشعارات</h3>
            {count > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline font-semibold">
                تعليم الكل كمقروء
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
              </div>
            ) : notifs.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <div className="text-3xl mb-2">🔔</div>
                <p className="text-sm">لا توجد إشعارات</p>
              </div>
            ) : (
              notifs.map(n => {
                const isRead = !!n.is_read;
                return (
                  <div
                    key={n.id}
                    onClick={() => !isRead && markRead(n.id)}
                    className={`px-4 py-3 border-b border-slate-50 transition-colors
                      ${!isRead ? 'bg-blue-50 cursor-pointer hover:bg-blue-100' : 'bg-white'}`}
                  >
                    <div className="flex items-start gap-2">
                      {!isRead && <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1.5"/>}
                      <div className={`flex-1 min-w-0 ${isRead ? 'pr-4' : ''}`}>
                        <p className="font-semibold text-sm text-slate-800">{n.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.body}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(n.created_at).toLocaleDateString('ar-EG', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </div>
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
