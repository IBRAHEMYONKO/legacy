require('dotenv').config({
  path: require('path').resolve(__dirname, '../../.env')
});
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { pool, ready } = require('./db');
const { registerExtendedRoutes } = require('./extended-routes');
const { registerAdminBotRoutes } = require('./admin-bot-routes');
const { joinLegacyGuild } = require('./discord-guild');
const app = express();
const port = Number(process.env.API_PORT || 4000);
const webUrl = process.env.WEB_URL || 'http://localhost:5173';
const activityUrl = process.env.ACTIVITY_URL || 'http://localhost:5174';
const adminIds = new Set((process.env.LEGACY_ADMIN_IDS || '').split(',').map(x => x.trim()).filter(Boolean));
const discordClientId = String(process.env.DISCORD_CLIENT_ID || '').trim();
const discordClientSecret = String(process.env.DISCORD_CLIENT_SECRET || '').trim();
const discordRedirectUri = String(process.env.DISCORD_REDIRECT_URI || '').trim();
const discordActivityRedirectUri = String(process.env.DISCORD_ACTIVITY_REDIRECT_URI || discordRedirectUri).trim();
const jwtSecret = String(process.env.JWT_SECRET || '').trim();

function oauthMissing(activity = false) {
  const missing = [];
  if (!discordClientId) missing.push('DISCORD_CLIENT_ID');
  if (!discordClientSecret) missing.push('DISCORD_CLIENT_SECRET');
  if (!discordRedirectUri) missing.push('DISCORD_REDIRECT_URI');
  if (activity && !discordActivityRedirectUri) missing.push('DISCORD_ACTIVITY_REDIRECT_URI');
  if (!jwtSecret) missing.push('JWT_SECRET');
  return [...new Set(missing)];
}

app.use(cors({ origin: [webUrl, activityUrl], credentials: true }));
app.use(express.json({ limit: '2mb' }));

function sign(user) {
  if (!jwtSecret) throw new Error('JWT_SECRET غير مضبوط في .env');
  return jwt.sign({ userId: user.id, discordId: user.discordId, admin: adminIds.has(user.discordId) }, jwtSecret, { expiresIn: '30d' });
}
function auth(req, res, next) {
  const v = req.headers.authorization || '';
  if (!v.startsWith('Bearer ')) return res.status(401).json({ error: 'غير مصرح' });
  try { req.auth = jwt.verify(v.slice(7), jwtSecret); next(); } catch { return res.status(401).json({ error: 'الجلسة منتهية، سجّل الدخول مرة أخرى' }); }
}
function admin(req, res, next) { if (!req.auth?.admin) return res.status(403).json({ error: 'هذه الصفحة للإدارة فقط' }); next(); }
function internal(req, res, next) { if (!process.env.LEGACY_INTERNAL_KEY || req.get('x-legacy-internal-key') !== process.env.LEGACY_INTERNAL_KEY) return res.status(401).json({ error: 'internal unauthorized' }); next(); }
app.get('/health', async (_req, res) => { try { await pool.query('SELECT 1'); res.json({ ok: true, service: 'legacy-api' }); } catch { res.status(503).json({ ok: false, service: 'legacy-api' }); } });

app.get('/auth/discord', (_req, res) => {
  const missing = oauthMissing(false);
  if (missing.length) return res.status(500).send(`إعدادات Discord OAuth ناقصة في .env: ${missing.join(', ')}`);
  const p = new URLSearchParams({
    client_id: discordClientId,
    redirect_uri: discordRedirectUri,
    response_type: 'code',
    scope: 'identify guilds.join',
    prompt: 'consent'
  });
  return res.redirect(`https://discord.com/oauth2/authorize?${p.toString()}`);
});

async function exchangeDiscordCode(code, redirectUri) {
  const missing = oauthMissing(false);
  if (missing.length) throw new Error(`Discord OAuth configuration missing: ${missing.join(', ')}`);
  if (!code) throw new Error('Missing Discord OAuth code');
  if (!redirectUri) throw new Error('Missing Discord OAuth redirect URI');
  const body = new URLSearchParams({ client_id: discordClientId, client_secret: discordClientSecret, grant_type: 'authorization_code', code, redirect_uri: redirectUri });
  const tr = await fetch('https://discord.com/api/v10/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!tr.ok) { const details = await tr.text().catch(() => ''); throw new Error(`OAuth token exchange failed (${tr.status})${details ? `: ${details}` : ''}`); }
  const token = await tr.json();
  const mr = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${token.access_token}` } });
  if (!mr.ok) throw new Error('Discord identity lookup failed');
  return { me: await mr.json(), accessToken: token.access_token };
}

function discordAvatar(me) { return me.avatar ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=256` : null; }

async function upsertDiscordUser(me) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const e = await c.query('SELECT user_id FROM discord_accounts WHERE discord_id=$1', [me.id]);
    let id;
    const discordDisplayName = me.global_name || me.username;
    const avatar = discordAvatar(me);
    if (e.rowCount) id = e.rows[0].user_id;
    else {
      const x = await c.query('INSERT INTO users DEFAULT VALUES RETURNING id');
      id = x.rows[0].id;
      await c.query('INSERT INTO profiles(user_id,display_name,avatar_url) VALUES($1,$2,$3)', [id, discordDisplayName, avatar]);
    }
    await c.query(`INSERT INTO discord_accounts(user_id,discord_id,username,global_name,avatar_url) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(discord_id) DO UPDATE SET username=EXCLUDED.username,global_name=EXCLUDED.global_name,avatar_url=EXCLUDED.avatar_url`, [id, me.id, me.username, me.global_name || null, avatar]);
    await c.query('UPDATE profiles SET display_name=$1,avatar_url=$2 WHERE user_id=$3', [discordDisplayName, avatar, id]);
    await c.query('COMMIT');
    return { id, discordId: me.id };
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}

app.get('/auth/discord/callback', async (req, res) => {
  if (!req.query.code) return res.status(400).send('Missing OAuth code');
  try {
    const oauth = await exchangeDiscordCode(req.query.code, discordRedirectUri);
    const user = await upsertDiscordUser(oauth.me);
    await joinLegacyGuild(oauth.me.id, oauth.accessToken);
    return res.redirect(`${webUrl}/?token=${encodeURIComponent(sign(user))}`);
  } catch (e) {
    console.error('[LEGACY:oauth]', e);
    const message = encodeURIComponent('فشل ربط Discord. تأكد من الموافقة على الصلاحيات، وأن بوت LEGACY موجود في السيرفر ولديه صلاحية إضافة الأعضاء، ثم حاول مرة ثانية.');
    return res.redirect(`${webUrl}/?auth_error=${message}`);
  }
});

app.post('/activity/auth', async (req, res) => {
  if (!req.body?.code) return res.status(400).json({ error: 'Missing Activity code' });
  const missing = oauthMissing(true);
  if (missing.length) return res.status(500).json({ error: `إعدادات Discord OAuth ناقصة: ${missing.join(', ')}` });
  try {
    const oauth = await exchangeDiscordCode(req.body.code, discordActivityRedirectUri);
    const user = await upsertDiscordUser(oauth.me);
    await joinLegacyGuild(oauth.me.id, oauth.accessToken);
    const p = await pool.query(`SELECT d.discord_id,d.username,d.global_name,d.avatar_url,d.global_name AS display_name,p.level,p.experience,p.premium_until,COALESCE((SELECT SUM(amount) FROM point_transactions WHERE user_id=u.id),0)::bigint AS points FROM users u JOIN discord_accounts d ON d.user_id=u.id JOIN profiles p ON p.user_id=u.id WHERE u.id=$1`, [user.id]);
    res.json({ token: sign(user), discordUser: oauth.me, me: p.rows[0] || null });
  } catch (e) { console.error('[LEGACY:activity-oauth]', e); res.status(403).json({ error: 'لا يمكن دخول LEGACY قبل ربط Discord والانضمام إلى السيرفر.' }); }
});

app.get('/api/me', auth, async (req, res) => {
  try {
    const r = await pool.query(`SELECT u.id,d.discord_id,d.username,d.global_name,d.avatar_url,d.global_name AS display_name,p.bio,p.banner_url,p.level,p.experience,p.premium_until,COALESCE((SELECT SUM(amount) FROM point_transactions WHERE user_id=u.id),0)::bigint AS points FROM users u JOIN discord_accounts d ON d.user_id=u.id JOIN profiles p ON p.user_id=u.id WHERE u.id=$1`, [req.auth.userId]);
    if (!r.rowCount) return res.status(404).json({ error: 'المستخدم غير موجود' });
    res.json({ ...r.rows[0], admin: !!req.auth.admin, discordLinked: true });
  } catch (error) {
    console.error('[LEGACY:api/me]', error);
    res.status(503).json({ error: 'تعذر تحميل حسابك حالياً، حاول مرة أخرى.' });
  }
});

app.get('/api/inventory', auth, async (req, res) => { const r = await pool.query(`SELECT i.quantity,i.acquired_at,c.* FROM inventory_items i JOIN catalog_items c ON c.id=i.item_id WHERE i.user_id=$1 ORDER BY i.acquired_at DESC`, [req.auth.userId]); res.json(r.rows); });
app.get('/api/shop', async (_req, res) => { const r = await pool.query('SELECT * FROM catalog_items WHERE active=true ORDER BY created_at DESC'); res.json(r.rows); });
app.get('/api/leaderboards/points', async (_req, res) => { const r = await pool.query(`SELECT d.username,d.global_name,d.avatar_url,COALESCE(SUM(t.amount),0)::bigint AS points,p.level FROM users u JOIN discord_accounts d ON d.user_id=u.id JOIN profiles p ON p.user_id=u.id LEFT JOIN point_transactions t ON t.user_id=u.id GROUP BY u.id,d.username,d.global_name,d.avatar_url,p.level ORDER BY points DESC LIMIT 50`); res.json(r.rows); });
app.get('/api/admin/users', auth, admin, async (req, res) => { const q = `%${String(req.query.q || '').slice(0,80)}%`; const r = await pool.query(`SELECT u.id,d.discord_id,d.username,d.global_name,d.global_name AS display_name,p.level,COALESCE((SELECT SUM(amount) FROM point_transactions WHERE user_id=u.id),0)::bigint AS points FROM users u JOIN discord_accounts d ON d.user_id=u.id JOIN profiles p ON p.user_id=u.id WHERE d.username ILIKE $1 OR d.global_name ILIKE $1 OR d.discord_id=$2 ORDER BY u.created_at DESC LIMIT 50`, [q, String(req.query.q || '')]); res.json(r.rows); });
app.post('/api/admin/points', auth, admin, async (req, res) => {
  const amount = Number(req.body.amount); const target = String(req.body.userId || '').trim(); const reason = String(req.body.reason || 'تعديل إداري').slice(0,200);
  if (!Number.isSafeInteger(amount) || amount === 0 || !target) return res.status(400).json({ error: 'بيانات غير صحيحة' });
  const targetUser = await pool.query('SELECT user_id FROM discord_accounts WHERE discord_id=$1', [target]);
  if (!targetUser.rowCount) return res.status(404).json({ error: 'المستخدم غير مرتبط بـ LEGACY' });
  await pool.query('INSERT INTO point_transactions(user_id,amount,reason,actor_user_id) VALUES($1,$2,$3,$4)', [targetUser.rows[0].user_id, amount, reason, req.auth.userId]);
  await pool.query('INSERT INTO audit_logs(actor_user_id,action,target_user_id,payload) VALUES($1,$2,$3,$4)', [req.auth.userId, 'points.adjust', targetUser.rows[0].user_id, JSON.stringify({ amount, reason })]);
  res.json({ ok: true });
});
app.post('/api/admin/catalog', auth, admin, async (req, res) => { const { type, slug, name, description = '', price = 0, metadata = {} } = req.body; if (!type || !slug || !name) return res.status(400).json({ error: 'النوع والاسم والمعرف مطلوبة' }); const r = await pool.query('INSERT INTO catalog_items(type,slug,name,description,price,metadata) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [type, slug, name, description, Number(price), JSON.stringify(metadata)]); await pool.query('INSERT INTO audit_logs(actor_user_id,action,payload) VALUES($1,$2,$3)', [req.auth.userId, 'catalog.create', JSON.stringify({ itemId: r.rows[0].id })]); res.status(201).json(r.rows[0]); });
app.get('/api/admin/audit', auth, admin, async (_req, res) => { const r = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100'); res.json(r.rows); });
app.get('/internal/user/:discordId', internal, async (req, res) => { const r = await pool.query(`SELECT u.id,d.discord_id,d.username,d.global_name,d.avatar_url,d.global_name AS display_name,p.bio,p.level,p.experience,p.premium_until,COALESCE((SELECT SUM(amount) FROM point_transactions WHERE user_id=u.id),0)::bigint AS points FROM users u JOIN discord_accounts d ON d.user_id=u.id JOIN profiles p ON p.user_id=u.id WHERE d.discord_id=$1`, [req.params.discordId]); if (!r.rowCount) return res.status(404).json({ error: 'المستخدم غير مرتبط بـ LEGACY بعد' }); res.json(r.rows[0]); });
app.get('/internal/user/:discordId/inventory', internal, async (req, res) => { const r = await pool.query(`SELECT i.quantity,i.acquired_at,c.id,c.type,c.slug,c.name,c.description,c.metadata FROM inventory_items i JOIN catalog_items c ON c.id=i.item_id JOIN discord_accounts d ON d.user_id=i.user_id WHERE d.discord_id=$1 ORDER BY i.acquired_at DESC`, [req.params.discordId]); res.json(r.rows); });
app.get('/internal/shop', internal, async (_req, res) => { const r = await pool.query('SELECT * FROM catalog_items WHERE active=true ORDER BY created_at DESC'); res.json(r.rows); });
app.get('/internal/audit', internal, async (_req, res) => { const r = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100'); res.json(r.rows); });
app.get('/internal/user/:discordId/cosmetics', internal, async (req, res) => {
  const user = await pool.query('SELECT user_id FROM discord_accounts WHERE discord_id=$1', [req.params.discordId]);
  if (!user.rowCount) return res.status(404).json({ error: 'المستخدم غير مرتبط بـ LEGACY بعد' });
  const userId = user.rows[0].user_id;
  const [items, selected, roles] = await Promise.all([
    pool.query(`SELECT c.*,i.quantity FROM inventory_items i JOIN catalog_items c ON c.id=i.item_id WHERE i.user_id=$1 AND i.quantity>0 AND c.active=true ORDER BY i.acquired_at DESC`, [userId]),
    pool.query('SELECT c.id,c.name,c.slug,c.metadata FROM profiles p LEFT JOIN catalog_items c ON c.id=p.selected_title_id WHERE p.user_id=$1', [userId]),
    pool.query('SELECT role FROM user_roles WHERE user_id=$1 ORDER BY role', [userId])
  ]);
  res.json({ items: items.rows, badges: items.rows.filter(x => x.type === 'badge'), titles: items.rows.filter(x => x.type === 'title'), selectedTitle: selected.rows[0] || null, roles: roles.rows.map(x => x.role) });
});
app.post('/internal/user/:discordId/shop/:itemId/buy', internal, async (req, res) => {
  const user = await pool.query('SELECT user_id FROM discord_accounts WHERE discord_id=$1', [req.params.discordId]);
  if (!user.rowCount) return res.status(404).json({ error: 'المستخدم غير مرتبط بـ LEGACY' });
  try {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [user.rows[0].user_id]);
      const item = await c.query('SELECT * FROM catalog_items WHERE id=$1 AND active=true FOR UPDATE', [req.params.itemId]);
      if (!item.rowCount) throw Object.assign(new Error('العنصر غير موجود'), { status: 404 });
      const balance = await c.query('SELECT COALESCE(SUM(amount),0)::bigint AS points FROM point_transactions WHERE user_id=$1', [user.rows[0].user_id]);
      const price = BigInt(item.rows[0].price);
      if (BigInt(balance.rows[0].points) < price) throw Object.assign(new Error('رصيدك غير كافٍ'), { status: 400 });
      await c.query('INSERT INTO point_transactions(user_id,amount,reason) VALUES($1,$2,$3)', [user.rows[0].user_id, -Number(price), `شراء: ${item.rows[0].name}`]);
      await c.query('INSERT INTO inventory_items(user_id,item_id,quantity) VALUES($1,$2,1) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=inventory_items.quantity+1,acquired_at=now()', [user.rows[0].user_id, item.rows[0].id]);
      await c.query('INSERT INTO purchases(user_id,item_id,price) VALUES($1,$2,$3)', [user.rows[0].user_id, item.rows[0].id, Number(price)]);
      await c.query('COMMIT');
      res.json({ ok: true, item: item.rows[0] });
    } catch (error) { await c.query('ROLLBACK').catch(() => {}); throw error; } finally { c.release(); }
  } catch (error) { res.status(error.status || 500).json({ error: error.message || 'فشل الشراء' }); }
});
app.post('/internal/admin/points', internal, async (req, res) => { const actor = String(req.body.actorDiscordId || ''), target = String(req.body.targetDiscordId || ''), amount = Number(req.body.amount), reason = String(req.body.reason || 'تعديل إداري').slice(0,200); if (!adminIds.has(actor)) return res.status(403).json({ error: 'الإدارة فقط' }); if (!target || !Number.isSafeInteger(amount) || amount === 0) return res.status(400).json({ error: 'بيانات غير صحيحة' }); const [t,a] = await Promise.all([pool.query('SELECT user_id FROM discord_accounts WHERE discord_id=$1', [target]), pool.query('SELECT user_id FROM discord_accounts WHERE discord_id=$1', [actor])]); if (!t.rowCount || !a.rowCount) return res.status(404).json({ error: 'الحساب غير مرتبط' }); await pool.query('INSERT INTO point_transactions(user_id,amount,reason,actor_user_id) VALUES($1,$2,$3,$4)', [t.rows[0].user_id, amount, reason, a.rows[0].user_id]); await pool.query('INSERT INTO audit_logs(actor_user_id,action,target_user_id,payload) VALUES($1,$2,$3,$4)', [a.rows[0].user_id, 'points.adjust', t.rows[0].user_id, JSON.stringify({ amount, reason, source: 'discord' })]); res.json({ ok: true }); });
app.post('/internal/admin/catalog', internal, async (req, res) => { const actor = String(req.body.actorDiscordId || ''); if (!adminIds.has(actor)) return res.status(403).json({ error: 'الإدارة فقط' }); const { type, slug, name, description = '', price = 0, metadata = {} } = req.body; if (!type || !slug || !name || !Number.isSafeInteger(Number(price)) || Number(price) < 0) return res.status(400).json({ error: 'بيانات العنصر غير صحيحة' }); const a = await pool.query('SELECT user_id FROM discord_accounts WHERE discord_id=$1', [actor]); if (!a.rowCount) return res.status(404).json({ error: 'حساب الإدارة غير مرتبط' }); const r = await pool.query('INSERT INTO catalog_items(type,slug,name,description,price,metadata) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [type, slug, name, description, Number(price), JSON.stringify(metadata)]); await pool.query('INSERT INTO audit_logs(actor_user_id,action,payload) VALUES($1,$2,$3)', [a.rows[0].user_id, 'catalog.create', JSON.stringify({ itemId: r.rows[0].id, source: 'discord' })]); res.status(201).json(r.rows[0]); });
registerAdminBotRoutes(app, { pool, internal, adminIds });
registerExtendedRoutes(app, { pool, auth, admin, internal, adminIds });

async function start() {
  try {
    await ready;
    await pool.query('SELECT 1');
    app.listen(port, () => console.log(`LEGACY API listening on :${port}`));
  } catch (error) {
    console.error('[LEGACY:api] DATABASE STARTUP FAILED');
    console.error(error?.stack || error);
    process.exitCode = 1;
  }
}

start();
