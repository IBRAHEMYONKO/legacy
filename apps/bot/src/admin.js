'use strict';

const {
  EmbedBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const admins = new Set((process.env.LEGACY_ADMIN_IDS || '').split(',').map(x => x.trim()).filter(Boolean));

function adminModal(customId, title, fields) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
  modal.addComponents(fields.map(field => new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId(field.id)
      .setLabel(field.label)
      .setPlaceholder(field.placeholder || '')
      .setStyle(field.paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(field.required !== false)
      .setValue(field.value || '')
  )));
  return modal;
}

function value(interaction, id) {
  return interaction.fields.getTextInputValue(id).trim();
}

function money(value) {
  return Number(value || 0).toLocaleString('ar-IQ');
}

async function handleAdminInteraction(interaction, { internal }) {
  if (!admins.has(interaction.user.id)) return interaction.reply({ content: 'هذه اللوحة للإدارة فقط.', ephemeral: true });
  const adminId = interaction.user.id;
  const section = interaction.values?.[0];

  if (section === 'users') {
    const rows = await internal(`/internal/admin/users?actorDiscordId=${encodeURIComponent(adminId)}`);
    if (!rows.length) return interaction.reply({ content: '👥 لا يوجد مستخدمون مرتبطون بـ LEGACY حتى الآن.', ephemeral: true });
    const text = rows.slice(0, 15).map((x, i) => `${i + 1}. <@${x.discord_id}> — **${x.global_name || x.username}** — 🪙 ${money(x.points)} — ⭐ ${x.level}`).join('\n');
    return interaction.reply({ content: `👥 **المستخدمون**\n\n${text}\n\nإجمالي المعروض: ${rows.length}`, ephemeral: true });
  }

  if (section === 'points') return interaction.showModal(adminModal('legacy:admin:points', 'تعديل نقاط مستخدم', [
    { id: 'target', label: 'Discord ID للمستخدم', placeholder: 'مثال: 123456789012345678' },
    { id: 'amount', label: 'المقدار', placeholder: '1000 للإضافة أو -1000 للخصم' },
    { id: 'reason', label: 'سبب العملية', placeholder: 'مكافأة / خصم إداري' }
  ]));

  if (section === 'premium') return interaction.showModal(adminModal('legacy:admin:premium', 'إدارة Premium', [
    { id: 'target', label: 'Discord ID للمستخدم', placeholder: 'ID المستخدم' },
    { id: 'days', label: 'عدد الأيام', placeholder: '30 للإضافة — 0 لإزالة Premium' }
  ]));

  if (section === 'catalog') return interaction.showModal(adminModal('legacy:admin:catalog', 'إضافة عنصر للمتجر', [
    { id: 'type', label: 'النوع', placeholder: 'title أو badge أو cosmetic' },
    { id: 'slug', label: 'المعرف', placeholder: 'مثال: title-royal' },
    { id: 'name', label: 'اسم العنصر', placeholder: 'اللقب الملكي' },
    { id: 'price', label: 'السعر بالنقاط', placeholder: '25000' },
    { id: 'description', label: 'الوصف', placeholder: 'وصف العنصر', paragraph: true }
  ]));

  if (section === 'codes') return interaction.showModal(adminModal('legacy:admin:code', 'إنشاء كود جائزة', [
    { id: 'code', label: 'الكود', placeholder: 'LEGACY-2026' },
    { id: 'points', label: 'النقاط', placeholder: '10000 أو 0' },
    { id: 'maxUses', label: 'أقصى عدد استخدامات', placeholder: '100 أو اتركه فارغاً', required: false },
    { id: 'premiumDays', label: 'أيام Premium', placeholder: '7 أو 0' },
    { id: 'perUserLimit', label: 'حد الاستخدام لكل مستخدم', placeholder: '1' }
  ]));

  if (section === 'audit') {
    const rows = await internal('/internal/audit');
    if (!rows.length) return interaction.reply({ content: '📝 لا توجد عمليات مسجلة بعد.', ephemeral: true });
    const text = rows.slice(0, 15).map((x, i) => `${i + 1}. **${x.action}** — ${new Date(x.created_at).toLocaleString('ar-IQ')}`).join('\n');
    return interaction.reply({ content: `📝 **آخر عمليات الإدارة**\n\n${text}`, ephemeral: true });
  }

  if (section === 'stats') {
    const s = await internal(`/internal/admin/stats?actorDiscordId=${encodeURIComponent(adminId)}`);
    const embed = new EmbedBuilder().setColor(0xe4bd62).setTitle('📊 إحصائيات LEGACY').addFields(
      { name: '👥 المستخدمون', value: money(s.users), inline: true },
      { name: '🪙 مجموع النقاط', value: money(s.points), inline: true },
      { name: '🎒 عناصر الحقائب', value: money(s.inventoryItems), inline: true },
      { name: '🛒 عمليات الشراء', value: money(s.purchases), inline: true },
      { name: '🎁 الأكواد', value: money(s.codes), inline: true },
      { name: '🎉 مرات الاسترداد', value: money(s.redemptions), inline: true },
      { name: '💎 Premium فعال', value: money(s.premium), inline: true }
    ).setFooter({ text: 'LEGACY • لوحة الإدارة' });
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  return interaction.reply({ content: 'اختر قسماً صالحاً من لوحة الإدارة.', ephemeral: true });
}

async function handleAdminModal(interaction, { internal }) {
  if (!interaction.customId.startsWith('legacy:admin:')) return false;
  if (!admins.has(interaction.user.id)) {
    await interaction.reply({ content: 'هذه العملية للإدارة فقط.', ephemeral: true });
    return true;
  }
  const adminId = interaction.user.id;

  if (interaction.customId === 'legacy:admin:points') {
    const amount = Number(value(interaction, 'amount'));
    if (!Number.isSafeInteger(amount) || amount === 0) throw new Error('مقدار النقاط غير صحيح.');
    await internal('/internal/admin/points', { method: 'POST', body: JSON.stringify({ actorDiscordId: adminId, targetDiscordId: value(interaction, 'target'), amount, reason: value(interaction, 'reason') }) });
    await interaction.reply({ content: '✅ تم تعديل نقاط المستخدم وتسجيل العملية في السجل.', ephemeral: true });
    return true;
  }

  if (interaction.customId === 'legacy:admin:premium') {
    const days = Number(value(interaction, 'days'));
    if (!Number.isSafeInteger(days) || days < 0) throw new Error('عدد أيام Premium غير صحيح.');
    await internal('/internal/admin/premium', { method: 'POST', body: JSON.stringify({ actorDiscordId: adminId, targetDiscordId: value(interaction, 'target'), days }) });
    await interaction.reply({ content: days === 0 ? '✅ تمت إزالة Premium.' : `✅ تم تمديد Premium لمدة **${days} يوم**.`, ephemeral: true });
    return true;
  }

  if (interaction.customId === 'legacy:admin:catalog') {
    const price = Number(value(interaction, 'price'));
    if (!Number.isSafeInteger(price) || price < 0) throw new Error('سعر العنصر غير صحيح.');
    await internal('/internal/admin/catalog', { method: 'POST', body: JSON.stringify({ actorDiscordId: adminId, type: value(interaction, 'type'), slug: value(interaction, 'slug'), name: value(interaction, 'name'), price, description: value(interaction, 'description'), metadata: {} }) });
    await interaction.reply({ content: '✅ تمت إضافة العنصر إلى متجر LEGACY.', ephemeral: true });
    return true;
  }

  if (interaction.customId === 'legacy:admin:code') {
    const points = Number(value(interaction, 'points')) || 0;
    const premiumDays = Number(value(interaction, 'premiumDays')) || 0;
    const maxUsesRaw = value(interaction, 'maxUses');
    const perUserLimit = Number(value(interaction, 'perUserLimit')) || 1;
    if (!Number.isSafeInteger(points) || points < 0 || !Number.isSafeInteger(premiumDays) || premiumDays < 0) throw new Error('بيانات مكافأة الكود غير صحيحة.');
    if (!Number.isSafeInteger(perUserLimit) || perUserLimit < 1) throw new Error('حد الاستخدام غير صحيح.');
    const maxUses = maxUsesRaw ? Number(maxUsesRaw) : null;
    if (maxUses !== null && (!Number.isSafeInteger(maxUses) || maxUses < 1)) throw new Error('أقصى عدد استخدامات غير صحيح.');
    const rewards = [];
    if (points > 0) rewards.push({ type: 'points', amount: points });
    if (premiumDays > 0) rewards.push({ type: 'premium_days', days: premiumDays });
    if (!rewards.length) throw new Error('أدخل نقاطاً أو أيام Premium على الأقل.');
    const code = value(interaction, 'code').toUpperCase();
    await internal('/internal/admin/code', { method: 'POST', body: JSON.stringify({ actorDiscordId: adminId, code, rewards, maxUses, perUserLimit }) });
    await interaction.reply({ content: `✅ تم إنشاء الكود **${code}** بنجاح.`, ephemeral: true });
    return true;
  }

  return false;
}

module.exports = { handleAdminInteraction, handleAdminModal };
