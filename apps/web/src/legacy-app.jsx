import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './legacy-app.css';
import { readOAuthResult } from './oauth-result.js';

const configuredApi = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const API = configuredApi || location.origin;

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
    setAuthCallbackError('');
    window.location.assign(discordLoginUrl());
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
        {view === 'profile' && <Profile me={me} refresh={() => api('/api/me').then(setMe)} flash={flash} />}
        {view === 'points' && <Points me={me} />}
        {view === 'inventory' && <Inventory />}
        {view === 'shop' && <Shop me={me} flash={flash} refresh={() => api('/api/me').then(setMe)} />}
        {view === 'leaderboard' && <Leaderboard />}
        {view === 'social' && <Social flash={flash} />}
        {view === 'premium' && <Premium me={me} />}
        {view === 'notifications' && <Notifications />}
        {view === 'admin' && me.admin && <Admin flash={flash} />}
      </main>
    </div>
  </div>;
}

function Landing() { const login = discordLoginUrl(); return <main className="landing"><div className="landing-orbit orbit-a" /><div className="landing-orbit orbit-b" /><section className="landing-card"><div className="landing-logo">L</div><span className="eyebrow">LEGACY SOCIAL PLATFORM</span><h1>مو مجرد موقع.<br /><em>هذا عالمك.</em></h1><p>هوية Discord، مجتمع، نقاط، مقتنيات، شارات وPremium — في مساحة واحدة.</p><a className="discord-button" href={login}><span>◈</span> الدخول عبر Discord</a><div className="landing-features"><span>● هوية Discord</span><span>✦ Economy</span><span>♛ Community</span></div></section></main>; }
function LoadingScreen() { return <main className="loading"><div className="spinner" /><b>جاري تحميل LEGACY...</b><small>نزامن حسابك مع Discord</small></main>; }
function AuthErrorScreen({ message, onRetry, onLogout }) { return <main className="loading"><div className="auth-error-card"><span className="eyebrow">LEGACY • تسجيل الدخول</span><h2>تعذر إكمال تسجيل الدخول</h2><p>{message}</p><div className="hero-actions"><button className="btn primary" onClick={onRetry}>إعادة المحاولة</button><button className="btn secondary" onClick={onLogout}>تسجيل الخروج</button></div></div></main>; }
function Section({ tag, title, text }) { return <div className="section-head"><div><span>{tag}</span><h1>{title}</h1>{text && <p>{text}</p>}</div></div>; }
function Empty({ text }) { return <div className="empty"><span>◇</span><p>{text}</p></div>; }
function Tilt({ children, className = '' }) { return <div className={`interactive ${className}`}>{children}</div>; }
function Home({ me, go }) { const [leaders, setLeaders] = useState([]); const [shop, setShop] = useState([]); useEffect(() => { api('/api/leaderboards/points').then(x => setLeaders((Array.isArray(x) ? x : []).slice(0, 5))).catch(() => {}); api('/api/shop').then(setShop).catch(() => {}); }, []); const name = discordName(me); return <><section className="hero interactive"><div className="hero-copy"><span className="eyebrow live"><i /> ACCOUNT ONLINE</span><h1>هلا <em>{name}</em> 👋</h1><p>هذا مركزك في LEGACY. تابع مستواك، طوّر حضورك، اجمع النقاط وخلي هويتك من Discord هي الأساس.</p><div className="hero-actions"><button className="btn primary" onClick={() => go('profile')}>افتح بروفايلك</button><button className="btn secondary" onClick={() => go('shop')}>استكشف المتجر</button></div></div><div className="hero-identity"><div className="avatar-ring"><Avatar me={me}/></div><b>{name}</b><span>@{me.username}</span><div className="identity-stats"><div><small>المستوى</small><strong>Lv.{me.level || 1}</strong></div><div><small>النقاط</small><strong>{money(me.points)}</strong></div></div></div></section><div className="stats-row"><Stat icon="🪙" label="النقاط" value={money(me.points)} /><Stat icon="⚡" label="المستوى" value={`Lv.${me.level || 1}`} /><Stat icon="💎" label="Premium" value={me.premium_until ? 'فعال' : 'غير مفعل'} /><Stat icon="🎒" label="المقتنيات" value="استعرض" onClick={() => go('inventory')} /></div><div className="home-columns"><Tilt className="panel"><Section tag="LIVE AREA" title="مساحتك الآن" text="كل ما تحتاجه في مكان واحد." /><div className="activity"><Avatar me={me}/><div><b>{name}</b><small>حساب Discord المرتبط • الآن</small></div><span className="more">•••</span><h3>هويتك محفوظة من Discord</h3><p>اسمك وصورتك مصدرهما حساب Discord المرتبط. التخصيص في LEGACY يضيف البايو واللقب والشارات والخلفية بدون تغيير هويتك الأساسية.</p><div className="quick-actions"><button onClick={() => go('profile')}>✦ التخصيص</button><button onClick={() => go('inventory')}>▣ الحقيبة</button><button onClick={() => go('leaderboard')}>♛ الترتيب</button></div></div></Tilt><Tilt className="panel"><Section tag="TOP" title="المتصدرون" /><div className="leader-list">{leaders.length ? leaders.map((x, i) => <div className="leader-row" key={x.discord_id || i}><b>#{i + 1}</b><Avatar me={x.avatar_url || ''}/><span>{x.global_name || x.username || 'عضو'}</span><strong>{money(x.points)}</strong></div>) : <Empty text="لا يوجد ترتيب حتى الآن." />}</div><button className="text-button" onClick={() => go('leaderboard')}>عرض الكل ←</button></Tilt></div><section className="discover"><Section tag="DISCOVER" title="وش تسوي الآن؟" /><div className="discover-grid"><ActionCard icon="◉" title="هويتك" text="اسم وصورة Discord ثابتة." onClick={() => go('profile')} /><ActionCard icon="◆" title="المتجر" text={`${shop.length} عناصر متاحة.`} onClick={() => go('shop')} /><ActionCard icon="♛" title="نافس" text="تابع ترتيب النقاط." onClick={() => go('leaderboard')} /><ActionCard icon="✦" title="Premium" text="مزايا وتخصيصات إضافية." onClick={() => go('premium')} /></div></section></>; }
function Stat({ icon, label, value, onClick }) { return <button className="stat-card interactive" onClick={onClick}><span>{icon}</span><div><small>{label}</small><b>{value}</b></div></button>; }
function ActionCard({ icon, title, text, onClick }) { return <button className="action-card interactive" onClick={onClick}><span>{icon}</span><div><b>{title}</b><p>{text}</p></div><i>↗</i></button>; }
function Profile({ me, refresh, flash }) { const [bio, setBio] = useState(me.bio || ''); const [banner, setBanner] = useState(me.banner_url || ''); const save = async () => { try { await api('/api/profile', { method:'PATCH', body:JSON.stringify({ bio, banner_url:banner }) }); await refresh(); flash('تم حفظ التخصيص.'); } catch(e) { flash(e.message); } }; return <><Section tag="PROFILE" title={discordName(me)} text="هوية Discord تبقى المصدر الأساسي للاسم والصورة." /><div className="profile-card"><div className="profile-avatar"><Avatar me={me}/></div><div><span>@{me.username}</span><h2>{discordName(me)}</h2><p>{me.bio || 'اكتب نبذة بسيطة عنك.'}</p></div><div className="profile-lock">هوية Discord مثبتة</div></div><div className="form-card"><label>البايو<textarea value={bio} onChange={e=>setBio(e.target.value)} /></label><label>رابط الخلفية<input value={banner} onChange={e=>setBanner(e.target.value)} /></label><button className="btn primary" onClick={save}>حفظ التخصيص</button></div></>; }
function Points({ me }) { return <><Section tag="ECONOMY" title="نقاطك" text="رصيدك الحالي ومستواك في LEGACY." /><div className="big-stat"><span>🪙</span><b>{money(me.points)}</b><small>نقطة</small></div></>; }
function Inventory() { const [items,setItems]=useState([]); useEffect(()=>{api('/api/inventory').then(setItems).catch(()=>setItems([]));},[]); return <><Section tag="INVENTORY" title="حقيبتك" text="كل المقتنيات التي حصلت عليها." /><div className="inventory-grid">{items.length?items.map(x=><div className="item-card" key={x.id}><span>{x.type}</span><h3>{x.name}</h3><p>{x.description||'—'}</p><b>x{x.quantity}</b></div>):<Empty text="الحقيبة فارغة حالياً."/>}</div></>; }
function Shop({ me, flash, refresh }) { const [items,setItems]=useState([]); useEffect(()=>{api('/api/shop').then(setItems).catch(()=>setItems([]));},[]); const buy=async id=>{try{await api(`/api/shop/${id}/buy`,{method:'POST'});await refresh();flash('تم الشراء.');}catch(e){flash(e.message)}}; return <><Section tag="STORE" title="المتجر" text={`رصيدك ${money(me.points)} نقطة`} /><div className="shop-grid">{items.length?items.map(x=><div className="shop-card" key={x.id}><span>{x.type}</span><h3>{x.name}</h3><p>{x.description||'—'}</p><strong>{money(x.price)} 🪙</strong><button className="btn primary" onClick={()=>buy(x.id)}>شراء</button></div>):<Empty text="المتجر فارغ حالياً."/>}</div></>; }
function Leaderboard() { const [rows,setRows]=useState([]); useEffect(()=>{api('/api/leaderboards/points').then(setRows).catch(()=>setRows([]));},[]); return <><Section tag="RANKING" title="المتصدرون" text="أعلى أعضاء LEGACY حسب النقاط." /><div className="leader-table">{rows.map((x,i)=><div key={x.discord_id||i} className="leader-row"><b>#{i+1}</b><Avatar me={x.avatar_url||''}/><span>{x.global_name||x.username}</span><strong>{money(x.points)} 🪙</strong></div>)}</div></>; }
function Social() { return <><Section tag="COMMUNITY" title="المجتمع" text="منطقة المنشورات والقصص والمحتوى الاجتماعي." /><Empty text="المجتمع قادم ضمن المرحلة التالية." /></>; }
function Premium({ me }) { return <><Section tag="PREMIUM" title="LEGACY Premium" text="تخصيصات ومزايا إضافية." /><div className="premium-card"><span>✦</span><h2>{me.premium_until ? 'Premium فعال' : 'Premium غير مفعل'}</h2><p>سيظهر هنا نظام Premium والتطويرات المرتبطة به.</p></div></>; }
function Notifications() { return <><Section tag="NOTIFICATIONS" title="الإشعارات" text="كل تنبيهات حسابك في مكان واحد." /><Empty text="لا توجد إشعارات جديدة." /></>; }
function Admin({ flash }) { const [rows,setRows]=useState([]); useEffect(()=>{api('/api/admin/users').then(setRows).catch(()=>setRows([]));},[]); return <><Section tag="ADMIN" title="الإدارة" text="إدارة مستخدمي واقتصاد LEGACY." /><div className="admin-grid">{rows.length?rows.map(x=><div className="admin-user" key={x.discord_id}><Avatar me={x.avatar_url||''}/><div><b>{x.global_name||x.username}</b><small>{x.discord_id}</small></div><strong>{money(x.points)} 🪙</strong></div>):<Empty text="لا توجد بيانات إدارة حالياً."/>}</div></>; }

createRoot(document.getElementById('root')).render(<App />);
