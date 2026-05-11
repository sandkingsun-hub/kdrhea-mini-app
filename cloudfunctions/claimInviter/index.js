// claimInviter · 新用户首登绑定 inviter 关系
// 入参：{ shortCode } 或 { inviter, channel }（两种模式兼容）
// 出参：{ ok, inviterOpenid, alreadyBound, inviterChannel }
//
// 业务规则：
// - 调用者必须是新用户（user.inviterId 当前为 null）·已有 inviter 不允许覆盖
// - firstPaidAt 已设拒绝补绑·防刷
// - 不允许自己邀请自己
// - referral_links.hits +1（两种模式都尝试累加）
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const inviteeOpenid = wxContext.OPENID;
  const { shortCode, inviter, channel } = event;

  if (!inviteeOpenid) return { ok: false, code: 'NO_OPENID' };

  // 1. 解析 inviter openid + channel（两种模式）
  let inviterOpenid;
  let inviterChannel;
  let linkDoc = null;

  if (inviter && channel) {
    // 模式 A · 分享落地页直传 openid + channel
    inviterOpenid = inviter;
    inviterChannel = channel;
  } else if (shortCode && typeof shortCode === 'string') {
    // 模式 B · 短码反查 referral_links
    const linkQuery = await db
      .collection('referral_links')
      .where({ shortCode })
      .limit(1)
      .get();
    if (linkQuery.data.length === 0) {
      return { ok: false, code: 'INVALID_SHORTCODE' };
    }
    linkDoc = linkQuery.data[0];
    inviterOpenid = linkDoc.inviterOpenid;
    inviterChannel = linkDoc.channel;
  } else {
    return { ok: false, code: 'MISSING_INVITER_REF' };
  }

  if (inviterOpenid === inviteeOpenid) {
    return { ok: false, code: 'SELF_INVITE' };
  }

  // 2. 模式 A 下校验 inviter 是真实用户·防恶意构造 URL
  if (!linkDoc) {
    const inviterUser = await db.collection('users')
      .where({ _openid: inviterOpenid }).limit(1).get();
    if (inviterUser.data.length === 0) {
      return { ok: false, code: 'INVITER_NOT_FOUND' };
    }
  }

  // 3. 查当前用户档案
  const userQuery = await db
    .collection('users')
    .where({ _openid: inviteeOpenid })
    .limit(1)
    .get();
  if (userQuery.data.length === 0) {
    return { ok: false, code: 'USER_NOT_FOUND', message: '请先 login' };
  }
  const user = userQuery.data[0];
  if (user.firstPaidAt) {
    return {
      ok: false,
      code: 'ALREADY_HAS_FIRST_TRANSACTION',
      message: '您已完成首次消费·邀请关系不可补绑',
    };
  }
  if (user.inviterId) {
    return {
      ok: true,
      alreadyBound: true,
      inviterOpenid: user.inviterId,
      currentChannel: user.inviterChannel,
    };
  }

  // 4. 写入 user.inviterId + inviterChannel
  await db.collection('users').doc(user._id).update({
    data: {
      inviterId: inviterOpenid,
      inviterChannel,
      lastActiveAt: new Date().toISOString(),
    },
  });

  // 5. referral_links.hits +1
  if (linkDoc) {
    await db.collection('referral_links').doc(linkDoc._id).update({
      data: { hits: _.inc(1) },
    });
  } else {
    // 模式 A 也尝试找对应 link 累加 hits·没有就不动
    const q = await db.collection('referral_links')
      .where({ inviterOpenid, channel: inviterChannel })
      .limit(1).get();
    if (q.data.length > 0) {
      await db.collection('referral_links').doc(q.data[0]._id).update({
        data: { hits: _.inc(1) },
      });
    }
  }

  return {
    ok: true,
    alreadyBound: false,
    inviterOpenid,
    inviterChannel,
  };
};
