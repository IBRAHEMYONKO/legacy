'use strict';

function registerAdminBotRoutes(app, { pool, internal, adminIds }) {
  const requireAdmin = (req, res, next) => {
    const actor = String(req.body?.actorDiscordId || req.query?.actorDiscordId || '').trim();
    if (!adminIds.has(actor)) return res.status(403).json({ error: 'الإدارة فقط' });
    req.adminDiscordId = actor;
    next();
  };

  app.get('/internal/admin/users', internal, requireAdmin, async (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 80);
    const like = `%${q}%`;
    const r = await pool.query(`
      SELECT u.id,d.discord_id,d.username,d.global_name,d.avatar_url,
             p.display_name,p.level,p.experience,p.premium_until,
             COALESCE((SELECT SUM(amount) FROM point_transactions WHERE user_id=u.id),0)::bigint AS points
      FROM users u
      JOIN discord_accounts d ON d.user_id=u.id
      JOIN profiles p ON p.user_id=u.id
      WHERE d.username ILIKE $1 OR d.global_name ILIKE $1 OR d.discord_id=$2
      ORDER BY u.created_at DESC LIMIT 50
    `, [like, q]);
    res.json(r.rows);
  });

  app.get('/internal/admin/catalog', internal, requireAdmin, async (_req, res) => {
    const r = await pool.query('SELECT * FROM catalog_items ORDER BY created_at DESC LIMIT 100');
    res.json(r.rows);
  });

  app.get('/internal/admin/codes', internal, requireAdmin, async (_req, res) => {
    const r = await pool.query('SELECT * FROM redeem_codes ORDER BY created_at DESC LIMIT 100');
    res.json(r.rows);
  });

  app.get('/internal/admin/stats', internal, requireAdmin, async (_req, res) => {
    const [users, points, inventory, purchases, codes, premium] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS count FROM users'),
      pool.query('SELECT COALESCE(SUM(amount),0)::bigint AS total FROM point_transactions'),
      pool.query('SELECT COUNT(*)::int AS count FROM inventory_items'),
      pool.query('SELECT COUNT(*)::int AS count FROM purchases'),
      pool.query('SELECT COUNT(*)::int AS count, COALESCE(SUM(uses),0)::int AS redemptions FROM redeem_codes'),
      pool.query('SELECT COUNT(*)::int AS count FROM profiles WHERE premium_until IS NOT NULL AND premium_until > now()')
    ]);
    res.json({
      users: users.rows[0].count,
      points: points.rows[0].total,
      inventoryItems: inventory.rows[0].count,
      purchases: purchases.rows[0].count,
      codes: codes.rows[0].count,
      redemptions: codes.rows[0].redemptions,
      premium: premium.rows[0].count
    });
  });
}

module.exports = { registerAdminBotRoutes };
