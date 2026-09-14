require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent], partials: [Partials.Channel] });
const admins = new Set((process.env.LEGACY_ADMIN_IDS || '').split(',').map(x=>x.trim()).filter(Boolean));
const API = process.env.LEGACY_API_URL || `http://localhost:${process.env.API_PORT || 4000}`;
const INTERNAL_KEY = process.env.LEGACY_INTERNAL_KEY || '';

async function internal(path, options={}) {
  const r = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', 'x-legacy-internal-key': INTERNAL_KEY, ...(options.headers||{}) } });
  const data = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(data.error || 'فشل الاتصال بالخادم');
  return data;
}
function normalMenu(){return new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('legacy:profile').setLabel('بروفايلي').setEmoji('👤').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('legacy:premium').setLabel('اشتراكي').setEmoji('💎').setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId('legacy:points').setLabel('نقاطي').setEmoji('🪙').setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId('legacy:inventory').setLabel('حقيبتي').setEmoji('🎒').setStyle(ButtonStyle.Secondary));}
function normalMenu2(){return new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('legacy:shop').setLabel('المتجر').setEmoji('🛒').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('legacy:leaderboard').setLabel('المتصدرين').setEmoji('🏆').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('legacy:social').setLabel('الأصدقاء').setEmoji('👥').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('legacy:settings').setLabel('الإعدادات').setEmoji('⚙️').setStyle(ButtonStyle.Secondary));}
function adminMenu(){return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('legacy:admin').setPlaceholder('اختر قسم الإدارة').addOptions(
  ['users','إدارة المستخدمين','👥'],['points','النقاط','🪙'],['inventory','الحقيبة والعناصر','🎒'],['catalog','المتجر والكتالوج','🛒'],['premium','Premium والاشتراكات','💎'],['codes','الأكواد والجوائز','🔑'],['groups','المجموعات والصلاحيات','👑'],['stats','الإحصائيات والمتصدرين','📊'],['audit','السجلات والتدقيق','📝'],['settings','إعدادات LEGACY','⚙️']
).map(([value,label,emoji])=>new StringSelectMenuOptionBuilder().setLabel(label).setValue(value).setEmoji(emoji))));}
function home(user,isAdmin){const e=new EmbedBuilder().setTitle(isAdmin?'LEGACY | لوحة الإدارة':'LEGACY').setDescription(isAdmin?'لوحة التحكم الكاملة للنظام. من هنا تتحكم بالمستخدمين والنقاط والمحتوى والسجلات.':'حسابك في LEGACY — كل شيء من قائمة واحدة.').setThumbnail(user.displayAvatarURL({size:256})).setFooter({text:isAdmin?'صلاحيات الإدارة مفعلة':'LEGACY • حسابك ومحتواك'});return isAdmin?{embeds:[e],components:[adminMenu()]}:{embeds:[e],components:[normalMenu(),normalMenu2()]};}
function adminSection(section){const map={users:['👥 إدارة المستخدمين','ابحث عن مستخدم عبر Discord ID.','legacy:admin:user'],points:['🪙 إدارة النقاط','إضافة أو خصم نقاط مع تسجيل العملية.','legacy:admin:points'],inventory:['🎒 إدارة الحقيبة والعناصر','مراجعة حقيبة مستخدم.','legacy:admin:inventory'],catalog:['🛒 إدارة المتجر والكتالوج','إضافة عناصر ديناميكية للمتجر.','legacy:admin:catalog'],premium:['💎 Premium والاشتراكات','إدارة حالة Premium.','legacy:admin:premium'],codes:['🔑 الأكواد والجوائز','إنشاء أكواد وجوائز ديناميكية.','legacy:admin:codes'],groups:['👑 المجموعات والصلاحيات','إدارة المجموعات والأدوار.','legacy:admin:groups'],stats:['📊 الإحصائيات والمتصدرين','مراقبة أرقام LEGACY.','legacy:admin:stats'],audit:['📝 السجلات والتدقيق','عرض آخر العمليات الإدارية.','legacy:admin:audit'],settings:['⚙️ إعدادات LEGACY','إعدادات النظام العامة.','legacy:admin:settings']};const [title,desc,id]=map[section]||['LEGACY','قسم غير معروف.'];return {content:`**${title}**\n${desc}`,components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(id).setLabel('فتح القسم').setStyle(ButtonStyle.Primary))],ephemeral:true};}

client.once('ready',()=>console.log(`LEGACY Bot ONLINE as ${client.user.tag}`));
client.on('messageCreate',async m=>{if(m.author.bot||m.content.trim().toLowerCase()!=='legacy')return;await m.reply(home(m.author,admins.has(m.author.id)));});
client.on('interactionCreate',async i=>{
  if(!i.customId?.startsWith('legacy:'))return;
  try{
    if(i.isStringSelectMenu()&&i.customId==='legacy:admin'){if(!admins.has(i.user.id))return i.reply({content:'هذه اللوحة للإدارة فقط.',ephemeral:true});return i.reply(adminSection(i.values[0]));}
    if(i.isButton()&&i.customId==='legacy:admin:user')return i.showModal(new ModalBuilder().setCustomId('legacy:modal:user').setTitle('البحث عن مستخدم').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('discordId').setLabel('Discord ID').setStyle(TextInputStyle.Short).setRequired(true))));
    if(i.isButton()&&i.customId==='legacy:admin:points')return i.showModal(new ModalBuilder().setCustomId('legacy:modal:points').setTitle('تعديل النقاط').addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('target').setLabel('Discord ID للمستخدم').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel('عدد النقاط (+ للإضافة / - للخصم)').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('السبب').setStyle(TextInputStyle.Short).setRequired(true))));
    if(i.isButton()&&i.customId==='legacy:admin:inventory')return i.showModal(new ModalBuilder().setCustomId('legacy:modal:inventory').setTitle('حقيبة مستخدم').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('discordId').setLabel('Discord ID').setStyle(TextInputStyle.Short).setRequired(true))));
    if(i.isButton()&&i.customId==='legacy:admin:audit'){const rows=await internal('/internal/audit');return i.reply({content:rows.length?rows.slice(0,10).map(x=>`• ${x.action} — ${new Date(x.created_at).toLocaleString('ar')}`).join('\n'):'لا توجد سجلات بعد.',ephemeral:true});}
    if(i.isButton()&&i.customId==='legacy:admin:catalog')return i.showModal(new ModalBuilder().setCustomId('legacy:modal:catalog').setTitle('إضافة عنصر للمتجر').addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('type').setLabel('النوع مثل frame / badge / background').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('slug').setLabel('المعرف الفريد').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name').setLabel('اسم العنصر').setStyle(TextInputStyle.Short).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('price').setLabel('السعر بالنقاط').setStyle(TextInputStyle.Short).setRequired(true))));

    if(i.isModalSubmit()&&i.customId==='legacy:modal:user'){if(!admins.has(i.user.id))return i.reply({content:'الإدارة فقط.',ephemeral:true});const u=await internal(`/internal/user/${encodeURIComponent(i.fields.getTextInputValue('discordId').trim())}`);const e=new EmbedBuilder().setTitle('👤 ملف LEGACY').setDescription(`**${u.display_name||u.global_name||u.username}**\nDiscord: ${u.discord_id}\nالمستوى: ${u.level}\nالنقاط: ${u.points}\nPremium: ${u.premium_until?'فعال':'غير مشترك'}`).setThumbnail(u.avatar_url||null);return i.reply({embeds:[e],ephemeral:true});}
    if(i.isModalSubmit()&&i.customId==='legacy:modal:points'){if(!admins.has(i.user.id))return i.reply({content:'الإدارة فقط.',ephemeral:true});const target=i.fields.getTextInputValue('target').trim();const amount=Number(i.fields.getTextInputValue('amount'));const reason=i.fields.getTextInputValue('reason').trim();await internal('/internal/admin/points',{method:'POST',body:JSON.stringify({actorDiscordId:i.user.id,targetDiscordId:target,amount,reason})});return i.reply({content:`✅ تم تعديل النقاط للمستخدم <@${target}> بمقدار **${amount}**.`,ephemeral:true});}
    if(i.isModalSubmit()&&i.customId==='legacy:modal:inventory'){if(!admins.has(i.user.id))return i.reply({content:'الإدارة فقط.',ephemeral:true});const rows=await internal(`/internal/user/${encodeURIComponent(i.fields.getTextInputValue('discordId').trim())}/inventory`);return i.reply({content:rows.length?rows.map(x=>`• ${x.name} × ${x.quantity}`).join('\n'):'الحقيبة فارغة.',ephemeral:true});}
    if(i.isModalSubmit()&&i.customId==='legacy:modal:catalog'){if(!admins.has(i.user.id))return i.reply({content:'الإدارة فقط.',ephemeral:true});const type=i.fields.getTextInputValue('type').trim(),slug=i.fields.getTextInputValue('slug').trim(),name=i.fields.getTextInputValue('name').trim(),price=Number(i.fields.getTextInputValue('price'));if(!Number.isSafeInteger(price)||price<0)return i.reply({content:'السعر غير صحيح.',ephemeral:true});const r=await fetch(`${API}/api/admin/catalog`,{method:'POST',headers:{'Content-Type':'application/json','x-legacy-admin-discord':i.user.id},body:JSON.stringify({type,slug,name,price})});if(!r.ok)return i.reply({content:'تعذر إنشاء العنصر. أنشئه من لوحة الموقع حالياً.',ephemeral:true});return i.reply({content:`✅ تمت إضافة **${name}** إلى الكتالوج.`,ephemeral:true});}

    const action=i.customId.split(':')[1];
    if(action==='profile'||action==='premium'||action==='points'||action==='inventory'){const u=await internal(`/internal/user/${i.user.id}`);if(action==='profile')return i.reply({embeds:[new EmbedBuilder().setTitle('👤 بروفايلي').setDescription(`**${u.display_name||u.global_name||u.username}**\nالمستوى: ${u.level}\nالنقاط: ${u.points}\n${u.bio||'لا توجد نبذة بعد.'}`).setThumbnail(u.avatar_url||null)],ephemeral:true});if(action==='points')return i.reply({content:`🪙 **نقاطك:** ${u.points}\n⭐ **مستواك:** ${u.level}`,ephemeral:true});if(action==='premium')return i.reply({content:`💎 **Premium:** ${u.premium_until?'فعال حتى '+new Date(u.premium_until).toLocaleString('ar'):'غير مشترك'}`,ephemeral:true});const inv=await internal(`/internal/user/${i.user.id}/inventory`);return i.reply({content:inv.length?`🎒 حقيبتك:\n${inv.map(x=>`• ${x.name} × ${x.quantity}`).join('\n')}`:'🎒 حقيبتك فارغة.',ephemeral:true});}
    if(action==='shop'){const rows=await internal('/internal/shop');return i.reply({content:rows.length?`🛒 **المتجر**\n${rows.slice(0,15).map(x=>`• ${x.name} — ${x.price} نقطة`).join('\n')}`:'المتجر فارغ.',ephemeral:true});}
    if(action==='leaderboard'){const r=await fetch(`${API}/api/leaderboards/points`);const rows=await r.json();return i.reply({content:rows.length?`🏆 **المتصدرين**\n${rows.slice(0,10).map((x,n)=>`${n+1}. ${x.global_name||x.username} — ${x.points}`).join('\n')}`:'لا توجد بيانات.',ephemeral:true});}
    if(action==='social')return i.reply({content:'👥 نظام الأصدقاء والمتابعة مرتبط بالحساب المشترك، وسيتم توسيعه في المرحلة الاجتماعية.',ephemeral:true});
    if(action==='settings')return i.reply({content:'⚙️ إعدادات الحساب مرتبطة بنفس حساب LEGACY على الموقع والـ Activity.',ephemeral:true});
  }catch(e){console.error(e);if(!i.replied&&!i.deferred)await i.reply({content:`❌ ${e.message}`,ephemeral:true});}
});
if(!process.env.DISCORD_BOT_TOKEN)console.warn('DISCORD_BOT_TOKEN is missing');else client.login(process.env.DISCORD_BOT_TOKEN);
