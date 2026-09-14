'use strict';

const INVITE_CODE = String(process.env.LEGACY_GUILD_INVITE || 'ufEneEgpSA').trim();
const BOT_TOKEN = String(process.env.DISCORD_BOT_TOKEN || '').trim();

async function resolveGuildFromInvite() {
  if (!INVITE_CODE) throw new Error('LEGACY_GUILD_INVITE غير مضبوط');

  const response = await fetch(
    `https://discord.com/api/v10/invites/${encodeURIComponent(INVITE_CODE)}?with_counts=true`
  );

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(
      `تعذر قراءة دعوة سيرفر LEGACY (${response.status})${details ? `: ${details}` : ''}`
    );
  }

  const invite = await response.json();
  if (!invite.guild?.id) throw new Error('رابط دعوة LEGACY لا يحتوي على سيرفر صالح');

  return {
    id: invite.guild.id,
    name: invite.guild.name || 'LEGACY',
    invite: `https://discord.gg/${INVITE_CODE}`
  };
}

async function getBotGuildMember(guildId, userId) {
  const response = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/members/${userId}`,
    { headers: { Authorization: `Bot ${BOT_TOKEN}` } }
  );

  if (response.status === 200) return true;
  if (response.status === 404) return false;

  const details = await response.text().catch(() => '');
  throw new Error(
    `تعذر التحقق من عضوية Discord (${response.status})${details ? `: ${details}` : ''}`
  );
}

async function joinLegacyGuild(userId, oauthAccessToken) {
  if (!BOT_TOKEN) {
    throw new Error('DISCORD_BOT_TOKEN غير مضبوط؛ لا يمكن إضافة العضو إلى سيرفر LEGACY');
  }

  if (!oauthAccessToken) {
    throw new Error('Discord OAuth access token مفقود؛ أعد ربط الحساب');
  }

  const guild = await resolveGuildFromInvite();

  // إذا كان العضو داخل السيرفر مسبقاً، لا نعيد طلب إضافته.
  if (await getBotGuildMember(guild.id, userId)) return guild;

  const response = await fetch(
    `https://discord.com/api/v10/guilds/${guild.id}/members/${userId}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ access_token: oauthAccessToken })
    }
  );

  if (![201, 204].includes(response.status)) {
    const details = await response.text().catch(() => '');

    let reason = '';
    try {
      const parsed = details ? JSON.parse(details) : null;
      if (parsed?.message) reason = ` — ${parsed.message}`;
      if (parsed?.code) reason += ` [Discord ${parsed.code}]`;
    } catch {}

    if (response.status === 403) {
      throw new Error(
        `Discord رفض إضافة العضو (403). تأكد أن بوت LEGACY موجود داخل السيرفر ولديه صلاحية Create Instant Invite، وأن التطبيق نفسه هو صاحب OAuth. ${reason}`
      );
    }

    if (response.status === 401) {
      throw new Error(
        `Discord رفض OAuth (401). غالباً لم تتم الموافقة على guilds.join أو أن رمز OAuth غير صالح. ${reason}`
      );
    }

    throw new Error(
      `تعذر إدخالك إلى سيرفر LEGACY (${response.status})${reason}${details && !reason ? `: ${details}` : ''}`
    );
  }

  return guild;
}

async function isLegacyGuildMember(userId) {
  if (!BOT_TOKEN) return false;
  const guild = await resolveGuildFromInvite();
  return getBotGuildMember(guild.id, userId);
}

module.exports = {
  joinLegacyGuild,
  isLegacyGuildMember,
  resolveGuildFromInvite,
  INVITE_CODE
};
