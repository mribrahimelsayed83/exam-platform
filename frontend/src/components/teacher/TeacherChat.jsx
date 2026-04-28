import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function TeacherChat() {
  return <TeacherChatMain />;
}

function TeacherChatMain() {
  const { user } = useAuth();
  const isAssistant = user?.role === 'assistant';
  const [searchParams, setSearchParams] = useSearchParams();

  const [conversations, setConversations] = useState([]);
  const [selected, setSelected]           = useState(null);
  const [messages, setMessages]           = useState([]);
  const [text, setText]                   = useState('');
  const [sending, setSending]             = useState(false);
  const [loadingMsgs, setLoadingMsgs]     = useState(false);
  const [searchQ, setSearchQ]             = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]         = useState(false);
  const bottomRef    = useRef(null);
  const searchTimer  = useRef(null);
  const pendingStudentId = useRef(null);

  // ── Load conversations list ───────────────────────────────────────────────
  const loadConvs = async () => {
    try {
      if (isAssistant) {
        const [s, unreadRes] = await Promise.all([
          api.get('/chat/teacher/conversations'),
          api.get('/chat/assistant/unread-count'),
        ]);
        const students = s.data.map(x => ({
          id: x.student_id, name: x.student_name, type: 'student',
          unread: Number(x.unread), last_message: x.last_message,
        }));
        const teacherEntry = {
          id: 0, name: 'المدرس', type: 'teacher-inbox',
          unread: Number(unreadRes.data.count), last_message: '',
        };
        setConversations([
          teacherEntry,
          ...students.sort((a, b) => Number(b.unread) - Number(a.unread)),
        ]);
      } else {
        const [s, a] = await Promise.all([
          api.get('/chat/teacher/conversations'),
          api.get('/chat/teacher/staff-conversations'),
        ]);
        const students   = s.data.map(x => ({ id: x.student_id,   name: x.student_name,   type: 'student',   unread: Number(x.unread), last_message: x.last_message }));
        const assistants = a.data.map(x => ({ id: x.assistant_id, name: x.assistant_name, type: 'assistant', unread: Number(x.unread), last_message: x.last_message }));
        setConversations([...students, ...assistants].sort((a, b) => Number(b.unread) - Number(a.unread)));
      }
    } catch {}
  };

  // ── Load messages for selected conversation ───────────────────────────────
  const loadMessages = async (person, silent = false) => {
    if (!silent) setLoadingMsgs(true);
    try {
      let url;
      if (person.type === 'teacher-inbox') url = '/chat/assistant/inbox';
      else if (person.type === 'student')  url = `/chat/teacher/${person.id}`;
      else                                  url = `/chat/staff/${person.id}`;
      const { data } = await api.get(url);
      setMessages(data);
      setConversations(c => c.map(x =>
        x.id === person.id && x.type === person.type ? { ...x, unread: 0 } : x
      ));
    } finally { if (!silent) setLoadingMsgs(false); }
  };

  // re-run whenever role changes (fixes stale-closure bug when user loads after mount)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadConvs();
    const t = setInterval(loadConvs, 10000);
    return () => clearInterval(t);
  }, [user?.role]);

  // Auto-open: capture URL param whenever it appears (handles both fresh mount and re-navigation)
  useEffect(() => {
    const id = Number(searchParams.get('student'));
    if (!id) return;
    setSearchParams({}, { replace: true });
    if (conversations.length) {
      const conv = conversations.find(c => c.type === 'student' && c.id === id);
      const person = conv || { id, type: 'student', name: '...' };
      setSelected(person);
      loadMessages(person);
      if (!conv) setConversations(c => [{ ...person, unread: 0, last_message: '' }, ...c]);
    } else {
      pendingStudentId.current = id;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Auto-open: if conversations loaded after URL param was captured
  useEffect(() => {
    if (!pendingStudentId.current || !conversations.length) return;
    const id = pendingStudentId.current;
    pendingStudentId.current = null;
    const conv = conversations.find(c => c.type === 'student' && c.id === id);
    const person = conv || { id, type: 'student', name: '...' };
    setSelected(person);
    loadMessages(person);
    if (!conv) setConversations(c => [{ ...person, unread: 0, last_message: '' }, ...c]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  useEffect(() => {
    if (!selected) return;
    const t = setInterval(() => loadMessages(selected, true), 5000);
    return () => clearInterval(t);
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Search with debounce ──────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (!searchQ.trim()) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/chat/teacher/search?q=${encodeURIComponent(searchQ)}`);
        setSearchResults(isAssistant ? data.filter(r => r.role === 'student') : data);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 350);
  }, [searchQ]);

  const selectPerson = (person) => {
    setSelected(person);
    setSearchQ('');
    setSearchResults([]);
    loadMessages(person);
    if (!conversations.find(c => c.id === person.id && c.type === person.type)) {
      setConversations(c => [{ ...person, unread: 0, last_message: '' }, ...c]);
    }
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending || !selected) return;
    setSending(true);
    try {
      let url;
      if (selected.type === 'teacher-inbox') url = '/chat/assistant/send';
      else if (selected.type === 'student')  url = `/chat/teacher/${selected.id}/reply`;
      else                                    url = `/chat/staff/${selected.id}/send`;
      const { data } = await api.post(url, { message: text.trim() });
      setMessages(m => [...m, data]);
      setText('');
      setConversations(c => c.map(x =>
        x.id === selected.id && x.type === selected.type ? { ...x, last_message: text.trim() } : x
      ));
    } finally { setSending(false); }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getIsMe = (m) => {
    if (!selected) return false;
    if (selected.type === 'teacher-inbox') return m.from_role === 'assistant';
    if (selected.type === 'student')       return m.from_role !== 'student';
    return m.from_role === 'teacher';
  };

  const roleBadge = (type) => {
    if (type === 'assistant')     return <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full">مساعد</span>;
    if (type === 'teacher-inbox') return <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded-full">مدرس</span>;
    return                                <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded-full">طالب</span>;
  };

  const roleIcon = (type) => {
    if (type === 'assistant')     return '🤝';
    if (type === 'teacher-inbox') return '👨‍🏫';
    return '👤';
  };

  const roleBg = (type) => {
    if (type === 'assistant')     return 'bg-amber-100';
    if (type === 'teacher-inbox') return 'bg-purple-100';
    return 'bg-blue-100';
  };

  // Is search mode active?
  const isSearching = searchQ.trim().length > 0;

  return (
    <div dir="rtl">
      <h2 className="text-xl font-extrabold text-slate-800 mb-5">💬 الرسائل</h2>
      <div className="flex gap-4" style={{ height: '72vh', minHeight: 420 }}>

        {/* ── Conversations panel ────────────────────────────────────────── */}
        <div className="w-64 flex-shrink-0 bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden">

          {/* Search bar */}
          <div className="p-3 border-b border-slate-100 flex-shrink-0">
            <div className="relative">
              <input
                className="input text-sm pr-8 pl-3 w-full"
                placeholder="ابحث عن طالب أو مساعد..."
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
              />
              {searchQ ? (
                <button
                  onClick={() => setSearchQ('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm leading-none">
                  ✕
                </button>
              ) : (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
              )}
            </div>
          </div>

          {/* List: search results OR conversations */}
          <div className="flex-1 overflow-y-auto">
            {isSearching ? (
              /* ── Search results ─────────────────────── */
              searching ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-8 text-slate-400 px-3">
                  <div className="text-2xl mb-1">🔍</div>
                  <p className="text-xs">لا توجد نتائج</p>
                </div>
              ) : (
                <>
                  <p className="text-[11px] text-slate-400 font-bold px-3 pt-2 pb-1">نتائج البحث</p>
                  {searchResults.map(r => (
                    <button key={`${r.role}-${r.id}`}
                      onClick={() => selectPerson({ id: r.id, name: r.name, type: r.role })}
                      className="w-full text-right px-3 py-2.5 flex items-center gap-2 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${roleBg(r.role)}`}>
                        {roleIcon(r.role)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{r.name}</p>
                        {r.username && <p className="text-xs text-slate-400 truncate">@{r.username}</p>}
                      </div>
                      {roleBadge(r.role)}
                    </button>
                  ))}
                </>
              )
            ) : (
              /* ── Conversations list ─────────────────── */
              conversations.length === 0 ? (
                <div className="text-center py-10 text-slate-400 px-3">
                  <div className="text-3xl mb-2">💬</div>
                  <p className="text-xs">ابحث عن شخص لبدء محادثة</p>
                </div>
              ) : conversations.map(c => (
                <button key={`${c.type}-${c.id}`} onClick={() => selectPerson(c)}
                  className={`w-full text-right px-3 py-3 border-b border-slate-100 flex items-start gap-2.5 transition-colors
                    ${selected?.id === c.id && selected?.type === c.type
                      ? 'bg-blue-50 border-r-2 border-r-blue-600'
                      : 'hover:bg-slate-50'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${roleBg(c.type)}`}>
                    {roleIcon(c.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-sm font-bold text-slate-800 truncate">{c.name}</p>
                      {c.unread > 0 && (
                        <span className="min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 flex-shrink-0">
                          {c.unread > 9 ? '9+' : c.unread}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {roleBadge(c.type)}
                      {c.last_message && (
                        <p className="text-xs text-slate-400 truncate flex-1">{c.last_message}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Chat window ────────────────────────────────────────────────── */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <div className="text-5xl mb-3">💬</div>
                <p className="font-semibold text-sm">ابحث عن شخص أو اختر محادثة</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 flex-shrink-0">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base ${roleBg(selected.type)}`}>
                  {roleIcon(selected.type)}
                </div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-800 text-sm">{selected.name}</p>
                  {roleBadge(selected.type)}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                {loadingMsgs ? (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <p className="text-sm">لا توجد رسائل — ابدأ المحادثة</p>
                  </div>
                ) : messages.map(m => {
                  const isMe = getIsMe(m);
                  const showName = !isMe && selected.type === 'student';
                  return (
                    <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm
                        ${isMe
                          ? 'bg-blue-600 text-white rounded-tl-sm'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-tr-sm'}`}>
                        {showName && (
                          <p className="text-xs text-slate-400 font-semibold mb-0.5">{m.from_name}</p>
                        )}
                        <p className="leading-relaxed">{m.message}</p>
                        <p className={`text-xs mt-1 ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                          {new Date(m.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef}/>
              </div>

              {/* Input */}
              <form onSubmit={send} className="flex gap-2 p-3 border-t border-slate-100 flex-shrink-0">
                <input className="flex-1 input text-sm"
                  placeholder={`اكتب رسالة لـ ${selected.name}...`}
                  value={text} onChange={e => setText(e.target.value)} disabled={sending}/>
                <button type="submit" disabled={sending || !text.trim()}
                  className="btn-primary px-4 text-sm disabled:opacity-50">
                  {sending
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                    : 'إرسال'
                  }
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
