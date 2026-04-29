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

  // ── Select mode ───────────────────────────────────────────────────────────
  const [selectMode, setSelectMode]     = useState(false);
  const [selectedMsgs, setSelectedMsgs] = useState(new Set());

  // ── Edit mode ─────────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText]   = useState('');

  const bottomRef    = useRef(null);
  const searchTimer  = useRef(null);
  const pendingStudentId = useRef(null);

  // ── Load conversations ────────────────────────────────────────────────────
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
        setConversations([
          { id: 0, name: 'المدرس', type: 'teacher-inbox', unread: Number(unreadRes.data.count), last_message: '' },
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

  // ── Load messages ─────────────────────────────────────────────────────────
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

  useEffect(() => {
    loadConvs();
    const t = setInterval(loadConvs, 10000);
    return () => clearInterval(t);
  }, [user?.role]); // eslint-disable-line

  useEffect(() => {
    const id = Number(searchParams.get('student'));
    if (!id) return;
    setSearchParams({}, { replace: true });
    if (conversations.length) {
      const conv = conversations.find(c => c.type === 'student' && c.id === id);
      const person = conv || { id, type: 'student', name: '...' };
      setSelected(person); loadMessages(person);
      if (!conv) setConversations(c => [{ ...person, unread: 0, last_message: '' }, ...c]);
    } else {
      pendingStudentId.current = id;
    }
  }, [searchParams]); // eslint-disable-line

  useEffect(() => {
    if (!pendingStudentId.current || !conversations.length) return;
    const id = pendingStudentId.current;
    pendingStudentId.current = null;
    const conv = conversations.find(c => c.type === 'student' && c.id === id);
    const person = conv || { id, type: 'student', name: '...' };
    setSelected(person); loadMessages(person);
    if (!conv) setConversations(c => [{ ...person, unread: 0, last_message: '' }, ...c]);
  }, [conversations]); // eslint-disable-line

  useEffect(() => {
    if (!selected) return;
    const t = setInterval(() => loadMessages(selected, true), 5000);
    return () => clearInterval(t);
  }, [selected]); // eslint-disable-line

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset select mode when changing conversation
  useEffect(() => {
    setSelectMode(false);
    setSelectedMsgs(new Set());
    setEditingId(null);
  }, [selected]);

  // ── Search ────────────────────────────────────────────────────────────────
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
  }, [searchQ]); // eslint-disable-line

  const selectPerson = (person) => {
    setSelected(person);
    setSearchQ('');
    setSearchResults([]);
    loadMessages(person);
    if (!conversations.find(c => c.id === person.id && c.type === person.type))
      setConversations(c => [{ ...person, unread: 0, last_message: '' }, ...c]);
  };

  // ── Send ──────────────────────────────────────────────────────────────────
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

  // ── Message actions ───────────────────────────────────────────────────────
  const toggleMsgSelect = (id) => {
    setSelectedMsgs(s => { const ns = new Set(s); ns.has(id) ? ns.delete(id) : ns.add(id); return ns; });
  };

  const selectAllMsgs = () => setSelectedMsgs(new Set(messages.map(m => m.id)));
  const clearMsgSel   = () => setSelectedMsgs(new Set());

  const deleteSelectedMsgs = async () => {
    if (!selectedMsgs.size) return;
    try {
      await api.post('/chat/messages/bulk-delete', { ids: [...selectedMsgs] });
      setMessages(m => m.filter(x => !selectedMsgs.has(x.id)));
      setSelectedMsgs(new Set());
      setSelectMode(false);
    } catch {}
  };

  const deleteMsg = async (id) => {
    try {
      await api.delete(`/chat/messages/${id}`);
      setMessages(m => m.filter(x => x.id !== id));
    } catch {}
  };

  const startEdit = (msg) => { setEditingId(msg.id); setEditText(msg.message); };
  const cancelEdit = () => { setEditingId(null); setEditText(''); };

  const saveEdit = async () => {
    if (!editText.trim()) return;
    try {
      const { data } = await api.put(`/chat/messages/${editingId}`, { message: editText.trim() });
      setMessages(m => m.map(x => x.id === editingId ? data : x));
      cancelEdit();
    } catch {}
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
  const roleIcon = (type) => type === 'assistant' ? '🤝' : type === 'teacher-inbox' ? '👨‍🏫' : '👤';
  const roleBg   = (type) => type === 'assistant' ? 'bg-amber-100' : type === 'teacher-inbox' ? 'bg-purple-100' : 'bg-blue-100';
  const isSearching = searchQ.trim().length > 0;
  const allMsgsSelected = messages.length > 0 && selectedMsgs.size === messages.length;

  return (
    <div dir="rtl">
      <h2 className="text-xl font-extrabold text-slate-800 mb-5">💬 الرسائل</h2>
      <div className="flex gap-4" style={{ height: '72vh', minHeight: 420 }}>

        {/* ── Conversations panel ────────────────────────────────────────── */}
        <div className="w-64 flex-shrink-0 bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-100 flex-shrink-0">
            <div className="relative">
              <input className="input text-sm pr-8 pl-3 w-full"
                placeholder="ابحث عن طالب أو مساعد..."
                value={searchQ} onChange={e => setSearchQ(e.target.value)}/>
              {searchQ ? (
                <button onClick={() => setSearchQ('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm">✕</button>
              ) : (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isSearching ? (
              searching ? (
                <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/></div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-8 text-slate-400 px-3"><div className="text-2xl mb-1">🔍</div><p className="text-xs">لا توجد نتائج</p></div>
              ) : (
                <>
                  <p className="text-[11px] text-slate-400 font-bold px-3 pt-2 pb-1">نتائج البحث</p>
                  {searchResults.map(r => (
                    <button key={`${r.role}-${r.id}`}
                      onClick={() => selectPerson({ id: r.id, name: r.name, type: r.role })}
                      className="w-full text-right px-3 py-2.5 flex items-center gap-2 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${roleBg(r.role)}`}>{roleIcon(r.role)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{r.name}</p>
                        {r.username && <p className="text-xs text-slate-400 truncate">@{r.username}</p>}
                      </div>
                      {roleBadge(r.role)}
                    </button>
                  ))}
                </>
              )
            ) : conversations.length === 0 ? (
              <div className="text-center py-10 text-slate-400 px-3"><div className="text-3xl mb-2">💬</div><p className="text-xs">ابحث عن شخص لبدء محادثة</p></div>
            ) : conversations.map(c => (
              <button key={`${c.type}-${c.id}`} onClick={() => selectPerson(c)}
                className={`w-full text-right px-3 py-3 border-b border-slate-100 flex items-start gap-2.5 transition-colors
                  ${selected?.id === c.id && selected?.type === c.type ? 'bg-blue-50 border-r-2 border-r-blue-600' : 'hover:bg-slate-50'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${roleBg(c.type)}`}>{roleIcon(c.type)}</div>
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
                    {c.last_message && <p className="text-xs text-slate-400 truncate flex-1">{c.last_message}</p>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Chat window ────────────────────────────────────────────────── */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center"><div className="text-5xl mb-3">💬</div><p className="font-semibold text-sm">ابحث عن شخص أو اختر محادثة</p></div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base ${roleBg(selected.type)}`}>{roleIcon(selected.type)}</div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-800 text-sm">{selected.name}</p>
                    {roleBadge(selected.type)}
                  </div>
                </div>

                {/* Select mode controls */}
                {selectMode ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">{selectedMsgs.size} محدَّد</span>
                    <button onClick={allMsgsSelected ? clearMsgSel : selectAllMsgs}
                      className="text-xs text-blue-600 hover:underline font-semibold">
                      {allMsgsSelected ? 'إلغاء الكل' : 'تحديد الكل'}
                    </button>
                    {selectedMsgs.size > 0 && (
                      <button onClick={deleteSelectedMsgs}
                        className="text-xs bg-red-500 text-white px-2 py-1 rounded-lg font-semibold hover:bg-red-600">
                        حذف ({selectedMsgs.size})
                      </button>
                    )}
                    <button onClick={() => { setSelectMode(false); setSelectedMsgs(new Set()); }}
                      className="text-xs text-slate-400 hover:text-slate-600 font-semibold">
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setSelectMode(true)}
                    className="text-xs text-slate-500 hover:text-slate-700 font-semibold border border-slate-200 px-2 py-1 rounded-lg hover:border-slate-300">
                    ☑ تحديد
                  </button>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                {loadingMsgs ? (
                  <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/></div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12 text-slate-400"><p className="text-sm">لا توجد رسائل — ابدأ المحادثة</p></div>
                ) : messages.map(m => {
                  const isMe = getIsMe(m);
                  const isEditing = editingId === m.id;
                  const isMsgSelected = selectedMsgs.has(m.id);

                  return (
                    <div key={m.id}
                      onClick={() => selectMode && toggleMsgSelect(m.id)}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${selectMode ? 'cursor-pointer' : ''} group`}>

                      {/* Checkbox in select mode (left of message) */}
                      {selectMode && !isMe && (
                        <div className={`w-4 h-4 rounded border-2 flex-shrink-0 mt-3 ml-2 flex items-center justify-center self-start
                          ${isMsgSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                          {isMsgSelected && <span className="text-white text-[10px] font-bold">✓</span>}
                        </div>
                      )}

                      <div className={`max-w-[75%] ${isMsgSelected ? 'opacity-70' : ''}`}>
                        {/* Edit mode */}
                        {isEditing ? (
                          <div className="bg-white border-2 border-blue-400 rounded-2xl p-2 min-w-[200px]">
                            <textarea
                              className="w-full text-sm text-slate-800 resize-none outline-none leading-relaxed"
                              rows={3}
                              value={editText}
                              onChange={e => setEditText(e.target.value)}
                              autoFocus
                            />
                            <div className="flex gap-2 mt-1.5">
                              <button onClick={saveEdit}
                                className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg font-bold hover:bg-blue-700">
                                حفظ
                              </button>
                              <button onClick={cancelEdit}
                                className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1">
                                إلغاء
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="relative">
                            {/* Action toolbar (hover, own messages only, not in select mode) */}
                            {isMe && !selectMode && (
                              <div className="absolute -top-7 left-0 right-0 flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => { e.stopPropagation(); startEdit(m); }}
                                  className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs text-slate-500 hover:text-blue-600 hover:border-blue-300 shadow-sm">
                                  ✏ تعديل
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); deleteMsg(m.id); }}
                                  className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs text-slate-500 hover:text-red-500 hover:border-red-300 shadow-sm">
                                  🗑 حذف
                                </button>
                              </div>
                            )}

                            <div className={`rounded-2xl px-3 py-2 text-sm
                              ${isMe
                                ? 'bg-blue-600 text-white rounded-tl-sm'
                                : 'bg-white border border-slate-200 text-slate-800 rounded-tr-sm'}`}>
                              {!isMe && selected.type === 'student' && (
                                <p className="text-xs text-slate-400 font-semibold mb-0.5">{m.from_name}</p>
                              )}
                              <p className="leading-relaxed">{m.message}</p>
                              <div className={`flex items-center justify-end gap-1 mt-1`}>
                                <p className={`text-xs ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                                  {new Date(m.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                                {/* Read receipt for own messages to students */}
                                {isMe && selected.type === 'student' && (
                                  <span className={`text-xs font-bold ${m.is_read ? 'text-blue-200' : 'text-blue-300/50'}`}
                                    title={m.is_read ? 'تمت القراءة' : 'لم يُقرأ بعد'}>
                                    {m.is_read ? '✓✓' : '✓'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Checkbox in select mode (right of message) */}
                      {selectMode && isMe && (
                        <div className={`w-4 h-4 rounded border-2 flex-shrink-0 mt-3 mr-2 flex items-center justify-center self-start
                          ${isMsgSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                          {isMsgSelected && <span className="text-white text-[10px] font-bold">✓</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={bottomRef}/>
              </div>

              {/* Input — hidden in select mode */}
              {!selectMode && (
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
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
