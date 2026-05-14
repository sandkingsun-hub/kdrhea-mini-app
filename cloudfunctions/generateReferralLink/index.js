// generateReferralLink · 创建/获取我的分享码
// 入参：{ channel?: 'aesthetic_journal' | 'direct_share' | 'qr_in_store', refJournalId? }
// 出参：{ ok, shortCode, channel, link }
//
// 策略：同一用户在同一 channel 下复用一个 shortCode·避免每次分享生成新码
// 短码：6 位 [A-Z0-9]·支持 36^6 = 21 亿 · 单用户重复检查后插入
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉容易混淆的 0/O/1/I

function genCode() {
  let s = '';
  for (let i = 0; i < 6; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return s;
}

const ALLOWED_CHANNELS = new Set(['aesthetic_journal', 'direct_share', 'qr_in_store', 'charity']);

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const inviterOpenid = wxContext.OPENID;
  const { channel = 'direct_share', refJournalId = null } = event;

  if (!inviterOpenid) return { ok: false, code: 'NO_OPENID' };
  if (!ALLOWED_CHANNELS.has(channel)) return { ok: false, code: 'INVALID_CHANNEL' };

  const col = db.collection('referral_links');

  // 复用：同 inviter + 同 channel + 同 refJournalId 已有的 → 返回旧码
  const existingQuery = await col
    .where({
      inviterOpenid,
      channel,
      refJournalId: refJournalId || null,
    })
    .limit(1)
    .get();

  if (existingQuery.data && existingQuery.data.length > 0) {
    const ex = existingQuery.data[0];
    return {
      ok: true,
      shortCode: ex.shortCode,
      channel: ex.channel,
      link: `?ref=${ex.shortCode}`,
      reused: true,
    };
  }

  // 生成新码 · 重试 5 次防碰撞
  let shortCode;
  for (let i = 0; i < 5; i++) {
    const candidate = genCode();
    const collide = await col.where({ shortCode: candidate }).count();
    if (collide.total === 0) {
      shortCode = candidate;
      break;
    }
  }
  if (!shortCode) return { ok: false, code: 'CODE_GEN_FAILED' };

  const now = new Date().toISOString();
  await col.add({
    data: {
      inviterOpenid,
      shortCode,
      channel,
      refJournalId,
      createdAt: now,
      hits: 0,
      conversions: 0,
      totalGmvFromConversion: 0,
    },
  });

  return {
    ok: true,
    shortCode,
    channel,
    link: `?ref=${shortCode}`,
    reused: false,
  };
};
