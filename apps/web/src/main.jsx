import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function App() {
  const [token, setToken] = useState(localStorage.getItem('legacy_token') || '');
  const [me, setMe] = useState(null);
  const [view, setView] = useState('home');
  const [items, setItems] = useState([]);

  useEffect(() => {
    const urlToken = new URLSearchParams(location.search).get('token');
    if (urlToken) { localStorage.setItem('legacy_token', urlToken); setToken(urlToken); history.replaceState({}, '', '/'); }
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/me`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null).then(setMe);
  }, [token]);

  useEffect(() => {
    if (view === 'shop') fetch(`${API}/api/shop`).then(r => r.json()).then(setItems);
  }, [view]);

  const cards = useMemo(() => [
    ['profile','👤','بروفايلي','البروفايل والتخصيصات'],
    ['points','🪙','نقاطي','رصيدك ومستواك'],
    ['inventory','🎒','حقيبتي','كل العناصر التي تملكها'],
    ['shop','🛒','المتجر','تخصيصات وعناصر LEGACY'],
    ['leaderboard','🏆','المتصدرين','أفضل المستخدمين'],
    ['social','👥','الأصدقاء','شبكتك الاجتماعية'],
    ['premium','💎','Premium','مزايا الاشتراك'],
    ['settings','⚙️','الإعدادات','الخصوصية والتخصيص']
  ], []);

  if (!token) return <main className="landing"><div className="glow"/><section className="hero"><span className="badge">LEGACY</span><h1>منصتك الاجتماعية،<br/><strong>بحساب واحد.</strong></h1><p>ملفك، نقاطك، حقيبتك، متجرك ومجتمعك في تجربة واحدة متصلة مع Discord.</p><a className="primary" href={`${API}/auth/discord`}>تسجيل الدخول عبر Discord</a></section></main>;

  return <main className="app"><header><div className="brand">LEGACY</div><div className="user">{me?.avatar_url && <img src={me.avatar_url}/>}<span>{me?.global_name || me?.username || 'حسابي'}</span></div></header>
    <div className="layout"><aside><button onClick={()=>setView('home')}>⌂ الرئيسية</button>{cards.map(([id,icon,title])=><button key={id} onClick={()=>setView(id)}>{icon} {title}</button>)}{me?.admin && <button className="admin" onClick={()=>setView('admin')}>👑 الإدارة</button>}</aside>
    <section className="content">{view==='home' && <><div className="welcome"><span>مرحباً بك في</span><h2>LEGACY</h2><p>كل بيانات حسابك مشتركة بين الموقع وDiscord والـ Activity.</p></div><div className="grid">{cards.map(([id,icon,title,desc])=><button className="card" key={id} onClick={()=>setView(id)}><b>{icon}</b><h3>{title}</h3><p>{desc}</p></button>)}</div></>}
    {view==='profile' && <Panel title="👤 بروفايلي">{me ? <><h2>{me.display_name || me.global_name || me.username}</h2><p>{me.bio || 'لا توجد نبذة بعد.'}</p><div className="stats"><span>المستوى<strong>{me.level}</strong></span><span>النقاط<strong>{me.points}</strong></span><span>Premium<strong>{me.premium_until ? 'فعال' : 'غير مشترك'}</strong></span></div></> : 'جاري التحميل...'}</Panel>}
    {view==='points' && <Panel title="🪙 نقاطي"><div className="big-number">{me?.points ?? 0}</div><p>نقاطك محفوظة في الحساب نفسه وتظهر في كل واجهات LEGACY.</p></Panel>}
    {view==='inventory' && <Panel title="🎒 حقيبتي"><p>نظام الحقيبة مرتبط مباشرة بالكتالوج والحساب.</p></Panel>}
    {view==='shop' && <Panel title="🛒 المتجر"><div className="grid">{items.map(x=><div className="card" key={x.id}><b>✨</b><h3>{x.name}</h3><p>{x.description}</p><small>{x.price} نقطة</small></div>)}</div></Panel>}
    {view==='leaderboard' && <Panel title="🏆 المتصدرين"><Leaderboard API={API}/></Panel>}
    {view==='social' && <Panel title="👥 الأصدقاء"><p>نظام الأصدقاء والمتابعة قادم ضمن نفس الحساب.</p></Panel>}
    {view==='premium' && <Panel title="💎 Premium"><p>Premium يفتح مزايا وتخصيصات إضافية، والامتياز محفوظ على الحساب نفسه.</p></Panel>}
    {view==='settings' && <Panel title="⚙️ الإعدادات"><p>الخصوصية والتخصيصات ستدار من هنا.</p></Panel>}
    {view==='admin' && <Admin API={API} token={token}/>}</section></div></main>;
}
function Panel({title,children}){return <div className="panel"><h2>{title}</h2>{children}</div>}
function Leaderboard({API}){const [rows,setRows]=useState([]);useEffect(()=>{fetch(`${API}/api/leaderboards/points`).then(r=>r.json()).then(setRows)},[API]);return <div className="rows">{rows.map((r,i)=><div className="row" key={i}><b>#{i+1}</b><span>{r.global_name||r.username}</span><strong>{r.points}</strong></div>)}</div>}
function Admin({API,token}){const [q,setQ]=useState('');const [users,setUsers]=useState([]);const [logs,setLogs]=useState([]);const search=()=>fetch(`${API}/api/admin/users?q=${encodeURIComponent(q)}`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(setUsers);const loadLogs=()=>fetch(`${API}/api/admin/audit`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(setLogs);return <Panel title="👑 LEGACY | الإدارة"><div className="adminbox"><h3>البحث عن مستخدم</h3><input value={q} onChange={e=>setQ(e.target.value)} placeholder="الاسم أو Discord ID"/><button className="primary" onClick={search}>بحث</button>{users.map(u=><div className="row" key={u.id}><span>{u.global_name||u.username}</span><span>{u.points} نقطة</span><span>Lv.{u.level}</span></div>)}</div><div className="adminbox"><h3>السجلات</h3><button onClick={loadLogs}>تحديث السجلات</button>{logs.map(x=><div className="log" key={x.id}>{x.action} — {new Date(x.created_at).toLocaleString('ar')}</div>)}</div></Panel>}

createRoot(document.getElementById('root')).render(<App/>);
