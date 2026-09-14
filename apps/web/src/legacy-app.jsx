import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './legacy-app.css';

const configuredApi = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
// في التطوير المحلي استخدم نفس عنوان الموقع حتى تمر كل طلبات API عبر Vite proxy.
// هذا يمنع مشاكل CORS واختلاف localhost عن عنوان الشبكة المحلية.
const API = configuredApi || location.origin;

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
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    const urlToken = new URLSearchParams(location.search).get('token');
    if (urlToken) {
      localStorage.setItem('legacy_token', urlToken);
      setToken(urlToken);
      setLoading(true);
      history.replaceState({}, '', location.pathname);
    }
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
      .then(data => {
        if (!active) return;
        setMe(data);
        setLoading(false);
      })
      .catch(err => {
        if (!active) return;
        setMe(null);
        setError(err.message || 'تعذر تحميل حسابك.');
        setLoading(false);
      });

    return () => { active = false; };
  }, [token]);

  const flash = message => { setNotice(message); window.clearTimeout(flash.timer); flash.timer = window.setTimeout(() => setNotice(''), 3200); };
  const logout = () => { localStorage.removeItem('legacy_token'); setToken(''); setMe(null); setLoading(false); };
  const retry = () => { setError(''); setLoading(true); setToken(localStorage.getItem('legacy_token') || ''); };
  const navigate = id => { setView(id); setMobileNav(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };

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
        <div className="sidebar-bottom">
          <div className="balance-mini"><span>🪙</span><div><small>رصيدك</small><b>{money(me.points)}</b></div></div>
          <button className="logout" onClick={logout}>تسجيل الخروج</button>
        </div>
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

function Landing() {
  const login = `${API}/auth/discord`;
  return <main className="landing">
    <div className="landing-orbit orbit-a" /><div className="landing-orbit orbit-b" />
    <section className="landing-card">
      <div className="landing-logo">L</div><span className="eyebrow">LEGACY SOCIAL PLATFORM</span>
      <h1>مو مجرد موقع.<br /><em>هذا عالمك.</em></h1>
      <p>هوية Discord، مجتمع، نقاط، مقتنيات، شارات وPremium — في مساحة واحدة.</p>
      <a className="discord-button" href={login}><span>◈</span> الدخول عبر Discord</a>
      <div className="landing-features"><span>● هوية Discord</span><span>✦ Economy</span><span>♛ Community</span></div>
    </section>
  </main>;
}

function LoadingScreen() { return <main className="loading"><div className="spinner" /><b>جاري تحميل LEGACY...</b><small>نزامن حسابك مع Discord</small></main>; }
function AuthErrorScreen({ message, onRetry, onLogout }) { return <main className="loading"><div className="auth-error-card"><span className="eyebrow">LEGACY • تسجيل الدخول</span><h2>تعذر تحميل حسابك</h2><p>{message}</p><div className="hero-actions"><button className="btn primary" onClick={onRetry}>إعادة المحاولة</button><button className="btn secondary" onClick={onLogout}>تسجيل الخروج</button></div></div></main>; }
function Section({ tag, title, text }) { return <div className="section-head"><div><span>{tag}</span><h1>{title}</h1>{text && <p>{text}</p>}</div></div>; }
function Empty({ text }) { return <div className="empty"><span>◇</span><p>{text}</p></div>; }
function Tilt({ children, className = '' }) { return <div className={`interactive ${className}`}>{children}</div>; }

function Home({ me, go }) {
  const [leaders, setLeaders] = useState([]); const [shop, setShop] = useState([]);
  useEffect(() => { api('/api/leaderboards/points').then(x => setLeaders((Array.isArray(x) ? x : []).slice(0, 5))).catch(() => {}); api('/api/shop').then(setShop).catch(() => {}); }, []);
  const name = discordName(me);
  return <>
    <section className="hero interactive">
      <div className="hero-copy"><span className="eyebrow live"><i /> ACCOUNT ONLINE</span><h1>هلا <em>{name}</em> 👋</h1><p>هذا مركزك في LEGACY. تابع مستواك، طوّر حضورك، اجمع النقاط وخلي هويتك من Discord هي الأساس.</p><div className="hero-actions"><button className="btn primary" onClick={() => go('profile')}>افتح بروفايلك</button><button className="btn secondary" onClick={() => go('shop')}>استكشف المتجر</button></div></div>
      <div className="hero-identity"><div className="avatar-ring"><Avatar me={me}/></div><b>{name}</b><span>@{me.username}</span><div className="identity-stats"><div><small>المستوى</small><strong>Lv.{me.level || 1}</strong></div><div><small>النقاط</small><strong>{money(me.points)}</strong></div></div></div>
    </section>
    <div className="stats-row"><Stat icon="🪙" label="النقاط" value={money(me.points)} /><Stat icon="⚡" label="المستوى" value={`Lv.${me.level || 1}`} /><Stat icon="💎" label="Premium" value={me.premium_until ? 'فعال' : 'غير مفعل'} /><Stat icon="🎒" label="المقتنيات" value="استعرض" onClick={() => go('inventory')} /></div>
    <div className="home-columns"><Tilt className="panel"><Section tag="LIVE AREA" title="مساحتك الآن" text="كل ما تحتاجه في مكان واحد." /><div className="activity"><Avatar me={me}/><div><b>{name}</b><small>حساب Discord المرتبط • الآن</small></div><span className="more">•••</span><h3>هويتك محفوظة من Discord</h3><p>اسمك وصورتك مصدرهما حساب Discord المرتبط. التخصيص في LEGACY يضيف البايو واللقب والشارات والخلفية بدون تغيير هويتك الأساسية.</p><div className="quick-actions"><button onClick={() => go('profile')}>✦ التخصيص</button><button onClick={() => go('inventory')}>▣ الحقيبة</button><button onClick={() => go('leaderboard')}>♛ الترتيب</button></div></div></Tilt>
      <Tilt className="panel"><Section tag="TOP" title="المتصدرون" /><div className="leader-list">{leaders.length ? leaders.map((x, i) => <div className="leader-row" key={x.discord_id || i}><b>#{i + 1}</b><Avatar me={x.avatar_url || ''}/><span>{x.global_name || x.username || 'عضو'}</span><strong>{money(x.points)}</strong></div>) : <Empty text="لا يوجد ترتيب حتى الآن." />}</div><button className="text-button" onClick={() => go('leaderboard')}>عرض الكل ←</button></Tilt>
    </div>
    <section className="discover"><Section tag="DISCOVER" title="وش تسوي الآن؟" /><div className="discover-grid"><ActionCard icon="◉" title="هويتك" text="اسم وصورة Discord ثابتة." onClick={() => go('profile')} /><ActionCard icon="◆" title="المتجر" text={`${shop.length} عناصر متاحة.`} onClick={() => go('shop')} /><ActionCard icon="♛" title="نافس" text="تابع ترتيب النقاط." onClick={() => go('leaderboard')} /><ActionCard icon="✦" title="Premium" text="مزايا وتخصيصات إضافية." onClick={() => go('premium')} /></div></section>
  </>;
}
function Stat({ icon, label, value, onClick }) { return <button className="stat-card interactive" onClick={onClick}><span>{icon}</span><div><small>{label}</small><b>{value}</b></div></button>; }
function ActionCard({ icon, title, text, onClick }) { return <button className="action-card interactive" onClick={onClick}><span>{icon}</span><div><b>{title}</b><p>{text}</p></div><i>←</i></button>; }

function Profile({ me, refresh, flash }) {
  const [bio, setBio] = useState(me.bio || ''); const [banner, setBanner] = useState(me.banner_url || ''); const [cos, setCos] = useState(null); const [saving, setSaving] = useState(false);
  useEffect(() => { api('/api/cosmetics').then(setCos).catch(() => {}); }, []);
  const save = async () => { setSaving(true); try { await api('/api/profile', { method: 'PUT', body: JSON.stringify({ bio, bannerUrl: banner }) }); await refresh(); flash('تم حفظ تخصيصات البروفايل.'); } catch (e) { flash(e.message); } finally { setSaving(false); } };
  const badges = cos?.badges || [];
  const title = cos?.selectedTitle?.name || 'بدون لقب';
  return <><Section tag="IDENTITY" title="بروفايلك" text="اسمك وصورتك من Discord ولا يمكن تعديلهما من LEGACY." />
    <div className="profile-grid"><Tilt className="profile-preview" style={{}}><div className="profile-cover" style={banner ? { backgroundImage: `linear-gradient(180deg,transparent,#071016),url(${banner})` } : {}} /><div className="discord-lock">✓ هوية Discord</div><Avatar me={me} className="profile-avatar"/><h2>{discordName(me)}</h2><p className="username">@{me.username}</p><span className="title-chip">♛ {title}</span><p className="bio">{bio || 'أضف نبذة تعريفية من إعدادات LEGACY.'}</p><div className="badge-row">{badges.length ? badges.map(x => <span key={x.id}>{x.metadata?.icon || '🏅'} {x.name}</span>) : <span>🏅 لا توجد شارات بعد</span>}</div><div className="profile-stats"><div><b>{money(me.points)}</b><small>نقطة</small></div><div><b>Lv.{me.level || 1}</b><small>المستوى</small></div><div><b>{me.premium_until ? '✓' : '—'}</b><small>Premium</small></div></div></Tilt>
      <Tilt className="settings-card"><div className="locked-field"><span>اسم Discord</span><b>{discordName(me)}</b><i>🔒</i></div><div className="locked-field"><span>صورة Discord</span><div className="locked-user"><Avatar me={me}/><b>مزامنة مباشرة</b></div><i>🔒</i></div><label>النبذة<textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={500} rows={5} placeholder="اكتب نبذة عنك..." /></label><label>الخلفية<input value={banner} onChange={e => setBanner(e.target.value)} maxLength={1000} placeholder="رابط صورة الخلفية" /></label><button className="btn primary wide" disabled={saving} onClick={save}>{saving ? 'جاري الحفظ...' : 'حفظ التخصيص'}</button></Tilt></div></>;
}

function Points({ me }) { const xp = Number(me.experience || 0); const progress = Math.min(100, xp % 100); const [history, setHistory] = useState([]); useEffect(() => { api('/api/points/history').then(setHistory).catch(() => {}); }, []); return <><Section tag="ECONOMY" title="النقاط والتقدم" text="رصيدك محفوظ في النظام المشترك." /><div className="points-hero"><div><small>الرصيد الحالي</small><strong>{money(me.points)}</strong><span>نقطة</span></div><div><small>المستوى الحالي</small><b>Lv.{me.level || 1}</b><div className="progress"><i style={{ width: `${progress}%` }} /></div><small>{xp} XP • {progress}%</small></div></div><div className="history"><h2>آخر الحركات</h2>{history.length ? history.slice(0, 12).map((x, i) => <div className="history-row" key={i}><span>{Number(x.amount) >= 0 ? '+' : ''}{money(x.amount)}</span><p>{x.reason || 'حركة نقاط'}</p><small>{new Date(x.created_at).toLocaleDateString('ar-IQ')}</small></div>) : <Empty text="لا توجد حركات نقاط حتى الآن." />}</div></>; }

function Inventory() { const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); useEffect(() => { api('/api/inventory').then(setItems).catch(() => {}).finally(() => setLoading(false)); }, []); return <><Section tag="COLLECTION" title="الحقيبة" text="كل العناصر التي تملكها في LEGACY." />{loading ? <LoadingInline /> : items.length ? <div className="cards-grid">{items.map(item => <Tilt className="collection-card" key={item.id}><span>{item.metadata?.icon || iconFor(item.type)}</span><small>{item.type}</small><h3>{item.name}</h3><p>{item.description || 'عنصر من مقتنيات LEGACY.'}</p><b>× {item.quantity}</b></Tilt>)}</div> : <Empty text="حقيبتك فارغة حالياً. اذهب للمتجر." />}</>; }
function iconFor(type) { return type === 'badge' ? '🏅' : type === 'title' ? '♛' : type === 'frame' ? '◉' : '✦'; }

function Shop({ me, flash, refresh }) { const [items, setItems] = useState([]); const [busy, setBusy] = useState(''); useEffect(() => { api('/api/shop').then(setItems).catch(() => {}); }, []); const buy = async item => { setBusy(item.id); try { await api(`/api/shop/${item.id}/buy`, { method: 'POST' }); await refresh(); flash(`تم شراء ${item.name}.`); } catch (e) { flash(e.message); } finally { setBusy(''); } }; return <><Section tag="STORE" title="المتجر" text={`رصيدك الحالي ${money(me.points)} نقطة.`} /><div className="shop-banner"><div><span>LEGACY STORE</span><h2>خل بروفايلك يختلف.</h2><p>ألقاب، شارات ومقتنيات تضيفها لهويتك.</p></div><b>🪙 {money(me.points)}</b></div><div className="cards-grid">{items.length ? items.map(item => <Tilt className="store-card" key={item.id}><div className="store-art">{item.metadata?.icon || iconFor(item.type)}</div><small>{item.type}</small><h3>{item.name}</h3><p>{item.description || 'عنصر جديد من LEGACY.'}</p><div className="store-buy"><strong>{money(item.price)} 🪙</strong><button disabled={busy === item.id} onClick={() => buy(item)}>{busy === item.id ? '...' : 'شراء'}</button></div></Tilt>) : <Empty text="المتجر فارغ حالياً." />}</div></>; }

function Leaderboard() { const [rows, setRows] = useState([]); useEffect(() => { api('/api/leaderboards/points').then(setRows).catch(() => {}); }, []); return <><Section tag="RANKING" title="المتصدرون" text="ترتيب المجتمع حسب النقاط." /><div className="ranking">{rows.length ? rows.map((x, i) => <div className={`ranking-row ${i < 3 ? 'top' : ''}`} key={x.discord_id || i}><b>#{i + 1}</b><Avatar me={x.avatar_url || ''}/><div><strong>{x.global_name || x.username}</strong><small>@{x.username}</small></div><span>{money(x.points)} نقطة</span></div>) : <Empty text="لا يوجد متصدرون بعد." />}</div></>; }

function Social({ flash }) { const [friends, setFriends] = useState([]); const [incoming, setIncoming] = useState([]); const [id, setId] = useState(''); const load = () => { api('/api/friends').then(setFriends).catch(() => {}); api('/api/friends/incoming').then(setIncoming).catch(() => {}); }; useEffect(load, []); const add = async e => { e.preventDefault(); try { await api('/api/friends/request', { method: 'POST', body: JSON.stringify({ discordId: id.trim() }) }); setId(''); flash('تم إرسال طلب الصداقة.'); load(); } catch (x) { flash(x.message); } }; const respond = async (fromUserId, accept) => { try { await api('/api/friends/respond', { method: 'POST', body: JSON.stringify({ fromUserId, accept }) }); load(); } catch (x) { flash(x.message); } }; return <><Section tag="COMMUNITY" title="المجتمع" text="أضف أصدقاءك المرتبطين بـ Discord." /><div className="social-grid"><Tilt className="panel"><h2>إضافة صديق</h2><form className="friend-form" onSubmit={add}><input value={id} onChange={e => setId(e.target.value)} placeholder="Discord ID" /><button className="btn primary">إرسال</button></form><h3>طلبات واردة</h3>{incoming.length ? incoming.map(x => <div className="friend-row" key={x.relation_user_id}><Avatar me={x.avatar_url || ''}/><span>{x.global_name || x.username}</span><button onClick={() => respond(x.relation_user_id, true)}>قبول</button><button onClick={() => respond(x.relation_user_id, false)}>رفض</button></div>) : <Empty text="لا توجد طلبات جديدة." />}</Tilt><Tilt className="panel"><h2>أصدقاؤك</h2>{friends.length ? friends.map((x, i) => <div className="friend-row" key={x.discord_id || i}><Avatar me={x.avatar_url || ''}/><span>{x.global_name || x.username}</span><small>{x.status === 'accepted' ? 'صديق' : 'قيد الانتظار'}</small></div>) : <Empty text="أضف أول صديق لك." />}</Tilt></div></>; }

function Premium({ me }) { return <><Section tag="PREMIUM" title="LEGACY Premium" text="تخصيصات ومزايا إضافية مرتبطة بحسابك." /><div className="premium-card"><div><span>✦ LEGACY PREMIUM</span><h2>{me.premium_until ? 'Premium فعال عندك' : 'خل تجربتك أوسع.'}</h2><p>{me.premium_until ? `ينتهي في ${new Date(me.premium_until).toLocaleString('ar-IQ')}` : 'عند تفعيل Premium تحصل على مزايا إضافية عندما يجهز نظام الاشتراك.'}</p></div><div className="premium-features"><b>✦ تخصيصات إضافية</b><b>✦ شارات Premium</b><b>✦ مزايا حصرية</b></div></div></>; }

function Notifications() { const [rows, setRows] = useState([]); const load = () => api('/api/notifications').then(setRows).catch(() => {}); useEffect(load, []); const read = async () => { await api('/api/notifications/read-all', { method: 'POST' }).catch(() => {}); load(); }; return <><Section tag="INBOX" title="الإشعارات" text="آخر تنبيهات حسابك." /><button className="btn secondary" onClick={read}>تحديد الكل كمقروء</button><div className="notifications-list">{rows.length ? rows.map(x => <div className={`notification ${x.read_at ? '' : 'unread'}`} key={x.id}><span>◌</span><div><b>{x.type || 'إشعار'}</b><p>{typeof x.payload === 'string' ? x.payload : JSON.stringify(x.payload || {})}</p></div></div>) : <Empty text="لا توجد إشعارات." />}</div></>; }

function Admin({ flash }) { const [stats, setStats] = useState(null); const [users, setUsers] = useState([]); useEffect(() => { api('/api/admin/users').then(setUsers).catch(() => {}); }, []); const addPoints = async () => { const target = window.prompt('Discord ID للمستخدم'); const amount = Number(window.prompt('عدد النقاط (+ أو -)')); if (!target || !Number.isSafeInteger(amount) || amount === 0) return; try { await api('/api/admin/points', { method: 'POST', body: JSON.stringify({ userId: target, amount, reason: 'تعديل من لوحة LEGACY' }) }); flash('تم تعديل النقاط.'); } catch (e) { flash(e.message); } }; return <><Section tag="CONTROL CENTER" title="الإدارة" text="لوحة إدارة LEGACY الأساسية." /><div className="admin-actions"><button className="btn primary" onClick={addPoints}>＋ تعديل نقاط</button><button className="btn secondary" onClick={() => api('/api/admin/audit').then(x => window.alert(`آخر سجلات: ${x.length}`)).catch(e => flash(e.message))}>سجل الإدارة</button></div><div className="panel"><h2>المستخدمون</h2>{users.length ? users.slice(0, 30).map(x => <div className="admin-user" key={x.discord_id}><div><b>{x.global_name || x.username}</b><small>{x.discord_id}</small></div><strong>{money(x.points)} 🪙</strong></div>) : <Empty text="لا توجد حسابات مرتبطة بعد." />}</div></>; }

function LoadingInline() { return <div className="inline-loading"><div className="spinner" /> جاري التحميل...</div>; }

createRoot(document.getElementById('root')).render(<App />);
