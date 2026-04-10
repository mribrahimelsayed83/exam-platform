import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';

export default function NotificationBell() {
  const [count, setCount]       = useState(0);
  const [notifs, setNotifs]     = useState([]);
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const ref = useRef(null);

  // جلب عدد الغير مقروء كل 30 ثانية
  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // إغلاق عند الضغط خارج
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchCount = async () => {
    try {
      const { data } = await api.get('/notifications/unread-count');
      setCount(data.count);
    } catch {}
  };

  const openPanel = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setLoading(true);
    try {
      const { data } = await api.get('/notifications');
      setNotifs(data);
    } finally { setLoading(false); }
  };

  const markAllRead = async () => {
    await api.post('/notifications/read-all');
    setCount(0);
    setNotifs(n => n.map(x => ({ ...x, is_read: true })));
  };

  const markRead = async (id) => {
    await api.post(`/notifications/${id}/read`);
    setNotifs(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
    setCount(c => Math.max(0, c - 1));
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={openPanel}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
        <span className="text-xl">🔔</span>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-sm">الإشعارات</h3>
            {count > 0 && (
              <button onClick={markAllRead}
                className="text-xs text-blue-600 hover:underline font-semibold">
                تعليم الكل كمقروء
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"/>
              </div>
            ) : notifs.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <div className="text-3xl mb-2">🔔</div>
                <p className="text-sm">لا توجد إشعارات</p>
              </div>
            ) : (
              notifs.map(n => (
                <div key={n.id}
                  onClick={() => !n.is_read && markRead(n.id)}
                  className={`px-4 py-3 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors
                    ${!n.is_read ? 'bg-blue-50' : ''}`}>
                  <div className="flex items-start gap-2">
                    {!n.is_read && (
                      <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5"/>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-slate-800">{n.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.body}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(n.created_at).toLocaleDateString('ar-EG', {
                          month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
