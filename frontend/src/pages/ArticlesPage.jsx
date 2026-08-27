import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/shared/Navbar';
import api from '../utils/api';

export default function ArticlesPage() {
  const [articles, setArticles] = useState([]);
  const [enabled, setEnabled]   = useState(true); // avoid a "disabled" flash before the request resolves
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null); // article id, or null for the list view
  const [detail, setDetail]     = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/articles').then(({ data }) => {
      setEnabled(data.enabled);
      setArticles(data.articles || []);
    }).finally(() => setLoading(false));
  }, []);

  const openArticle = (id) => {
    setSelected(id);
    setDetailLoading(true);
    api.get(`/articles/${id}`).then(({ data }) => setDetail(data)).finally(() => setDetailLoading(false));
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar/>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <button onClick={() => selected ? setSelected(null) : navigate('/student')}
          className="text-slate-500 hover:text-slate-800 text-sm mb-3 flex items-center gap-1 transition-colors">
          ← {selected ? 'رجوع للمقالات' : 'رجوع للرئيسية'}
        </button>

        {!enabled ? (
          <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-3">📰</div>
            <h3 className="text-lg font-bold text-slate-600 mb-1">القسم غير متاح حاليًا</h3>
          </div>
        ) : selected ? (
          <ArticleDetail article={detail} loading={detailLoading}/>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold text-slate-800 mb-1">📰 مقالات ونصائح الدراسة</h1>
            <p className="text-slate-500 text-sm mb-6">مقالات مفيدة لتساعدك على المذاكرة والاستعداد للامتحانات</p>

            {articles.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="text-5xl mb-3">📭</div>
                <h3 className="text-lg font-bold text-slate-600">لا توجد مقالات حاليًا</h3>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {articles.map(a => (
                  <div key={a.id} onClick={() => openArticle(a.id)}
                    className="card p-0 overflow-hidden cursor-pointer hover:shadow-md transition-shadow">
                    <div className="relative bg-slate-200 aspect-video overflow-hidden">
                      {a.cover_image ? (
                        <img src={a.cover_image} alt={a.title} className="w-full h-full object-cover"/>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-100 to-orange-200">
                          <span className="text-5xl">📰</span>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-slate-800 mb-1">{a.title}</h3>
                      {a.summary && <p className="text-xs text-slate-500 line-clamp-2">{a.summary}</p>}
                      <p className="text-[11px] text-slate-400 mt-2">
                        {new Date(a.created_at).toLocaleDateString('ar-EG', { year:'numeric', month:'long', day:'numeric' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ArticleDetail({ article, loading }) {
  if (loading || !article) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  );
  return (
    <article className="card">
      {article.cover_image && (
        <img src={article.cover_image} alt={article.title}
          className="w-full aspect-video object-cover rounded-xl mb-5 -mt-1"/>
      )}
      <h1 className="text-2xl font-extrabold text-slate-800 mb-2">{article.title}</h1>
      <p className="text-xs text-slate-400 mb-5">
        {new Date(article.created_at).toLocaleDateString('ar-EG', { year:'numeric', month:'long', day:'numeric' })}
      </p>
      <div className="text-slate-700 leading-relaxed whitespace-pre-wrap">{article.content}</div>
    </article>
  );
}
