require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { pool } = require('./db');

const app = express();
const port = Number(process.env.API_PORT || 4000);
const webUrl = process.env.WEB_URL || 'http://localhost:5173';
const adminIds = new Set((process.env.LEGACY_ADMIN_IDS || '').split(',').map(x => x.trim()).filter(Boolean));

app.use(cors({ origin: [webUrl, process.env.ACTIVITY_URL || 'http://localhost:5174'], credentials: true }));
app.use(express.json({ limit: '2mb' }));

function sign(user) {
  return jwt.sign({ userId: user.id, discordId: user.discordId, admin: adminIds.has(user.discordId) }, process.env.JWT_SECRET, { expiresIn: '7d' });
}
function auth(req, res, next) {
  const value = req.headers.authorization || '';
  if (!value.startsWith('Bearer ')) return res.status(401).json({ error: 'غير مصرح' });
  try { req.auth = jwt.verify(value.slice(7), process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'الجلسة منتهية' }); }
}
function admin(req, res, next) {
  if (!req.auth?.admin) return res.status(403).json({ error: 'هذه الصفحة للإدارة فقط' });
  next();
}

app.get('/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true, service: 'legacy-api' }); }
  catch { res.status(503).json({ ok: false, service: 'legacy-api' }); }
});

app.get('/auth/discord', (_req, res) => {
  const params = new URLSearchParams({ client_id: process.env.DISCORD_CLIENT_ID || '', redirect_uri: process.env.DISCORD_REDIRECT_URI || '', response_type: 'code', scope: 'identify' });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

async function exchangeDiscordCode(code, redirectUri) {
  const body = new URLSearchParams({ client_id: process.env.DISCORD_CLIENT_ID, client_secret: process.env.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: redirectUri });
  const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!tokenResponse.ok) throw new Error('OAuth token exchange failed');
  const token = await tokenResponse.json();
  const meResponse = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${token.access_token}` } });
  if (!meResponse.ok) throw new Error('Discord identity lookup failed');
  return await meResponse.json();
}

async function upsertDiscordUser(me) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT user_id FROM discord_accounts WHERE discord_id=$1', [me.id]);
    let userId;
    if (existing.rowCount) userId = existing.rows[0].user_id;
    else {
      const created = await client.query('INSERT INTO users DEFAULT VALUES RETURNING id');
      userId = created.rows[0].id;
      await client.query('INSERT INTO profiles(user_id, display_name, avatar_url) VALUES($1,$2,$3)', [userId, me.global_name || me.username, me.avatar ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=256` : null]);
    }
    await client.query(`INSERT INTO discord_accounts(user_id,discord_id,username,global_name,avatar_url) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(discord_id) DO UPDATE SET username=EXCLUDED.username, global_name=EXCLUDED.global_name, avatar_url=EXCLUDED.avatar_url`, [userId, me.id, me.username, me.global_name || null, me.avatar ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=256` : null]);
    await client.query('COMMIT');
    return { id: userId, discordId: me.id };
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

app.get('/auth/discord/callback', async (req, res) => {
  if (!req.query.code) return res.status(400).send('Missing OAuth code');
  try {
    const me = await exchangeDiscordCode(req.query.code, process.env.DISCORD_REDIRECT_URI);
    const user = await upsertDiscordUser(me);
    res.redirect(`${webUrl}/?token=${encodeURIComponent(sign(user))}`);
  } catch (e) { console.error(e); res.status(500).send('فشل تسجيل الدخول عبر Discord'); }
});

// Discord Activity uses the same backend/account. Configure the Activity OAuth redirect
// and DISCORD_ACTIVITY_REDIRECT_URI in the Discord developer portal before production.
app.post('/activity/auth', async (req, res) => {
  if (!req.body?.code) return res.status(400).json({ error: 'Missing Activity code' });
  try {
    const me = await exchangeDiscordCode(req.body.code, process.env.DISCORD_ACTIVITY_REDIRECT_URI || process.env.DISCORD_REDIRECT_URI);
    const user = await upsertDiscordUser(me);
    const profile = await pool.query(`SELECT d.discord_id,d.username,d.global_name,d.avatar_url,p.display_name,p.level,p.experience,p.premium_until,
      COALESCE((SELECT SUM(amount) FROM point_transactions WHERE user_id=u.id),0)::bigint AS points
      FROM users u JOIN discord_accounts d ON d.user_id=u.id JOIN profiles p ON p.user_id=u.id WHERE u.id=$1`, [user.id]);
    res.json({ token: sign(user), discordUser: me, me: profile.rows[0] || null });
  } catch (e) { console.error(e); res.status(500).json({ error: 'فشل ربط Activity' }); }
});

app.get('/api/me', auth, async (req, res) => {
  const result = await pool.query(`SELECT u.id, d.discord_id, d.username, d.global_name, d.avatar_url,
    p.display_name, p.bio, p.banner_url, p.level, p.experience, p.premium_until,
    COALESCE((SELECT SUM(amount) FROM point_transactions WHERE user_id=u.id),0)::bigint AS points
    FROM users u JOIN discord_accounts d ON d.user_id=u.id JOIN profiles p ON p.user_id=u.id WHERE u.id=$1`, [req.auth.userId]);
  if (!result.rowCount) return res.status(404).json({ error: 'المستخدم غير موجود' });
  res.json({ ...result.rows[0], admin: !!req.auth.admin });
});

app.get('/api/inventory', auth, async (req, res) => {
  const result = await pool.query(`SELECT i.quantity, i.acquired_at, c.* FROM inventory_items i JOIN catalog_items c ON c.id=i.item_id WHERE i.user_id=$1 ORDER BY i.acquired_at DESC`, [req.auth.userId]);
  res.json(result.rows);
});

app.get('/api/shop', async (_req, res) => {
  const result = await pool.query(`SELECT * FROM catalog_items WHERE active=true ORDER BY created_at DESC`);
  res.json(result.rows);
});

app.get('/api/leaderboards/points', async (_req, res) => {
  const result = await pool.query(`SELECT d.username, d.global_name, d.avatar_url,
    COALESCE(SUM(t.amount),0)::bigint AS points, p.level
    FROM users u JOIN discord_accounts d ON d.user_id=u.id JOIN profiles p ON p.user_id=u.id
    LEFT JOIN point_transactions t ON t.user_id=u.id GROUP BY u.id,d.username,d.global_name,d.avatar_url,p.level
    ORDER BY points DESC LIMIT 50`);
  res.json(result.rows);
});

app.get('/api/admin/users', auth, admin, async (req, res) => {
  const q = `%${String(req.query.q || '').slice(0,80)}%`;
  const result = await pool.query(`SELECT u.id,d.discord_id,d.username,d.global_name,p.display_name,p.level,
    COALESCE((SELECT SUM(amount) FROM point_transactions WHERE user_id=u.id),0)::bigint AS points
    FROM users u JOIN discord_accounts d ON d.user_id=u.id JOIN profiles p ON p.user_id=u.id
    WHERE d.username ILIKE $1 OR d.global_name ILIKE $1 OR d.discord_id=$2 ORDER BY u.created_at DESC LIMIT 50`, [q, String(req.query.q || '')]);
  res.json(result.rows);
});

app.post('/api/admin/points', auth, admin, async (req, res) => {
  const amount = Number(req.body.amount);
  const target = String(req.body.userId || '');
  const reason = String(req.body.reason || 'تعديل إداري').slice(0,200);
  if (!Number.isSafeInteger(amount) || !target) return res.status(400).json({ error: 'بيانات غير صحيحة' });
  await pool.query('INSERT INTO point_transactions(user_id,amount,reason,actor_user_id) VALUES($1,$2,$3,$4)', [target, amount, reason, req.auth.userId]);
  await pool.query('INSERT INTO audit_logs(actor_user_id,action,target_user_id,payload) VALUES($1,$2,$3,$4)', [req.auth.userId, 'points.adjust', target, JSON.stringify({ amount, reason })]);
  res.json({ ok: true });
});

app.post('/api/admin/catalog', auth, admin, async (req, res) => {
  const { type, slug, name, description = '', price = 0, metadata = {} } = req.body;
  if (!type || !slug || !name) return res.status(400).json({ error: 'النوع والاسم والمعرف مطلوبة' });
  const result = await pool.query(`INSERT INTO catalog_items(type,slug,name,description,price,metadata) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`, [type, slug, name, description, Number(price), JSON.stringify(metadata)]);
  await pool.query('INSERT INTO audit_logs(actor_user_id,action,payload) VALUES($1,$2,$3)', [req.auth.userId, 'catalog.create', JSON.stringify({ itemId: result.rows[0].id })]);
  res.status(201).json(result.rows[0]);
});

app.get('/api/admin/audit', auth, admin, async (_req, res) => {
  const result = await pool.query(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100`);
  res.json(result.rows);
});

app.listen(port, () => console.log(`LEGACY API listening on :${port}`));
