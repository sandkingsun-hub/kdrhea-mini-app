// listMyCoupons · 拉用户的券包
// 入参：{ status?, limit?: 50 }   status: active|used|expired|revoked|all（默认 all）
// 出参：{ ok, items, counts: { active, used, expired, revoked } }
//
// 排序：active 优先·然后按 validUntil asc（即将过期排前）·used/expired 按 usedAt/validUntil desc
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

async function ensureCollection(name) {
  try {
    await db.collection(name).count();
  } catch (e) {
    if (String(e).includes("not exist")) {
      try {
        await db.createCollection(name);
      } catch {}
    }
  }
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { status = "all", limit = 50 } = event;

  if (!openid) {
    return { ok: false, code: "NO_OPENID" };
  }

  await ensureCollection("user_coupons");

  // 自动把过期的 active 标 expired（懒维护·扫本人范围）
  const now = new Date().toISOString();
  await db.collection("user_coupons").where({
    _openid: openid,
    status: "active",
    validUntil: _.lt(now),
  }).update({ data: { status: "expired" } });

  const where = { _openid: openid };
  if (status !== "all") {
    where.status = status;
  }

  const cap = Math.min(limit, 200);
  const list = await db.collection("user_coupons")
    .where(where)
    .orderBy("status", "asc") // active 字母序在 expired/revoked/used 前
    .orderBy("validUntil", "asc")
    .limit(cap)
    .get();

  // 计数（不区分本次 status filter · 给前端 chip 显示）
  const all = await db.collection("user_coupons").where({ _openid: openid }).get();
  const counts = { active: 0, used: 0, expired: 0, revoked: 0 };
  for (const c of all.data) {
    counts[c.status] = (counts[c.status] || 0) + 1;
  }

  return { ok: true, items: list.data, counts };
};
