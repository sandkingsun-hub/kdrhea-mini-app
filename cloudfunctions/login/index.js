// login · 首次登录写 users 表 · 返回 openid + 是否新用户
// 入参：{ }（不需要·云函数自带 openid）
// 出参：{ openid, isNewUser, user, hasPendingActivation }
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const unionId = wxContext.UNIONID || null;

  if (!openid) {
    return { ok: false, code: "NO_OPENID", message: "获取 openid 失败" };
  }

  const usersCol = db.collection("users");
  const now = new Date().toISOString();

  // 查是否已存在
  const existing = await usersCol.where({ _openid: openid }).limit(1).get();

  if (existing.data && existing.data.length > 0) {
    // 老用户·更新 lastActiveAt
    const user = existing.data[0];
    await usersCol.doc(user._id).update({
      data: { lastActiveAt: now },
    });
    return {
      ok: true,
      openid,
      isNewUser: false,
      user: { ...user, lastActiveAt: now },
      hasPendingActivation: false,
    };
  }

  // 新用户·插入
  const newUser = {
    _openid: openid,
    unionId,
    phone: null,
    phoneHash: null,
    nickname: null,
    avatarUrl: null,
    gender: 0,
    registeredAt: now,
    lastActiveAt: now,
    activatedFromOldCustomer: false,
    oldCustomerActivatedAt: null,
    inviterId: event.inviterOpenid || null,
    inviterChannel: event.inviterChannel || null,
  };

  const inserted = await usersCol.add({ data: newUser });

  // 同步建空积分账户
  await db.collection("points_account").add({
    data: {
      _openid: openid,
      balance: 0,
      totalEarned: 0,
      totalSpent: 0,
      pendingPoints: 0,
      lastUpdatedAt: now,
    },
  });

  return {
    ok: true,
    openid,
    isNewUser: true,
    user: { _id: inserted._id, ...newUser },
    hasPendingActivation: false, // 真正判断在 activateOldCustomer · 需要拿到手机号后再查
  };
};
