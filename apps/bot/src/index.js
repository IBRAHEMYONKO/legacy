require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const {
  Client, GatewayIntentBits, Partials, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder
} = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

const admins = new Set((process.env.LEGACY_ADMIN_IDS || '').split(',').map(x => x.trim()).filter(Boolean));
const API = process.env.LEGACY_API_URL || `http://localhost:${process.env.API_PORT || 4000}`;

function normalMenu() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('legacy:profile').setLabel('بروفايلي').setEmoji('👤').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('legacy:premium').setLabel('اشتراكي').setEmoji('💎').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('legacy:points').setLabel('نقاطي').setEmoji('🪙').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('legacy:inventory').setLabel('حقيبتي').setEmoji('🎒').setStyle(ButtonStyle.Secondary)
  );
}
function normalMenu2() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('legacy:shop').setLabel('المتجر').setEmoji('🛒').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('legacy:leaderboard').setLabel('المتصدرين').setEmoji('🏆').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('legacy:social').setLabel('الأصدقاء').setEmoji('👥').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('legacy:settings').setLabel('الإعدادات').setEmoji('⚙️').setStyle(ButtonStyle.Secondary)
  );
}
function adminMenu() {
  const select = new StringSelectMenuBuilder().setCustomId('legacy:admin').setPlaceholder('اختر قسم الإدارة').addOptions(
    new StringSelectMenuOptionBuilder().setLabel('إدارة المستخدمين').setValue('users').setEmoji('👥'),
    new StringSelectMenuOptionBuilder().setLabel('النقاط').setValue('points').setEmoji('🪙'),
    new StringSelectMenuOptionBuilder().setLabel('الحقيبة والعناصر').setValue('inventory').setEmoji('🎒'),
    new StringSelectMenuOptionBuilder().setLabel('المتجر والكتالوج').setValue('catalog').setEmoji('🛒'),
    new StringSelectMenuOptionBuilder().setLabel('Premium والاشتراكات').setValue('premium').setEmoji('💎'),
    new StringSelectMenuOptionBuilder().setLabel('الأكواد والجوائز').setValue('codes').setEmoji('🔑'),
    new StringSelectMenuOptionBuilder().setLabel('المجموعات والصلاحيات').setValue('groups').setEmoji('👑'),
    new StringSelectMenuOptionBuilder().setLabel('الإحصائيات والمتصدرين').setValue('stats').setEmoji('📊'),
    new StringSelectMenuOptionBuilder().setLabel('السجلات والتدقيق').setValue('audit').setEmoji('📝'),
    new StringSelectMenuOptionBuilder().setLabel('إعدادات LEGACY').setValue('settings').setEmoji('⚙️')
  );
  return new ActionRowBuilder().addComponents(select);
}
function home(user, isAdmin) {
  const embed = new EmbedBuilder()
    .setTitle(isAdmin ? 'LEGACY | لوحة الإدارة' : 'LEGACY')
    .setDescription(isAdmin ? 'لوحة التحكم الكاملة للنظام. اختر القسم الذي تريد إدارته.' : 'حسابك في LEGACY — اختر ما تريد من القائمة.')
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: isAdmin ? 'صلاحيات الإدارة مفعلة' : 'LEGACY • حسابك ومحتواك' });
  if (isAdmin) return { embeds: [embed], components: [adminMenu()] };
  return { embeds: [embed], components: [normalMenu(), normalMenu2()] };
}

client.once('ready', () => console.log(`LEGACY Bot ONLINE as ${client.user.tag}`));

client.on('messageCreate', async message => {
  if (message.author.bot || message.content.trim().toLowerCase() !== 'legacy') return;
  const isAdmin = admins.has(message.author.id);
  await message.reply(home(message.author, isAdmin));
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
  if (!interaction.customId.startsWith('legacy:')) return;

  if (interaction.isStringSelectMenu() && interaction.customId === 'legacy:admin') {
    if (!admins.has(interaction.user.id)) return interaction.reply({ content: 'هذه اللوحة للإدارة فقط.', ephemeral: true });
    const section = interaction.values[0];
    const labels = {
      users: '👥 إدارة المستخدمين\nابحث عن أي مستخدم وافتح ملفه الكامل.',
      points: '🪙 إدارة النقاط\nإضافة أو خصم أو ضبط النقاط مع تسجيل العملية.',
      inventory: '🎒 إدارة الحقيبة والعناصر\nمنح العناصر أو سحبها والبحث عن ملاكها.',
      catalog: '🛒 إدارة المتجر والكتالوج\nإضافة وتعديل وإيقاف العناصر والتخصيصات.',
      premium: '💎 Premium والاشتراكات\nمنح وإلغاء ومراجعة الاشتراكات.',
      codes: '🔑 الأكواد والجوائز\nإنشاء أكواد ديناميكية وتحديد الاستخدام والانتهاء.',
      groups: '👑 المجموعات والصلاحيات\nإدارة المجموعات والأدوار.',
      stats: '📊 الإحصائيات والمتصدرين\nنظرة على نشاط وأرقام LEGACY.',
      audit: '📝 السجلات والتدقيق\nمراجعة العمليات الإدارية.',
      settings: '⚙️ إعدادات LEGACY\nإدارة إعدادات النظام العامة.'
    };
    return interaction.reply({ content: labels[section] || 'قسم غير معروف.', ephemeral: true });
  }

  const action = interaction.customId.split(':')[1];
  if (action === 'profile') return interaction.reply({ content: `👤 بروفايل <@${interaction.user.id}>\nسيتم عرض بيانات LEGACY الخاصة بك هنا.`, ephemeral: true });
  if (action === 'premium') return interaction.reply({ content: '💎 اشتراكك\nسيتم عرض حالة Premium ومدة الاشتراك هنا.', ephemeral: true });
  if (action === 'points') return interaction.reply({ content: '🪙 نقاطك\nسيتم جلب رصيدك مباشرة من قاعدة بيانات LEGACY.', ephemeral: true });
  if (action === 'inventory') return interaction.reply({ content: '🎒 حقيبتك\nسيتم عرض كل العناصر التي تملكها هنا.', ephemeral: true });
  if (action === 'shop') return interaction.reply({ content: '🛒 المتجر\nالعناصر المتاحة للشراء ستظهر هنا.', ephemeral: true });
  if (action === 'leaderboard') return interaction.reply({ content: '🏆 المتصدرين\nسيتم عرض ترتيب LEGACY هنا.', ephemeral: true });
  if (action === 'social') return interaction.reply({ content: '👥 الأصدقاء والمتابعة\nسيتم عرض الشبكة الاجتماعية هنا.', ephemeral: true });
  if (action === 'settings') return interaction.reply({ content: '⚙️ إعدادات حسابك\nإعدادات الخصوصية والتخصيص ستظهر هنا.', ephemeral: true });
});

if (!process.env.DISCORD_BOT_TOKEN) console.warn('DISCORD_BOT_TOKEN is missing');
else client.login(process.env.DISCORD_BOT_TOKEN);
