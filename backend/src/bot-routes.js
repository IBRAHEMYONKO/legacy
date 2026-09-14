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
