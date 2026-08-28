// Small "🟢 متصل الآن" / "آخر ظهور: ..." indicator for a student row.
// Relies on the backend's is_online (computed from last_seen_at, refreshed
// by the student's heartbeat while the app is open — see StudentHeartbeat.jsx)
// rather than recomputing the threshold here, so the client can't drift out
// of sync with the server's definition of "online".
export default function OnlineStatus({ student }) {
  if (student.is_online) {
    return (
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className="w-2 h-2 bg-emerald-500 rounded-full inline-block flex-shrink-0"/>
        <span className="text-xs text-emerald-600 font-semibold">متصل الآن</span>
      </div>
    );
  }
  if (!student.last_seen_at) {
    return (
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className="w-2 h-2 bg-slate-300 rounded-full inline-block flex-shrink-0"/>
        <span className="text-xs text-slate-400">لم يفتح المنصة بعد</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 mt-0.5">
      <span className="w-2 h-2 bg-slate-300 rounded-full inline-block flex-shrink-0"/>
      <span className="text-xs text-slate-400">
        آخر ظهور: {new Date(student.last_seen_at).toLocaleDateString('ar-EG', {
          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        })}
      </span>
    </div>
  );
}
