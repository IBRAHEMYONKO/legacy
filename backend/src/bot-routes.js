const { normalizeRewards } = require('./rewards');

async function redeemForUser(pool, discordId, code) {
  const user = await pool.query('SELECT user_id FROM discord_accounts WHERE discord_id=$1', [discordId]);
  if (!user.rowCount) throw Object.assign(new Error('الحساب غير مرتبط بـ LEGACY'), { status: 404 });
  const userId = user.rows[0].user_id;
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const found = await c.query('SELECT * FROM redeem_codes WHERE code=$1 FOR UPDATE', [code]);
    if (!found.rowCount) throw Object.assign(new Error('الكود غير موجود'), { status: 404 });
    const item = found.rows[0];
    if (!item.active) throw Object.assign(new Error('الكود متوقف'), { status: 400 });
    if (item.expires_at && new Date(item.expires_at) <= new Date()) throw Object.assign(new Error('انتهت صلاحية الكود'), { status: 400 });
    if (item.max_uses !== null && item.uses >= item.max_uses) throw Object.assign(new Error('اكتملت استخدامات الكود'), { status: 400 });
    const used = await c.query('SELECT COUNT(*)::int AS count FROM code_redemptions WHERE code_id=$1 AND user_id=$2', [item.id, userId]);
    if (used.rows[0].count >= item.per_user_limit) throw Object.assign(new Error('سبق واستخدمت هذا الكود'), { status: 400 });
    const rewards = normalizeRewards(item.rewards);
    for (const reward of rewards) {
      if (reward.type === 'points') await c.query('INSERT INTO point_transactions(user_id,amount,reason) VALUES($1,$2,$3)', [userId, reward.amount, `كود: ${code}`]);
      if (reward.type === 'item') {
        const exists = await c.query('SELECT id FROM catalog_items WHERE id=$1 AND active=true', [reward.itemId]);
        if (!exists.rowCount) throw Object.assign(new Error('عنصر المكافأة غير موجود'), { status: 400 });
        await c.query('INSERT INTO inventory_items(user_id,item_id,quantity) VALUES($1,$2,$3) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=inventory_items.quantity+EXCLUDED.quantity,acquired_at=now()', [userId, reward.itemId, reward.quantity]);
      }
      if (reward.type === 'premium_days') await c.query("UPDATE profiles SET premium_until=GREATEST(COALESCE(premium_until,now()),now()) + ($1 || ' days')::interval WHERE user_id=$2", [reward.days, userId]);
    }
    await c.query('INSERT INTO code_redemptions(code_id,user_id) VALUES($1,$2)', [item.id, userId]);
    await c.query('UPDATE redeem_codes SET uses=uses+1 WHERE id=$1', [item.id]);
    await c.query('COMMIT');
    return rewards;
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}

function registerBotRoutes(app, { pool, internal, adminIds }) {
  app.post('/internal/shop/buy', internal, async (req, res) => {
    const discordId = String(req.body.discordId || '');
    const itemId = String(req.body.itemId || '');
    const user = await pool.query('SELECT user_id FROM discord_accounts WHERE discord_id=$1', [discordId]);
    if (!user.rowCount) return res.status(404).json({ error: 'الحساب غير مرتبط' });
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [user.rows[0].user_id]);
      const item = await c.query('SELECT * FROM catalog_items WHERE id=$1 AND active=true FOR UPDATE', [itemId]);
      if (!item.rowCount) throw Object.assign(new Error('العنصر غير موجود'), { status: 404 });
      const balance = await c.query('SELECT COALESCE(SUM(amount),0)::bigint AS points FROM point_transactions WHERE user_id=$1', [user.rows[0].user_id]);
      const price = BigInt(item.rows[0].price);
      if (BigInt(balance.rows[0].points) < price) throw Object.assign(new Error('رصيدك غير كافٍ'), { status: 400 });
      await c.query('INSERT INTO point_transactions(user_id,amount,reason) VALUES($1,$2,$3)', [user.rows[0].user_id, -Number(price), `شراء: ${item.rows[0].name}`]);
      await c.query('INSERT INTO inventory_items(user_id,item_id,quantity) VALUES($1,$2,1) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=inventory_items.quantity+1,acquired_at=now()', [user.rows[0].user_id, itemId]);
      await c.query('INSERT INTO purchases(user_id,item_id,price) VALUES($1,$2,$3)', [user.rows[0].user_id, itemId, Number(price)]);
      await c.query('COMMIT');
      res.json({ ok: true, item: item.rows[0] });
    } catch (e) { await c.query('ROLLBACK'); res.status(e.status || 500).json({ error: e.message }); } finally { c.release(); }
  });

  app.post('/internal/user/redeem', internal, async (req, res) => {
    const discordId = String(req.body.discordId || '').trim();
    const code = String(req.body.code || '').trim().toUpperCase();
    if (!discordId || !code) return res.status(400).json({ error: 'الكود والحساب مطلوبان' });
    try { res.json({ ok: true, rewards: await redeemForUser(pool, discordId, code) }); }
    catch (e) { res.status(e.status || 500).json({ error: e.message || 'فشل استرداد الكود' }); }
  });

  app.post('/internal/admin/premium', internal, async (req, res) => {
    const actor = String(req.body.actorDiscordId || '');
    const target = String(req.body.targetDiscordId || '');
    const days = Number(req.body.days);
    if (!adminIds.has(actor)) return res.status(403).json({ error: 'الإدارة فقط' });
    if (!target || !Number.isSafeInteger(days) || days < 0) return res.status(400).json({ error: 'بيانات Premium غير صحيحة' });
    const a = await pool.query('SELECT user_id FROM discord_accounts WHERE discord_id=$1', [actor]);
    const t = await pool.query('SELECT user_id FROM discord_accounts WHERE discord_id=$1', [target]);
    if (!a.rowCount || !t.rowCount) return res.status(404).json({ error: 'الحساب غير مرتبط' });
    if (days === 0) await pool.query('UPDATE profiles SET premium_until=NULL WHERE user_id=$1', [t.rows[0].user_id]);
    else await pool.query("UPDATE profiles SET premium_until=GREATEST(COALESCE(premium_until,now()),now()) + ($1 || ' days')::interval WHERE user_id=$2", [days, t.rows[0].user_id]);
    await pool.query('INSERT INTO audit_logs(actor_user_id,action,target_user_id,payload) VALUES($1,$2,$3,$4)', [a.rows[0].user_id, 'premium.update', t.rows[0].user_id, JSON.stringify({ days, source: 'discord' })]);
    res.json({ ok: true });
  });
}
module.exports = { registerBotRoutes };
