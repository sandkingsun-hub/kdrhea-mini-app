// subscribeReminder · 顾客点同意订阅预约消息后调 · 累计配额
// 入: { templateIds?: string[] } · 微信 wx.requestSubscribeMessage 返回的同意的 template ids
// 出: { ok, quotaRemaining }
//
// 业务规则:
//   - 一次性订阅 · 每个 template 顾客同意一次 = 我们能发一条 · quotaRemaining 累计
//   - 发送一条 quotaRemaining -1 · 跨 template 共享配额（简化版）
//   - 同意越多 · 我们能发越多
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { ok: false, code: "NO_OPENID" };

  const { templateIds = [] } = event;
  const validIds = Array.isArray(templateIds) ? templateIds.filter(t => typeof t === "string" && t.length > 0) : [];

  // 拉 user
  const userQ = await db.collection("users").where({ _openid: openid }).limit(1).get();
  if (userQ.data.length === 0) return { ok: false, code: "USER_NOT_FOUND" };
  const user = userQ.data[0];

  const now = new Date().toISOString();
  const oldQuota = user.reminderQuotaRemaining || 0;
  const newQuota = oldQuota + validIds.length;

  await db.collection("users").doc(user._id).update({
    data: {
      appointmentReminderSubscribedAt: now,
      reminderQuotaRemaining: newQuota,
      reminderSubscribedTemplates: validIds, // 最近一次同意的 ids（debug 用）
      lastActiveAt: now,
    },
  });

  return { ok: true, quotaRemaining: newQuota, addedQuota: validIds.length };
};
