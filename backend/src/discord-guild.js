'use strict';

const INVITE_CODE = String(process.env.LEGACY_GUILD_INVITE || 'ufEneEgpSA').trim();
const BOT_TOKEN = String(process.env.DISCORD_BOT_TOKEN || '').trim();

async function resolveGuildFromInvite() {
  if (!INVITE_CODE) throw new Error('LEGACY_GUILD_INVITE غير مضبوط');
  const response = await fetch(`https://discord.com/api/v10/invites/${encodeURIComponent(INVITE_CODE)}?with_counts=true`);
  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`تعذر قراءة دعوة سيرفر LEGACY (${response.status})${details ? `: ${details}` : ''}`);
  }
  const invite = await response.json();
  if (!invite.guild?.id) throw new Error('رابط دعوة LEGACY لا يحتوي على سيرفر صالح');
  return { id: invite.guild.id, name: invite.guild.name || 'LEGACY', invite: `https://discord.gg/${INVITE_CODE}` };
}

async function joinLegacyGuild(userId, oauthAccessToken) {
  if (!BOT_TOKEN) throw new Error('DISCORD_BOT_TOKEN غير مضبوط؛ لا يمكن إضافة العضو إلى سيرفر LEGACY');
  if (!oauthAccessToken) throw new Error('Discord OAuth access token مفقود؛ أعد ربط الحساب');

  const guild = await resolveGuildFromInvite();
  const response = await fetch(`https://discord.com/api/v10/guilds/${guild.id}/members/${userId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ access_token: oauthAccessToken })
  });

  if (![201, 204].includes(response.status)) {
    const details = await response.text().catch(() => '');
    throw new Error(`تعذر إدخالك إلى سيرفر LEGACY (${response.status})${details ? `: ${details}` : ''}`);
  }

  return guild;
}

module.exports = { joinLegacyGuild, resolveGuildFromInvite, INVITE_CODE };
