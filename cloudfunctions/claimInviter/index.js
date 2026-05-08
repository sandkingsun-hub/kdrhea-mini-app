// claimInviter · 新用户首登绑定 inviter 关系
// 入参：{ shortCode }
// 出参：{ ok, inviterOpenid, alreadyBound }
//
// 业务规则：
// - 调用者必须是新用户（user.inviterId 当前为 null）·已有 inviter 不允许覆盖
// - shortCode 必须存在
// - 不允许自己邀请自己（防自刷）
// - referral_links.hits +1（不管是否真转化·只要扫码就计点击）
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const inviteeOpenid = wxContext.OPENID;
  const { shortCode } = event;

  if (!inviteeOpenid) return { ok: false, code: 'NO_OPENID' };
  if (!shortCode || typeof shortCode !== 'string') {
    return { ok: false, code: 'MISSING_SHORTCODE' };
  }

  // 1. 查 referral_links
  const linkQuery = await db
    .collection('referral_links')
    .where({ shortCode })
    .limit(1)
    .get();
  if (linkQuery.data.length === 0) {
    return { ok: false, code: 'INVALID_SHORTCODE' };
  }
  const link = linkQuery.data[0];
  const inviterOpenid = link.inviterOpenid;

  if (inviterOpenid === inviteeOpenid) {
    return { ok: false, code: 'SELF_INVITE' };
  }

  // 2. 查当前用户档案
  const userQuery = await db
    .collection('users')
    .where({ _openid: inviteeOpenid })
    .limit(1)
    .get();
  if (userQuery.data.length === 0) {
    return { ok: false, code: 'USER_NOT_FOUND', message: '请先 login' };
  }
  const user = userQuery.data[0];
  if (user.inviterId) {
    // 已绑定 · 不覆盖
    return {
      ok: true,
      alreadyBound: true,
      inviterOpenid: user.inviterId,
      currentChannel: user.inviterChannel,
    };
  }

  // 3. 写入 user.inviterId + inviterChannel
  await db.collection('users').doc(user._id).update({
    data: {
      inviterId: inviterOpenid,
      inviterChannel: link.channel,
      lastActiveAt: new Date().toISOString(),
    },
  });

  // 4. referral_links.hits +1
  await db.collection('referral_links').doc(link._id).update({
    data: { hits: _.inc(1) },
  });

  return {
    ok: true,
    alreadyBound: false,
    inviterOpenid,
    inviterChannel: link.channel,
  };
};
