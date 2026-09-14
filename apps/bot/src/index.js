'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const API = (process.env.LEGACY_API_URL || `http://localhost:${process.env.API_PORT || 4000}`).replace(/\/$/, '');
const INTERNAL_KEY = process.env.LEGACY_INTERNAL_KEY || '';
const admins = new Set((process.env.LEGACY_ADMIN_IDS || '').split(',').map(x => x.trim()).filter(Boolean));

function isLegacyCommand(content) {
  return String(content || '').trim().toLowerCase() === 'legacy';
}

function getBotStatus(client) {
  return {
    tag: client?.user?.tag || null,
    ping: Number(client?.ws?.ping ?? -1),
    ready: Boolean(client?.readyAt)
  };
}

async function internal(endpoint, options = {}) {
  const response = await fetch(`${API}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-legacy-internal-key': INTERNAL_KEY,
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `API ${response.status}`);
  return data;
}

function normalRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('legacy:profile').setLabel('بروفايلي').setEmoji('👤').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('legacy:points').setLabel('نقاطي').setEmoji('🪙').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('legacy:shop').setLabel('المتجر').setEmoji('🛒').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('legacy:inventory').setLabel('حقيبتي').setEmoji('🎒').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('legacy:leaderboard').setLabel('المتصدرين').setEmoji('🏆').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('legacy:premium').setLabel('Premium').setEmoji('💎').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('legacy:redeem').setLabel('استرداد كود').setEmoji('🎁').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('legacy:social').setLabel('الأصدقاء').setEmoji('👥').setStyle(ButtonStyle.Secondary)
    )
  ];
}

function adminRow() {
  const options = [
    ['users', 'المستخدمون', '👥'], ['points', 'النقاط', '🪙'], ['catalog', 'المتجر', '🛒'],
    ['premium', 'Premium', '💎'], ['codes', 'الأكواد', '🎁'], ['audit', 'السجلات', '📝'], ['stats', 'الإحصائيات', '📊']
  ];
  return [new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('legacy:admin')
      .setPlaceholder('اختر قسم الإدارة')
      .addOptions(options.map(([value, label, emoji]) => new StringSelectMenuOptionBuilder()
        .setValue(value)
        .setLabel(label)
        .setEmoji({ name: emoji })
      ))
  )];
}

function homePayload(user, admin) {
  const embed = new EmbedBuilder()
    .setTitle(admin ? 'LEGACY • مركز الإدارة' : 'LEGACY • مركز حسابك')
    .setDescription(admin ? 'إدارة المستخدمين والاقتصاد والمتجر وPremium والأكواد من Discord.' : 'حسابك في LEGACY صار متصل مباشرة بالموقع. اختر أي قسم من الأزرار بالأسفل.')
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .setColor(admin ? 0xe4bd62 : 0x42e0c0)
    .addFields(
      { name: 'Discord', value: `<@${user.id}>`, inline: true },
      { name: 'الحالة', value: '● متصل', inline: true },
      { name: 'الأمر', value: '`legacy`', inline: true }
    )
    .setFooter({ text: admin ? 'صلاحيات الإدارة مفعلة' : 'LEGACY • الحساب المشترك' });
  return { embeds: [embed], components: admin ? adminRow() : normalRows() };
}

async function sendProfile(interaction) {
  const [user, cosmetics] = await Promise.all([
    internal(`/internal/user/${interaction.user.id}`),
    internal(`/internal/user/${interaction.user.id}/cosmetics`)
  ]);
  const badges = (cosmetics.items || []).filter(x => x.type === 'badge').map(x => `${x.metadata?.icon || '🏅'} ${x.name}`).join(' • ') || 'لا توجد شارات';
  const title = cosmetics.selectedTitle?.name || 'بدون لقب';
  const roles = (cosmetics.roles || []).map(x => x === 'developer' ? '🛠️ مطور' : x).join(' • ') || 'عضو';
  const embed = new EmbedBuilder().setColor(0x42e0c0).setTitle('👤 بروفايل LEGACY')
    .setThumbnail(user.avatar_url || interaction.user.displayAvatarURL({ size: 256 }))
    .setDescription(`**${user.display_name || user.global_name || user.username}**\n@${user.username || interaction.user.username}\n\n🏷️ **اللقب:** ${title}\n🏅 **الشارات:** ${badges}\n🎖️ **الرتبة:** ${roles}\n⭐ **المستوى:** ${user.level || 1}\n🪙 **النقاط:** ${Number(user.points || 0).toLocaleString('ar-IQ')}\n💎 **Premium:** ${user.premium_until ? 'فعال' : 'غير مشترك'}\n\n${user.bio || 'لا توجد نبذة بعد.'}`);
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleButton(interaction) {
  const id = interaction.customId;
  if (id === 'legacy:profile') return sendProfile(interaction);
  if (id === 'legacy:points') { const u = await internal(`/internal/user/${interaction.user.id}`); return interaction.reply({ content: `🪙 **نقاطك:** ${Number(u.points || 0).toLocaleString('ar-IQ')}\n⭐ **مستواك:** ${u.level || 1}\n📈 **خبرتك:** ${u.experience || 0}`, ephemeral: true }); }
  if (id === 'legacy:premium') { const u = await internal(`/internal/user/${interaction.user.id}`); return interaction.reply({ content: u.premium_until ? `💎 Premium فعال حتى **${new Date(u.premium_until).toLocaleString('ar-IQ')}**.` : '💎 حسابك حالياً بدون Premium.', ephemeral: true }); }
  if (id === 'legacy:inventory') { const rows = await internal(`/internal/user/${interaction.user.id}/inventory`); return interaction.reply({ content: rows.length ? `🎒 **حقيبتك**\n${rows.map(x => `• ${x.name} × ${x.quantity}`).join('\n')}` : '🎒 حقيبتك فارغة حالياً.', ephemeral: true }); }
  if (id === 'legacy:leaderboard') { const response = await fetch(`${API}/api/leaderboards/points`); const rows = await response.json().catch(() => []); const list = (Array.isArray(rows) ? rows : rows.items || []).slice(0, 10); return interaction.reply({ content: list.length ? `🏆 **المتصدرين**\n${list.map((x, i) => `${i + 1}. **${x.display_name || x.global_name || x.username || 'عضو'}** — ${Number(x.points || 0).toLocaleString('ar-IQ')} نقطة`).join('\n')}` : 'لا توجد بيانات للمتصدرين بعد.', ephemeral: true }); }
  if (id === 'legacy:social') return interaction.reply({ content: '👥 قسم الأصدقاء مربوط بالموقع. افتح LEGACY من المتصفح لإدارة الشبكة الاجتماعية.', ephemeral: true });
  if (id === 'legacy:redeem') return interaction.showModal(new ModalBuilder().setCustomId('legacy:modal:redeem').setTitle('استرداد كود LEGACY').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('code').setLabel('كود الجائزة').setPlaceholder('اكتب الكود هنا').setStyle(TextInputStyle.Short).setRequired(true))));
  if (id === 'legacy:shop') {
    const rows = await internal('/internal/shop');
    if (!rows.length) return interaction.reply({ content: '🛒 المتجر فارغ حالياً.', ephemeral: true });
    const menu = new StringSelectMenuBuilder().setCustomId('legacy:shop:select').setPlaceholder('اختر عنصراً للشراء').addOptions(rows.slice(0, 25).map(x => new StringSelectMenuOptionBuilder().setLabel(String(x.name).slice(0, 100)).setValue(x.id).setDescription(`${x.price} نقطة`)));
    return interaction.reply({ content: '🛒 **متجر LEGACY**\nاختر العنصر ليتم شراؤه مباشرة.', components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
  }
}

async function handleAdmin(interaction) {
  if (!admins.has(interaction.user.id)) return interaction.reply({ content: 'هذه اللوحة للإدارة فقط.', ephemeral: true });
  const section = interaction.values?.[0];
  const labels = { users: '👥 المستخدمون', points: '🪙 النقاط', catalog: '🛒 المتجر والكتالوج', premium: '💎 Premium', codes: '🎁 الأكواد والجوائز', audit: '📝 السجلات', stats: '📊 الإحصائيات' };
  return interaction.reply({ content: `**${labels[section] || 'LEGACY'}**\nهذا القسم صار مربوطاً بالنظام. الإدارة المتقدمة تتم عبر لوحة الإدارة داخل Discord أو الموقع.`, ephemeral: true });
}

async function handleModal(interaction) {
  if (interaction.customId !== 'legacy:modal:redeem') return;
  const code = interaction.fields.getTextInputValue('code').trim();
  try {
    const result = await internal(`/internal/user/${interaction.user.id}/redeem`, { method: 'POST', body: JSON.stringify({ code }) });
    return interaction.reply({ content: `🎉 تم استرداد الكود بنجاح!\n${result.message || 'تمت إضافة الجائزة إلى حسابك.'}`, ephemeral: true });
  } catch (error) {
    return interaction.reply({ content: `❌ ${error.message}`, ephemeral: true });
  }
}

function createClient() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
  client.once('clientReady', () => {
    const status = getBotStatus(client);
    console.log(`[LEGACY:bot] ONLINE as ${status.tag} | ping=${status.ping}ms`);
  });
  client.on('error', error => console.error('[LEGACY:bot] Discord error:', error.message));
  client.on('warn', message => console.warn('[LEGACY:bot] Discord warning:', message));
  client.on('messageCreate', async message => {
    if (message.author.bot || !isLegacyCommand(message.content)) return;
    try { await message.reply(homePayload(message.author, admins.has(message.author.id))); }
    catch (error) { console.error('[LEGACY:bot] command error:', error); }
  });
  client.on('interactionCreate', async interaction => {
    if (!interaction.customId?.startsWith('legacy:')) return;
    try {
      if (interaction.isStringSelectMenu() && interaction.customId === 'legacy:admin') return handleAdmin(interaction);
      if (interaction.isStringSelectMenu() && interaction.customId === 'legacy:shop:select') {
        const result = await internal(`/internal/user/${interaction.user.id}/shop/${interaction.values[0]}/buy`, { method: 'POST' });
        return interaction.reply({ content: `✅ تم شراء **${result.item?.name || 'العنصر'}** وإضافته إلى حقيبتك.`, ephemeral: true });
      }
      if (interaction.isButton()) return handleButton(interaction);
      if (interaction.isModalSubmit()) return handleModal(interaction);
    } catch (error) {
      console.error('[LEGACY:bot] interaction error:', error);
      const payload = { content: `❌ ${error.message || 'حدث خطأ غير متوقع.'}`, ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {}); else await interaction.reply(payload).catch(() => {});
    }
  });
  return client;
}

async function start() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error('DISCORD_BOT_TOKEN غير موجود في ملف .env');
  const client = createClient();
  await client.login(token);
  return client;
}

if (require.main === module) {
  start().catch(error => {
    console.error('[LEGACY:bot] STARTUP FAILED');
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}

module.exports = { createClient, start, isLegacyCommand, getBotStatus };
