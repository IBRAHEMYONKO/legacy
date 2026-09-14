const { normalizeRewards } = require('./rewards');
const { registerBotRoutes } = require('./bot-routes');

function registerExtendedRoutes(app, { pool, auth, admin, internal, adminIds }) {
  app.put('/api/profile', auth, async (req, res) => {
    const displayName = String(req.body.displayName ?? '').trim().slice(0, 40);
    const bio = String(req.body.bio ?? '').slice(0, 500);
    const bannerUrl = String(req.body.bannerUrl ?? '').trim().slice(0, 1000) || null;
    await pool.query('UPDATE profiles SET display_name=$1,bio=$2,banner_url=$3 WHERE user_id=$4', [displayName || null, bio, bannerUrl, req.auth.userId]);
    res.json({ ok: true });
  });
  app.get('/api/notifications', auth, async (req, res) => {
    const r = await pool.query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50', [req.auth.userId]);
    res.json(r.rows);
  });
  app.post('/api/notifications/read-all', auth, async (req, res) => {
    await pool.query('UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL', [req.auth.userId]);
    res.json({ ok: true });
  });
  app.post('/api/shop/:itemId/buy', auth, async (req, res) => {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [req.auth.userId]);
      const item = await c.query('SELECT * FROM catalog_items WHERE id=$1 AND active=true FOR UPDATE', [req.params.itemId]);
      if (!item.rowCount) throw Object.assign(new Error('العنصر غير موجود'), { status: 404 });
      const price = Number(item.rows[0].price);
      const balance = await c.query('SELECT COALESCE(SUM(amount),0)::bigint AS points FROM point_transactions WHERE user_id=$1', [req.auth.userId]);
      if (BigInt(balance.rows[0].points) < BigInt(price)) throw Object.assign(new Error('رصيدك غير كافٍ'), { status: 400 });
      await c.query('INSERT INTO point_transactions(user_id,amount,reason) VALUES($1,$2,$3)', [req.auth.userId, -price, `شراء: ${item.rows[0].name}`]);
      await c.query('INSERT INTO inventory_items(user_id,item_id,quantity) VALUES($1,$2,1) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=inventory_items.quantity+1,acquired_at=now()', [req.auth.userId, item.rows[0].id]);
      await c.query('INSERT INTO purchases(user_id,item_id,price) VALUES($1,$2,$3)', [req.auth.userId, item.rows[0].id, price]);
      await c.query('COMMIT');
      res.json({ ok: true, item: item.rows[0] });
    } catch (e) { await c.query('ROLLBACK'); res.status(e.status || 500).json({ error: e.message || 'فشل الشراء' }); } finally { c.release(); }
  });
  app.post('/api/codes/redeem', auth, async (req, res) => {
    const code = String(req.body.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: 'أدخل الكود' });
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const found = await c.query('SELECT * FROM redeem_codes WHERE code=$1 FOR UPDATE', [code]);
      if (!found.rowCount) throw Object.assign(new Error('الكود غير موجود'), { status: 404 });
      const item = found.rows[0];
      if (!item.active) throw Object.assign(new Error('الكود متوقف'), { status: 400 });
      if (item.expires_at && new Date(item.expires_at) <= new Date()) throw Object.assign(new Error('انتهت صلاحية الكود'), { status: 400 });
      if (item.max_uses !== null && item.uses >= item.max_uses) throw Object.assign(new Error('اكتملت استخدامات الكود'), { status: 400 });
      const used = await c.query('SELECT COUNT(*)::int AS count FROM code_redemptions WHERE code_id=$1 AND user_id=$2', [item.id, req.auth.userId]);
      if (used.rows[0].count >= item.per_user_limit) throw Object.assign(new Error('سبق واستخدمت هذا الكود'), { status: 400 });
      const rewards = normalizeRewards(item.rewards);
      for (const reward of rewards) {
        if (reward.type === 'points') await c.query('INSERT INTO point_transactions(user_id,amount,reason) VALUES($1,$2,$3)', [req.auth.userId, reward.amount, `كود: ${code}`]);
        if (reward.type === 'item') {
          const exists = await c.query('SELECT id FROM catalog_items WHERE id=$1 AND active=true', [reward.itemId]);
          if (!exists.rowCount) throw Object.assign(new Error('عنصر المكافأة غير موجود'), { status: 400 });
          await c.query('INSERT INTO inventory_items(user_id,item_id,quantity) VALUES($1,$2,$3) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=inventory_items.quantity+EXCLUDED.quantity,acquired_at=now()', [req.auth.userId, reward.itemId, reward.quantity]);
        }
        if (reward.type === 'premium_days') await c.query("UPDATE profiles SET premium_until=GREATEST(COALESCE(premium_until,now()),now()) + ($1 || ' days')::interval WHERE user_id=$2", [reward.days, req.auth.userId]);
      }
      await c.query('INSERT INTO code_redemptions(code_id,user_id) VALUES($1,$2)', [item.id, req.auth.userId]);
      await c.query('UPDATE redeem_codes SET uses=uses+1 WHERE id=$1', [item.id]);
      await c.query('COMMIT');
      res.json({ ok: true, rewards });
    } catch (e) { await c.query('ROLLBACK'); res.status(e.status || 500).json({ error: e.message || 'فشل استرداد الكود' }); } finally { c.release(); }
  });
  app.get('/api/friends', auth, async (req, res) => {
    const r = await pool.query('SELECT f.status,f.created_at,d.discord_id,d.username,d.global_name,d.avatar_url,p.display_name,p.level FROM friendships f JOIN users u ON u.id=f.other_user_id JOIN discord_accounts d ON d.user_id=u.id JOIN profiles p ON p.user_id=u.id WHERE f.user_id=$1 ORDER BY f.updated_at DESC', [req.auth.userId]);
    res.json(r.rows);
  });
  app.post('/api/friends/request', auth, async (req, res) => {
    const discordId = String(req.body.discordId || '').trim();
    const target = await pool.query('SELECT user_id FROM discord_accounts WHERE discord_id=$1', [discordId]);
    if (!target.rowCount) return res.status(404).json({ error: 'المستخدم غير موجود' });
    const targetId = target.rows[0].user_id;
    if (targetId === req.auth.userId) return res.status(400).json({ error: 'لا يمكنك إضافة نفسك' });
    await pool.query("INSERT INTO friendships(user_id,other_user_id,status) VALUES($1,$2,'pending') ON CONFLICT(user_id,other_user_id) DO UPDATE SET status='pending',updated_at=now()", [req.auth.userId, targetId]);
    await pool.query("INSERT INTO notifications(user_id,type,payload) VALUES($1,'friend_request',$2)", [targetId, JSON.stringify({ fromUserId: req.auth.userId })]);
    res.json({ ok: true });
  });
  app.post('/api/friends/respond', auth, async (req, res) => {
    const fromUserId = String(req.body.fromUserId || '');
    const accept = Boolean(req.body.accept);
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const request = await c.query('SELECT status FROM friendships WHERE user_id=$1 AND other_user_id=$2 FOR UPDATE', [fromUserId, req.auth.userId]);
      if (!request.rowCount || request.rows[0].status !== 'pending') throw Object.assign(new Error('طلب الصداقة غير موجود'), { status: 404 });
      if (accept) {
        await c.query("UPDATE friendships SET status='accepted',updated_at=now() WHERE user_id=$1 AND other_user_id=$2", [fromUserId, req.auth.userId]);
        await c.query("INSERT INTO friendships(user_id,other_user_id,status) VALUES($1,$2,'accepted') ON CONFLICT(user_id,other_user_id) DO UPDATE SET status='accepted',updated_at=now()", [req.auth.userId, fromUserId]);
      } else await c.query('DELETE FROM friendships WHERE user_id=$1 AND other_user_id=$2', [fromUserId, req.auth.userId]);
      await c.query('COMMIT');
      res.json({ ok: true });
    } catch (e) { await c.query('ROLLBACK'); res.status(e.status || 500).json({ error: e.message }); } finally { c.release(); }
  });
  app.post('/api/blocks/:discordId', auth, async (req, res) => {
    const target = await pool.query('SELECT user_id FROM discord_accounts WHERE discord_id=$1', [req.params.discordId]);
    if (!target.rowCount || target.rows[0].user_id === req.auth.userId) return res.status(400).json({ error: 'المستخدم غير صالح' });
    await pool.query('INSERT INTO blocks(user_id,blocked_user_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [req.auth.userId, target.rows[0].user_id]);
    res.json({ ok: true });
  });
  app.get('/api/admin/codes', auth, admin, async (_req, res) => {
    const r = await pool.query('SELECT * FROM redeem_codes ORDER BY created_at DESC LIMIT 100');
    res.json(r.rows);
  });
  app.post('/api/admin/codes', auth, admin, async (req, res) => {
    try {
      const code = String(req.body.code || '').trim().toUpperCase().slice(0, 80);
      const rewards = normalizeRewards(req.body.rewards);
      const maxUses = req.body.maxUses == null || req.body.maxUses === '' ? null : Number(req.body.maxUses);
      const perUserLimit = Number(req.body.perUserLimit ?? 1);
      const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
      if (!code || !rewards.length || (maxUses !== null && (!Number.isSafeInteger(maxUses) || maxUses < 1)) || !Number.isSafeInteger(perUserLimit) || perUserLimit < 1) return res.status(400).json({ error: 'بيانات الكود غير صحيحة' });
      const r = await pool.query('INSERT INTO redeem_codes(code,rewards,max_uses,per_user_limit,expires_at,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [code, JSON.stringify(rewards), maxUses, perUserLimit, expiresAt, req.auth.userId]);
      await pool.query('INSERT INTO audit_logs(actor_user_id,action,payload) VALUES($1,$2,$3)', [req.auth.userId, 'code.create', JSON.stringify({ codeId: r.rows[0].id, code })]);
      res.status(201).json(r.rows[0]);
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.post('/internal/admin/code', internal, async (req, res) => {
    const actor = String(req.body.actorDiscordId || '');
    if (!adminIds.has(actor)) return res.status(403).json({ error: 'الإدارة فقط' });
    const a = await pool.query('SELECT user_id FROM discord_accounts WHERE discord_id=$1', [actor]);
    if (!a.rowCount) return res.status(404).json({ error: 'حساب الإدارة غير مرتبط' });
    try {
      const rewards = normalizeRewards(req.body.rewards);
      const r = await pool.query('INSERT INTO redeem_codes(code,rewards,max_uses,per_user_limit,expires_at,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [String(req.body.code || '').trim().toUpperCase(), JSON.stringify(rewards), req.body.maxUses == null ? null : Number(req.body.maxUses), Number(req.body.perUserLimit || 1), req.body.expiresAt ? new Date(req.body.expiresAt) : null, a.rows[0].user_id]);
      res.status(201).json(r.rows[0]);
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.get('/internal/user/:discordId/notifications', internal, async (req, res) => {
    const r = await pool.query('SELECT n.* FROM notifications n JOIN discord_accounts d ON d.user_id=n.user_id WHERE d.discord_id=$1 ORDER BY n.created_at DESC LIMIT 50', [req.params.discordId]);
    res.json(r.rows);
  });
  registerBotRoutes(app, { pool, internal, adminIds });
}
module.exports = { registerExtendedRoutes };
