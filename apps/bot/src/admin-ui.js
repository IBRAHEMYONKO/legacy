const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

function registerAdminUI(client, { internal, admins }) {
  client.on('interactionCreate', async (i) => {
    const supported = i.customId?.startsWith('legacy:admin:') || i.customId === 'legacy:modal:code' || i.customId === 'legacy:modal:premium';
    if (!supported || !admins.has(i.user.id) || i.replied || i.deferred) return;
    try {
      if (i.customId === 'legacy:admin:codes') {
        return i.reply({ content: '🔑 إنشاء كود مكافأة ديناميكي', components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('legacy:admin:codes:create').setLabel('إنشاء كود').setEmoji('➕').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('legacy:admin:codes:list').setLabel('عرض الأكواد').setEmoji('📋').setStyle(ButtonStyle.Secondary))], ephemeral: true });
      }
      if (i.customId === 'legacy:admin:codes:create') {
        return i.showModal(new ModalBuilder().setCustomId('legacy:modal:code').setTitle('إنشاء كود LEGACY').addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('code').setLabel('الكود').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rewards').setLabel('المكافآت JSON').setPlaceholder('[{"type":"points","amount":10000}]').setStyle(TextInputStyle.Paragraph).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('maxUses').setLabel('أقصى استخدامات (فارغ = بلا حد)').setStyle(TextInputStyle.Short).setRequired(false)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('perUser').setLabel('عدد مرات الاستخدام لكل مستخدم').setStyle(TextInputStyle.Short).setValue('1').setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('expiresAt').setLabel('انتهاء ISO اختياري').setPlaceholder('2026-12-31T23:59:59Z').setStyle(TextInputStyle.Short).setRequired(false))
        ));
      }
      if (i.customId === 'legacy:admin:codes:list') {
        const rows = await internal('/internal/audit');
        return i.reply({ content: rows.filter(x => x.action === 'code.create').slice(0, 15).map(x => `• تم إنشاء كود — ${new Date(x.created_at).toLocaleString('ar')}`).join('\n') || 'لا توجد أكواد مسجلة في السجل بعد.', ephemeral: true });
      }
      if (i.customId === 'legacy:admin:premium') {
        return i.showModal(new ModalBuilder().setCustomId('legacy:modal:premium').setTitle('إدارة Premium').addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('target').setLabel('Discord ID للمستخدم').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('days').setLabel('الأيام — 0 لإلغاء Premium').setStyle(TextInputStyle.Short).setRequired(true))
        ));
      }
      if (i.isModalSubmit() && i.customId === 'legacy:modal:code') {
        let rewards;
        try { rewards = JSON.parse(i.fields.getTextInputValue('rewards')); } catch { return i.reply({ content: '❌ JSON المكافآت غير صحيح.', ephemeral: true }); }
        const maxRaw = i.fields.getTextInputValue('maxUses').trim();
        const maxUses = maxRaw ? Number(maxRaw) : null;
        const perUserLimit = Number(i.fields.getTextInputValue('perUser'));
        await internal('/internal/admin/code', { method: 'POST', body: JSON.stringify({ actorDiscordId: i.user.id, code: i.fields.getTextInputValue('code'), rewards, maxUses, perUserLimit, expiresAt: i.fields.getTextInputValue('expiresAt').trim() || null }) });
        return i.reply({ content: '✅ تم إنشاء الكود وحفظ مكافآته في قاعدة LEGACY.', ephemeral: true });
      }
      if (i.isModalSubmit() && i.customId === 'legacy:modal:premium') {
        const targetDiscordId = i.fields.getTextInputValue('target').trim();
        const days = Number(i.fields.getTextInputValue('days'));
        if (!Number.isSafeInteger(days) || days < 0) return i.reply({ content: '❌ عدد الأيام غير صحيح.', ephemeral: true });
        await internal('/internal/admin/premium', { method: 'POST', body: JSON.stringify({ actorDiscordId: i.user.id, targetDiscordId, days }) });
        return i.reply({ content: days === 0 ? '✅ تم إلغاء Premium.' : `✅ تم منح Premium لمدة **${days} يوم**.`, ephemeral: true });
      }
    } catch (e) {
      if (!i.replied && !i.deferred) await i.reply({ content: `❌ ${e.message}`, ephemeral: true });
    }
  });
}
module.exports = { registerAdminUI };
