import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');

const NAV = [
  ['home', '⌂', 'الرئيسية'],
  ['profile', '👤', 'البروفايل'],
  ['points', '◈', 'النقاط'],
  ['inventory', '▣', 'الحقيبة'],
  ['shop', '◆', 'المتجر'],
  ['leaderboard', '♛', 'المتصدرين'],
  ['social', '◎', 'المجتمع'],
  ['premium', '✦', 'Premium'],
  ['notifications', '◌', 'الإشعارات'],
  ['settings', '⚙', 'الإعدادات']
];

async function request(path, options = {}) {
  const token = localStorage.getItem('legacy_token') || '';
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    localStorage.removeItem('legacy_token');
    window.dispatchEvent(new Event('legacy:logout'));
  }
  if (!response.ok) throw new Error(data.error || 'حدث خطأ غير متوقع');
  return data;
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('legacy_token') || '');
  const [me, setMe] = useState(null);
  const [view, setView] = useState('home');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const urlToken = new URLSearchParams(window.location.search).get('token');
    if (urlToken) {
      localStorage.setItem('legacy_token', urlToken);
      setToken(urlToken);
      window.history.replaceState({}, '', window.location.pathname);
    }
    const logout = () => { setToken(''); setMe(null); setView('home'); };
    window.addEventListener('legacy:logout', logout);
    return () => window.removeEventListener('legacy:logout', logout);
  }, []);

  useEffect(() => {
    if (!token) return;
    request('/api/me').then(setMe).catch((e) => setError(e.message));
  }, [token]);

  const flash = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3500);
  };

  const logout = () => {
    localStorage.removeItem('legacy_token');
    setToken('');
    setMe(null);
  };

  if (!token) return <Landing />;

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <div className="brand-lockup"><div className="brand-mark">L</div><div><strong>LEGACY</strong><small>مساحتك الاجتماعية</small></div></div>
        <div className="top-actions">
          <button className="icon-button" onClick={() => setView('notifications')} aria-label="الإشعارات">◌</button>
          <button className="profile-chip" onClick={() => setView('profile')}>
            {me?.avatar_url ? <img src={me.avatar_url} alt="" /> : <span className="avatar-fallback">L</span>}
            <span>{me?.display_name || me?.global_name || me?.username || 'حسابي'}</span>
          </button>
          <button className="logout-button" onClick={logout}>خروج</button>
        </div>
      </header>

      <div className="app-layout">
        <aside className="sidebar">
          <div className="side-label">LEGACY</div>
          <nav>{NAV.map(([id, icon, label]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => { setView(id); setError(''); }}>{icon}<span>{label}</span></button>)}</nav>
          {me?.admin && <button className={`admin-link ${view === 'admin' ? 'active' : ''}`} onClick={() => setView('admin')}>♛<span>لوحة الإدارة</span></button>}
          <div className="sidebar-foot"><span className="online-dot" /> LEGACY متصل</div>
        </aside>

        <section className="content-area">
          {error && <div className="alert error-alert">{error}<button onClick={() => setError('')}>×</button></div>}
          {notice && <div className="alert success-alert">{notice}</div>}
          {view === 'home' && <Home me={me} setView={setView} />}
          {view === 'profile' && <Profile me={me} setMe={setMe} onNotice={flash} />}
          {view === 'points' && <Points me={me} />}
          {view === 'inventory' && <Inventory />}
          {view === 'shop' && <Shop onNotice={flash} />}
          {view === 'leaderboard' && <Leaderboard />}
          {view === 'social' && <Social onNotice={flash} />}
          {view === 'premium' && <Premium me={me} />}
          {view === 'notifications' && <Notifications />}
          {view === 'settings' && <Settings onLogout={logout} />}
          {view === 'admin' && me?.admin && <Admin onNotice={flash} />}
        </section>
      </div>
    </main>
  );
}

function Landing() {
  return <main className="landing">
    <div className="landing-orbit orbit-a" /><div className="landing-orbit orbit-b" />
    <section className="landing-card">
      <div className="landing-mark">L</div>
      <span className="eyebrow">LEGACY SOCIAL PLATFORM</span>
      <h1>مكانك.<br /><em>هويتك.</em><br />عالمك.</h1>
      <p>حساب اجتماعي واحد يجمع ملفك، مجتمعك، نقاطك، مقتنياتك وتجربتك داخل Discord والموقع والـ Activity.</p>
      <a className="login-button" href={`${API}/auth/discord`}><span>◈</span> تسجيل الدخول عبر Discord</a>
      <small className="landing-note">تسجيل الدخول محمي ويستخدم نفس الحساب في جميع واجهات LEGACY.</small>
    </section>
  </main>;
}

function PageTitle({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div><span>{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}

function Home({ me, setView }) {
  const cards = [
    ['profile', '👤', 'ملفي', 'تخصيص الاسم والنبذة والمظهر'],
    ['points', '◈', 'رصيدي', 'النقاط والمستوى والتقدم'],
    ['inventory', '▣', 'مقتنياتي', 'العناصر التي تملكها'],
    ['shop', '◆', 'المتجر', 'عناصر وتخصيصات جديدة'],
    ['social', '◎', 'المجتمع', 'الأصدقاء والتواصل'],
    ['premium', '✦', 'Premium', 'مزايا وتجربة إضافية']
  ];
  return <>
    <section className="hero-banner">
      <div><span className="eyebrow">مرحباً بك في مساحتك</span><h1>{me?.display_name || me?.global_name || me?.username || 'LEGACY'}</h1><p>كل ما يخص حسابك الاجتماعي محفوظ في مكان واحد ومربوط مباشرة بـ Discord.</p><button className="solid-button" onClick={() => setView('profile')}>فتح البروفايل</button></div>
      <div className="hero-orb"><span>L</span></div>
    </section>
    <div className="stats-strip">
      <Stat label="النقاط" value={me?.points ?? 0} /><Stat label="المستوى" value={`Lv.${me?.level ?? 1}`} /><Stat label="Premium" value={me?.premium_until ? 'فعال' : 'غير مشترك'} /><Stat label="الحساب" value="متصل" />
    </div>
    <PageTitle eyebrow="مساحتك" title="الوصول السريع" description="كل أقسام LEGACY في مكان واحد." />
    <div className="feature-grid">{cards.map(([id, icon, title, desc]) => <button className="feature-card" key={id} onClick={() => setView(id)}><span className="feature-icon">{icon}</span><div><h3>{title}</h3><p>{desc}</p></div><span className="arrow">←</span></button>)}</div>
  </>;
}

function Stat({ label, value }) { return <div className="stat"><span>{label}</span><strong>{value}</strong></div>; }

function Profile({ me, setMe, onNotice }) {
  const [displayName, setDisplayName] = useState(me?.display_name || '');
  const [bio, setBio] = useState(me?.bio || '');
  const [banner, setBanner] = useState(me?.banner_url || '');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDisplayName(me?.display_name || ''); setBio(me?.bio || ''); setBanner(me?.banner_url || ''); }, [me]);
  const save = async () => {
    setSaving(true);
    try { await request('/api/profile', { method: 'PUT', body: JSON.stringify({ displayName, bio, bannerUrl: banner }) }); const fresh = await request('/api/me'); setMe(fresh); onNotice('تم حفظ البروفايل.'); }
    catch (e) { onNotice(e.message); } finally { setSaving(false); }
  };
  return <><PageTitle eyebrow="حسابك" title="البروفايل" description="هويتك داخل عالم LEGACY." />
    <div className="profile-layout">
      <section className="profile-preview" style={banner ? { backgroundImage: `linear-gradient(180deg, rgba(5,20,18,.18), rgba(5,12,13,.96)), url(${banner})` } : undefined}>
        <div className="preview-avatar">{me?.avatar_url ? <img src={me.avatar_url} alt="" /> : 'L'}</div><h2>{displayName || me?.global_name || me?.username}</h2><p>{bio || 'أضف نبذة تعبر عنك.'}</p><div className="preview-meta"><span>Lv.{me?.level || 1}</span><span>{me?.points || 0} نقطة</span></div>
      </section>
      <section className="panel-card"><h2>تعديل البروفايل</h2><label>الاسم الظاهر<input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={40} /></label><label>النبذة<textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={500} rows={5} /></label><label>رابط خلفية البروفايل<input value={banner} onChange={e => setBanner(e.target.value)} placeholder="https://..." /></label><button className="solid-button" onClick={save} disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}</button></section>
    </div>
  </>;
}

function Points({ me }) { return <><PageTitle eyebrow="الاقتصاد" title="النقاط والتقدم" description="رصيدك يتبع حسابك ويظهر في كل واجهات LEGACY." /><div className="points-hero"><div><span>الرصيد الحالي</span><strong>{me?.points ?? 0}</strong><small>نقطة</small></div><div className="level-card"><span>المستوى الحالي</span><strong>Lv.{me?.level ?? 1}</strong><p>الخبرة: {me?.experience ?? 0}</p></div></div><section className="panel-card"><h2>كيف يعمل الرصيد؟</h2><p>النقاط محفوظة في قاعدة البيانات كسجل معاملات، لذلك تبقى متزامنة بين الموقع والبوت والـ Activity.</p></section></>; }

function Inventory() {
  const [items, setItems] = useState([]);
  useEffect(() => { request('/api/inventory').then(setItems).catch(() => {}); }, []);
  return <><PageTitle eyebrow="مقتنياتك" title="الحقيبة" description="كل العناصر التي حصلت عليها." /><div className="item-grid">{items.length ? items.map(x => <div className="item-card" key={x.id}><span className="item-art">✦</span><h3>{x.name}</h3><p>{x.description || 'عنصر من كتالوج LEGACY.'}</p><strong>× {x.quantity}</strong></div>) : <Empty text="حقيبتك فارغة حالياً. جرّب المتجر." />}</div></>;
}

function Shop({ onNotice }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState('');
  const load = () => request('/api/shop').then(setItems).catch(e => onNotice(e.message));
  useEffect(load, []);
  const buy = async (id) => { setBusy(id); try { await request(`/api/shop/${id}/buy`, { method: 'POST' }); onNotice('تم شراء العنصر وإضافته إلى حقيبتك.'); load(); } catch (e) { onNotice(e.message); } finally { setBusy(''); } };
  return <><PageTitle eyebrow="LEGACY Store" title="المتجر" description="تخصيصات وعناصر تُدار ديناميكياً من قاعدة البيانات." /><div className="item-grid">{items.length ? items.map(x => <div className="shop-card" key={x.id}><span className="item-art">{x.type === 'premium' ? '✦' : '◆'}</span><div className="item-type">{x.type}</div><h3>{x.name}</h3><p>{x.description || 'عنصر من LEGACY.'}</p><div className="shop-bottom"><strong>{x.price} نقطة</strong><button className="mini-button" onClick={() => buy(x.id)} disabled={busy === x.id}>{busy === x.id ? '...' : 'شراء'}</button></div></div>) : <Empty text="المتجر فارغ حالياً. أضف عناصر من لوحة الإدارة." />}</div></>;
}

function Leaderboard() {
  const [rows, setRows] = useState([]);
  useEffect(() => { request('/api/leaderboards/points').then(setRows).catch(() => {}); }, []);
  return <><PageTitle eyebrow="المنافسة" title="المتصدرين" description="أعلى الحسابات حسب النقاط." /><section className="leaderboard">{rows.length ? rows.map((r, i) => <div className={`leader-row rank-${i + 1}`} key={`${r.username}-${i}`}><span className="rank">#{i + 1}</span><div className="leader-avatar">{r.avatar_url ? <img src={r.avatar_url} alt="" /> : 'L'}</div><span className="leader-name">{r.global_name || r.username}</span><span className="leader-level">Lv.{r.level}</span><strong>{r.points}</strong></div>) : <Empty text="لا توجد بيانات متصدرين بعد." />}</section></>;
}

function Social({ onNotice }) {
  const [friends, setFriends] = useState([]);
  const [discordId, setDiscordId] = useState('');
  const [incoming, setIncoming] = useState([]);
  const load = async () => { try { const rows = await request('/api/friends'); setFriends(rows.filter(x => x.status === 'accepted')); setIncoming(rows.filter(x => x.status === 'pending')); } catch (e) { onNotice(e.message); } };
  useEffect(() => { load(); }, []);
  const add = async () => { try { await request('/api/friends/request', { method: 'POST', body: JSON.stringify({ discordId }) }); setDiscordId(''); onNotice('تم إرسال طلب الصداقة.'); load(); } catch (e) { onNotice(e.message); } };
  const respond = async (userId, accept) => { try { await request('/api/friends/respond', { method: 'POST', body: JSON.stringify({ fromUserId: userId, accept }) }); onNotice(accept ? 'تم قبول الطلب.' : 'تم رفض الطلب.'); load(); } catch (e) { onNotice(e.message); } };
  return <><PageTitle eyebrow="شبكتك" title="المجتمع" description="الأصدقاء والتواصل يبدأ من حسابك المشترك." /><section className="panel-card"><h2>إضافة صديق</h2><div className="inline-form"><input value={discordId} onChange={e => setDiscordId(e.target.value)} placeholder="Discord ID" /><button className="solid-button" onClick={add}>إرسال طلب</button></div></section><div className="social-grid"><section className="panel-card"><h2>الأصدقاء</h2>{friends.length ? friends.map(x => <div className="person-row" key={x.discord_id}><div className="leader-avatar">{x.avatar_url ? <img src={x.avatar_url} alt="" /> : 'L'}</div><span>{x.display_name || x.global_name || x.username}</span><small>Lv.{x.level}</small></div>) : <Empty text="لا يوجد أصدقاء مضافون بعد." />}</section><section className="panel-card"><h2>طلبات الصداقة</h2>{incoming.length ? incoming.map(x => <div className="request-row" key={x.discord_id}><span>{x.display_name || x.global_name || x.username}</span><div><button className="mini-button" onClick={() => respond(x.discord_id, true)}>قبول</button><button className="ghost-button" onClick={() => respond(x.discord_id, false)}>رفض</button></div></div>) : <Empty text="لا توجد طلبات جديدة." />}</section></div></>;
}

function Premium({ me }) { return <><PageTitle eyebrow="LEGACY+" title="Premium" description="تخصيصات ومزايا إضافية مرتبطة بحسابك." /><section className="premium-hero"><div><span className="premium-badge">✦ PREMIUM</span><h2>{me?.premium_until ? 'اشتراكك فعال' : 'افتح تجربة LEGACY الكاملة'}</h2><p>{me?.premium_until ? `فعال حتى ${new Date(me.premium_until).toLocaleString('ar')}` : 'Premium يفتح طبقات إضافية من التخصيص والمزايا.'}</p></div><div className="premium-orb">✦</div></section><div className="feature-grid"><div className="feature-card static"><span className="feature-icon">◈</span><div><h3>تخصيصات إضافية</h3><p>إطارات وخلفيات وتأثيرات واسم مميز.</p></div></div><div className="feature-card static"><span className="feature-icon">◆</span><div><h3>مزايا حصرية</h3><p>محتوى وامتيازات قابلة للتوسع.</p></div></div></div></>; }

function Notifications() { const [rows, setRows] = useState([]); const load = () => request('/api/notifications').then(setRows).catch(() => {}); useEffect(load, []); const read = async () => { await request('/api/notifications/read-all', { method: 'POST' }); load(); }; return <><PageTitle eyebrow="التنبيهات" title="الإشعارات" description="آخر ما حدث حول حسابك." action={<button className="ghost-button" onClick={read}>تحديد الكل كمقروء</button>} /><section className="notification-list">{rows.length ? rows.map(x => <div className={`notification ${x.read_at ? '' : 'unread'}`} key={x.id}><span>◌</span><div><strong>{x.type}</strong><p>{JSON.stringify(x.payload)}</p></div><small>{new Date(x.created_at).toLocaleString('ar')}</small></div>) : <Empty text="لا توجد إشعارات." />}</section></>; }

function Settings({ onLogout }) { return <><PageTitle eyebrow="الحساب" title="الإعدادات" description="إدارة جلسة LEGACY والخصوصية." /><section className="panel-card settings-card"><div><h2>الجلسة</h2><p>حسابك مربوط بـ Discord ويستخدم جلسة LEGACY الحالية.</p></div><button className="danger-button" onClick={onLogout}>تسجيل الخروج</button></section></>; }

function Admin({ onNotice }) {
  const [q, setQ] = useState(''); const [users, setUsers] = useState([]); const [logs, setLogs] = useState([]); const [code, setCode] = useState({ code: '', rewards: '[{"type":"points","amount":1000}]', maxUses: '', perUserLimit: '1', expiresAt: '' });
  const search = async () => { try { setUsers(await request(`/api/admin/users?q=${encodeURIComponent(q)}`)); } catch (e) { onNotice(e.message); } };
  const loadLogs = async () => { try { setLogs(await request('/api/admin/audit')); } catch (e) { onNotice(e.message); } };
  const createCode = async () => { try { const rewards = JSON.parse(code.rewards); await request('/api/admin/codes', { method: 'POST', body: JSON.stringify({ ...code, maxUses: code.maxUses || null, perUserLimit: Number(code.perUserLimit), rewards }) }); onNotice('تم إنشاء الكود.'); setCode({ ...code, code: '' }); } catch (e) { onNotice(e.message); } };
  return <><PageTitle eyebrow="CONTROL CENTER" title="لوحة الإدارة" description="إدارة المستخدمين والمحتوى والأكواد والسجلات." /><div className="admin-grid"><section className="panel-card"><h2>المستخدمون</h2><div className="inline-form"><input value={q} onChange={e => setQ(e.target.value)} placeholder="الاسم أو Discord ID" /><button className="solid-button" onClick={search}>بحث</button></div>{users.map(u => <div className="admin-user" key={u.id}><div><strong>{u.global_name || u.username}</strong><small>{u.discord_id}</small></div><span>{u.points} نقطة · Lv.{u.level}</span></div>)}</section><section className="panel-card"><h2>إنشاء كود مكافأة</h2><label>الكود<input value={code.code} onChange={e => setCode({ ...code, code: e.target.value })} placeholder="LEGACY-2026" /></label><label>المكافآت JSON<textarea rows={4} value={code.rewards} onChange={e => setCode({ ...code, rewards: e.target.value })} /></label><label>الحد الأقصى للاستخدام<input value={code.maxUses} onChange={e => setCode({ ...code, maxUses: e.target.value })} placeholder="فارغ = غير محدود" /></label><label>حد المستخدم الواحد<input value={code.perUserLimit} onChange={e => setCode({ ...code, perUserLimit: e.target.value })} /></label><button className="solid-button" onClick={createCode}>إنشاء الكود</button></section><section className="panel-card"><div className="panel-heading"><h2>السجلات</h2><button className="ghost-button" onClick={loadLogs}>تحديث</button></div>{logs.map(x => <div className="log-row" key={x.id}><strong>{x.action}</strong><span>{new Date(x.created_at).toLocaleString('ar')}</span></div>)}</section></div></>;
}

function Empty({ text }) { return <div className="empty"><span>◌</span><p>{text}</p></div>; }

createRoot(document.getElementById('root')).render(<App />);
