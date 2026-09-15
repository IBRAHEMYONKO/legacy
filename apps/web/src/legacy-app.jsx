import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './legacy-app.css';
import { readOAuthResult, resolveApiOrigin } from './oauth-result.js';

const API = resolveApiOrigin(import.meta.env.VITE_API_URL, location.origin);

function discordLoginUrl() {
  return `${API}/auth/discord?return_to=${encodeURIComponent(location.origin)}`;
}

async function api(path, options = {}) {
  const token = localStorage.getItem('legacy_token') || '';
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  try {
    const { signal: _ignoredSignal, ...requestOptions } = options;
    const response = await fetch(`${API}${path}`, { ...requestOptions, headers, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      localStorage.removeItem('legacy_token');
      window.dispatchEvent(new Event('legacy:logout'));
    }
    if (!response.ok) throw new Error(data.error || 'حدث خطأ غير متوقع');
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('انتهت مهلة الاتصال بخدمة LEGACY. تأكد أن الـ API يعمل ثم حاول مرة أخرى.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

const NAV = [
  ['home', '⌂', 'الرئيسية'], ['profile', '◉', 'بروفايلك'], ['points', '◈', 'النقاط'],
  ['inventory', '▣', 'الحقيبة'], ['shop', '◆', 'المتجر'], ['leaderboard', '♛', 'المتصدرين'],
  ['social', '◎', 'المجتمع'], ['premium', '✦', 'Premium'], ['notifications', '◌', 'الإشعارات']
];

function avatarUrl(me) { return me?.avatar_url || ''; }
function discordName(me) { return me?.global_name || me?.username || 'عضو LEGACY'; }
function money(value) { return Number(value || 0).toLocaleString('ar-IQ'); }

function Avatar({ me, className = '' }) {
  const src = typeof me === 'string' ? me : avatarUrl(me);
  const name = typeof me === 'string' ? 'L' : discordName(me);
  return src ? <img className={`avatar ${className}`} src={src} alt="Discord avatar" /> : <div className={`avatar fallback ${className}`}>{name.slice(0, 1)}</div>;
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('legacy_token') || '');
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem('legacy_token'));
  const [view, setView] = useState('home');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [authCallbackError, setAuthCallbackError] = useState('');
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    const { token: urlToken, error: urlError } = readOAuthResult(location);
    if (urlError) {
      localStorage.removeItem('legacy_token');
      setToken('');
      setMe(null);
      setAuthCallbackError(urlError);
      setLoading(false);
    } else if (urlToken) {
      localStorage.setItem('legacy_token', urlToken);
      setToken(urlToken);
      setAuthCallbackError('');
      setLoading(true);
    }
    if (urlToken || urlError) history.replaceState({}, '', location.pathname);
    const logout = () => { setToken(''); setMe(null); setLoading(false); setView('home'); };
    window.addEventListener('legacy:logout', logout);
    return () => window.removeEventListener('legacy:logout', logout);
  }, []);

  useEffect(() => {
    const move = event => {
      document.documentElement.style.setProperty('--mx', `${event.clientX}px`);
      document.documentElement.style.setProperty('--my', `${event.clientY}px`);
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    api('/api/me')
      .then(data => { if (!active) return; setMe(data); setAuthCallbackError(''); setLoading(false); })
      .catch(err => { if (!active) return; setMe(null); setError(err.message || 'تعذر تحميل حسابك.'); setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const flash = message => { setNotice(message); window.clearTimeout(flash.timer); flash.timer = window.setTimeout(() => setNotice(''), 3200); };
  const logout = () => { localStorage.removeItem('legacy_token'); setToken(''); setMe(null); setLoading(false); setAuthCallbackError(''); };
  const retry = () => {
    setError('');
    if (authCallbackError) {
      setAuthCallbackError('');
      window.location.assign(discordLoginUrl());
      return;
    }
    setLoading(true);
    setToken(localStorage.getItem('legacy_token') || '');
  };
  const navigate = id => { setView(id); setMobileNav(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  if (authCallbackError) return <AuthErrorScreen message={authCallbackError} onRetry={retry} onLogout={logout} />;
  if (!token) return <Landing />;
  if (loading) return <LoadingScreen />;
  if (!me) return <AuthErrorScreen message={error || 'تعذر تحميل حسابك حالياً.'} onRetry={retry} onLogout={logout} />;

  return <div className="legacy-shell">
    <div className="cursor-light" />
    <div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <header className="topbar">
      <button className="brand" onClick={() => navigate('home')}><span className="brand-mark">L</span><span><b>LEGACY</b><small>عالمك الاجتماعي</small></span></button>
      <div className="connection"><i /> متصل <em>•</em> Discord مرتبط</div>
      <div className="top-actions">
        <button className="mobile-menu" onClick={() => setMobileNav(x => !x)}>☰</button>
        <button className="top-user" onClick={() => navigate('profile')}><Avatar me={me}/><span><b>{discordName(me)}</b><small>@{me.username}</small></span></button>
      </div>
    </header>
    <div className="app-grid">
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="sidebar-title">مساحتك</div>
        {NAV.map(([id, icon, label]) => <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => navigate(id)}><span>{icon}</span>{label}</button>)}
        {me.admin && <button className={`nav-item admin-link ${view === 'admin' ? 'active' : ''}`} onClick={() => navigate('admin')}><span>⚡</span>الإدارة</button>}
        <div className="sidebar-bottom"><div className="balance-mini"><span>🪙</span><div><small>رصيدك</small><b>{money(me.points)}</b></div></div><button className="logout" onClick={logout}>تسجيل الخروج</button></div>
      </aside>
      <main className="main-content">
        {error && <div className="alert error">{error}<button onClick={() => setError('')}>×</button></div>}
        {notice && <div className="alert success">{notice}</div>}
        {view === 'home' && <Home me={me} go={navigate} />}
        {view === 'profile' && <Profile me={me} flash={flash} />}
        {view === 'points' && <Points me={me} />}
        {view === 'inventory' && <Inventory />}
        {view === 'shop' && <Shop flash={flash} />}
        {view === 'leaderboard' && <Leaderboard />}
        {view === 'social' && <Social flash={flash} />}
        {view === 'premium' && <Premium flash={flash} />}
        {view === 'notifications' && <Notifications />}
        {view === 'admin' && me.admin && <Admin flash={flash} />}
      </main>
    </div>
  </div>;
}

function LoadingScreen() { return <div className="loading-screen"><div className="spinner" /><p>جاري تحميل عالمك...</p></div>; }

function AuthErrorScreen({ message, onRetry, onLogout }) {
  return <div className="auth-screen"><div className="auth-card"><div className="brand-mark large">L</div><h1>تعذر إكمال الدخول</h1><p>{message}</p><button className="primary-button" onClick={onRetry}>إعادة المحاولة</button><button className="secondary-button" onClick={onLogout}>العودة للدخول</button></div></div>;
}

function Landing() {
  const login = discordLoginUrl();
  return <div className="auth-screen"><div className="auth-glow" /><div className="auth-card"><div className="brand-mark large">L</div><div className="eyebrow">LEGACY SOCIAL</div><h1>عالمك، حضورك، قصتك.</h1><p>منصة اجتماعية مرتبطة بحساب Discord الخاص بك، تجمع مجتمعك وهويتك ومكافآتك في مكان واحد.</p><a className="discord-button" href={login}>الدخول عبر Discord</a></div></div>;
}

function SectionHeader({ title, sub, action }) { return <div className="section-header"><div><div className="section-kicker">LEGACY</div><h2>{title}</h2><p>{sub}</p></div>{action}</div>; }

function Home({ me, go }) {
  return <>
    <section className="hero-panel"><div><span className="pill">● حسابك متصل بـ Discord</span><h1>أهلاً {discordName(me)} 👋</h1><p>هنا تبدأ مساحتك في LEGACY. تابع نشاطك، طوّر ملفك، واجمع نقاطك.</p><div className="hero-actions"><button className="primary-button" onClick={() => go('profile')}>عرض البروفايل</button><button className="ghost-button" onClick={() => go('shop')}>استكشف المتجر</button></div></div><Avatar me={me} className="hero-avatar"/></section>
    <section className="stat-grid"><Stat label="المستوى" value={me.level}/><Stat label="النقاط" value={money(me.points)} /><Stat label="الخبرة" value={money(me.experience)} /></section>
    <section className="content-card"><SectionHeader title="مساحتك" sub="أهم أقسام LEGACY في مكان واحد."/><div className="quick-grid"><Quick title="الحقيبة" text="شوف العناصر التي تمتلكها." icon="▣" go={() => go('inventory')}/><Quick title="المجتمع" text="استكشف المساحة الاجتماعية." icon="◎" go={() => go('social')}/><Quick title="المتصدرين" text="شوف ترتيب النقاط." icon="♛" go={() => go('leaderboard')}/><Quick title="Premium" text="استكشف مزايا العضوية." icon="✦" go={() => go('premium')}/></div></section>
  </>;
}
function Stat({ label, value }) { return <div className="stat-card"><span>{label}</span><b>{value}</b></div>; }
function Quick({ title, text, icon, go }) { return <button className="quick-card" onClick={go}><span className="quick-icon">{icon}</span><span><b>{title}</b><small>{text}</small></span><i>←</i></button>; }

function Profile({ me }) { return <><SectionHeader title="بروفايلك" sub="هويتك داخل LEGACY مرتبطة بحساب Discord."/><section className="profile-card"><Avatar me={me} className="profile-avatar"/><div><div className="profile-name">{discordName(me)}</div><div className="profile-handle">@{me.username}</div><p>{me.bio || 'ما أضفت نبذة عنك إلى الآن.'}</p><div className="tags"><span>المستوى {me.level}</span><span>{money(me.points)} نقطة</span>{me.admin && <span>إدارة</span>}</div></div></section></>; }

function Points({ me }) { return <><SectionHeader title="النقاط" sub="رصيدك الحالي وتقدمك داخل LEGACY."/><div className="big-balance"><span>رصيد النقاط</span><strong>{money(me.points)}</strong><small>الخبرة: {money(me.experience)}</small></div></>; }

function Inventory() {
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true);
  useEffect(() => { api('/api/inventory').then(setItems).catch(() => setItems([])).finally(() => setLoading(false)); }, []);
  return <><SectionHeader title="الحقيبة" sub="العناصر التي تملكها حالياً."/>{loading ? <LoadingScreen/> : <div className="item-grid">{items.length ? items.map(item => <div className="item-card" key={item.id}><span>{item.type}</span><h3>{item.name}</h3><p>{item.description || 'عنصر من عناصر LEGACY.'}</p><b>×{item.quantity}</b></div>) : <Empty text="حقيبتك فارغة حالياً."/>}</div>}</>;
}

function Shop({ flash }) {
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState('');
  useEffect(() => { api('/api/shop').then(setItems).catch(() => setItems([])).finally(() => setLoading(false)); }, []);
  const buy = async item => { setBusy(String(item.id)); try { await api(`/internal/user/me/shop/${item.id}/buy`, { method: 'POST', headers: { 'x-legacy-client': 'web' } }); flash('تم شراء العنصر.'); } catch (e) { flash(e.message || 'تعذر إتمام الشراء.'); } finally { setBusy(''); } };
  return <><SectionHeader title="المتجر" sub="العناصر المتاحة داخل LEGACY."/>{loading ? <LoadingScreen/> : <div className="item-grid">{items.length ? items.map(item => <div className="item-card" key={item.id}><span>{item.type}</span><h3>{item.name}</h3><p>{item.description || 'عنصر من متجر LEGACY.'}</p><div className="item-foot"><b>{money(item.price)} نقطة</b><button className="small-button" disabled={busy === String(item.id)} onClick={() => buy(item)}>{busy === String(item.id) ? '...' : 'شراء'}</button></div></div>) : <Empty text="المتجر فارغ حالياً."/>}</div>}</>;
}
function Leaderboard() { const [rows,setRows]=useState([]); useEffect(()=>{api('/api/leaderboards/points').then(setRows).catch(()=>setRows([]));},[]); return <><SectionHeader title="المتصدرين" sub="أعلى أعضاء LEGACY حسب النقاط."/><div className="leader-list">{rows.length ? rows.map((row,i)=><div className="leader-row" key={row.discord_id||row.username||i}><strong>#{i+1}</strong><Avatar me={row}/><span><b>{discordName(row)}</b><small>@{row.username}</small></span><em>{money(row.points)} نقطة</em></div>) : <Empty text="لا توجد بيانات ترتيب بعد."/>}</div></>; }
function Social({ flash }) { return <><SectionHeader title="المجتمع" sub="مساحة اجتماعية جاهزة للتوسع والأنشطة."/><div className="content-card"><h3>المجتمع قادم</h3><p>الأساس جاهز لربط المنشورات والتفاعل والمجموعات والإشعارات.</p><button className="primary-button" onClick={()=>flash('سيتم تفعيل أقسام المجتمع تدريجياً.')}>استكشاف</button></div></>; }
function Premium({ flash }) { return <><SectionHeader title="Premium" sub="مزايا إضافية لهوية LEGACY وتجربتك."/><div className="premium-card"><span>✦</span><h2>LEGACY Premium</h2><p>هوية مميزة، شارات، وتخصيصات أكثر لحسابك.</p><button className="primary-button" onClick={()=>flash('ميزات Premium ستُفتح من المتجر عند تفعيلها.')}>استكشاف المزايا</button></div></>; }
function Notifications() { return <><SectionHeader title="الإشعارات" sub="آخر التنبيهات الخاصة بحسابك."/><Empty text="لا توجد إشعارات جديدة."/></>; }
function Admin({ flash }) { const [q,setQ]=useState(''); const [rows,setRows]=useState([]); const search=()=>api(`/api/admin/users?q=${encodeURIComponent(q)}`).then(setRows).catch(()=>setRows([])); return <><SectionHeader title="الإدارة" sub="إدارة الحسابات والنقاط والعناصر."/><div className="admin-tools"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="ابحث باسم أو Discord ID"/><button className="primary-button" onClick={search}>بحث</button></div><div className="leader-list">{rows.map(row=><div className="leader-row" key={row.discord_id}><Avatar me={row}/><span><b>{discordName(row)}</b><small>{row.discord_id}</small></span><em>{money(row.points)} نقطة</em></div>)}{!rows.length&&<Empty text="ابدأ بالبحث عن عضو."/>}</div></>; }
function Empty({ text }) { return <div className="empty">{text}</div>; }

createRoot(document.getElementById('root')).render(<App />);
