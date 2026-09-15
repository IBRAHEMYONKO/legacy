'use strict';

const INVITE_CODE = String(process.env.LEGACY_GUILD_INVITE || 'ufEneEgpSA').trim();
const BOT_TOKEN = String(process.env.DISCORD_BOT_TOKEN || '').trim();
const CLIENT_ID = String(process.env.DISCORD_CLIENT_ID || '').trim();
const defaultFetch = (...args) => fetch(...args);

function jsonHeaders(extra = {}) {
  return { 'Content-Type': 'application/json', ...extra };
}

async function responseDetails(response) {
  const text = await response.text().catch(() => '');
  if (!text) return { text: '', message: '', code: '' };
  try {
    const parsed = JSON.parse(text);
    return { text, message: parsed?.message || '', code: parsed?.code != null ? String(parsed.code) : '' };
  } catch {
    return { text, message: '', code: '' };
  }
}

async function resolveGuildFromInvite(fetchImpl = defaultFetch) {
  if (!INVITE_CODE) throw new Error('رابط سيرفر LEGACY غير مضبوط');
  const response = await fetchImpl(`https://discord.com/api/v10/invites/${encodeURIComponent(INVITE_CODE)}?with_counts=true`);
  if (!response.ok) {
    const details = await responseDetails(response);
    throw new Error(`تعذر قراءة دعوة سيرفر LEGACY (${response.status})${details.message ? ` — ${details.message}` : ''}${details.code ? ` [Discord ${details.code}]` : ''}`);
  }
  const invite = await response.json();
  if (!invite.guild?.id) throw new Error('رابط دعوة LEGACY لا يحتوي على سيرفر صالح');
  return { id: invite.guild.id, name: invite.guild.name || 'LEGACY', invite: `https://discord.gg/${INVITE_CODE}` };
}

async function getBotIdentity(fetchImpl = defaultFetch) {
  if (fetchImpl === defaultFetch && !BOT_TOKEN) throw new Error('DISCORD_BOT_TOKEN غير مضبوط');
  const response = await fetchImpl('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bot ${BOT_TOKEN}` } });
  if (!response.ok) {
    const details = await responseDetails(response);
    throw new Error(`تعذر التحقق من هوية بوت LEGACY (${response.status})${details.message ? ` — ${details.message}` : ''}${details.code ? ` [Discord ${details.code}]` : ''}`);
  }
  return response.json();
}

async function assertSameDiscordApplication(fetchImpl = defaultFetch) {
  if (!CLIENT_ID) return;
  const bot = await getBotIdentity(fetchImpl);
  if (bot.id !== CLIENT_ID) throw new Error('تطبيق Discord غير متطابق: DISCORD_CLIENT_ID لا يطابق بوت LEGACY. استخدم Client ID لنفس التطبيق الموجود منه DISCORD_BOT_TOKEN.');
}

async function getBotGuildMember(guildId, userId, fetchImpl = defaultFetch) {
  if (fetchImpl === defaultFetch && !BOT_TOKEN) throw new Error('DISCORD_BOT_TOKEN غير مضبوط؛ لا يمكن التحقق من عضوية السيرفر');
  const response = await fetchImpl(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, { headers: { Authorization: `Bot ${BOT_TOKEN}` } });
  if (response.status === 200) return true;
  if (response.status === 404) return false;
  const details = await responseDetails(response);
  if (response.status === 403) throw new Error(`لا يستطيع بوت LEGACY فحص عضوية المستخدم في السيرفر (403)${details.message ? ` — ${details.message}` : ''}${details.code ? ` [Discord ${details.code}]` : ''}`);
  throw new Error(`تعذر التحقق من عضوية Discord (${response.status})${details.message ? ` — ${details.message}` : ''}${details.code ? ` [Discord ${details.code}]` : ''}`);
}

async function joinLegacyGuild(userId, oauthAccessToken, fetchImpl = defaultFetch) {
  if (fetchImpl === defaultFetch && !BOT_TOKEN) throw new Error('DISCORD_BOT_TOKEN غير مضبوط؛ لا يمكن إضافة العضو إلى سيرفر LEGACY');
  if (!oauthAccessToken) throw new Error('Discord OAuth access token مفقود؛ أعد ربط الحساب');
  await assertSameDiscordApplication(fetchImpl);
  const guild = await resolveGuildFromInvite(fetchImpl);
  if (await getBotGuildMember(guild.id, userId, fetchImpl)) return guild;

  const response = await fetchImpl(`https://discord.com/api/v10/guilds/${guild.id}/members/${userId}`, {
    method: 'PUT',
    headers: jsonHeaders({ Authorization: `Bot ${BOT_TOKEN}` }),
    body: JSON.stringify({ access_token: oauthAccessToken })
  });

  if (![201, 204].includes(response.status)) {
    const details = await responseDetails(response);
    const suffix = `${details.message ? ` — ${details.message}` : ''}${details.code ? ` [Discord ${details.code}]` : ''}`;
    if (response.status === 401) throw new Error(`Discord رفض OAuth أثناء إضافة العضو (401)${suffix}`);
    if (response.status === 403) throw new Error(`Discord رفض إضافة العضو (403). تحقق من أن بوت LEGACY موجود في السيرفر وأن تطبيق OAuth هو نفس تطبيق البوت${suffix}`);
    throw new Error(`تعذر إدخالك إلى سيرفر LEGACY (${response.status})${suffix}`);
  }

  if (!(await getBotGuildMember(guild.id, userId, fetchImpl))) throw new Error('تم قبول طلب إضافة العضو من Discord لكن العضوية لم تظهر بعد. أعد المحاولة بعد لحظات.');
  return guild;
}

async function isLegacyGuildMember(userId, fetchImpl = defaultFetch) {
  if (fetchImpl === defaultFetch && !BOT_TOKEN) return false;
  const guild = await resolveGuildFromInvite(fetchImpl);
  return getBotGuildMember(guild.id, userId, fetchImpl);
}

module.exports = { joinLegacyGuild, isLegacyGuildMember, resolveGuildFromInvite, getBotGuildMember, getBotIdentity, assertSameDiscordApplication, INVITE_CODE };
