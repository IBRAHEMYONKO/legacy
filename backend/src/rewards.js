function normalizeRewards(rewards) {
  if (!Array.isArray(rewards)) throw new Error('Invalid rewards');
  return rewards.map((reward) => {
    if (!reward || typeof reward !== 'object') throw new Error('Invalid reward');
    if (reward.type === 'points') {
      const amount = Number(reward.amount);
      if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Invalid reward points');
      return { type: 'points', amount };
    }
    if (reward.type === 'item') {
      const itemId = String(reward.itemId || '');
      const quantity = Number(reward.quantity ?? 1);
      if (!itemId || !Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('Invalid reward item');
      return { type: 'item', itemId, quantity };
    }
    if (reward.type === 'premium_days') {
      const days = Number(reward.days);
      if (!Number.isSafeInteger(days) || days <= 0) throw new Error('Invalid reward premium');
      return { type: 'premium_days', days };
    }
    throw new Error('Invalid reward type');
  });
}

module.exports = { normalizeRewards };
