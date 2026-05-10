// staffMyAllocations · 员工拉自己手里有余量的批次
// 入：（不需要参数·从 OPENID 拿）
// 出：{ ok, items, total }
//
// 返回 status=active 且 usedQuantity < quantity 的批次
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

async function getRole(openid) {
  const q = await db.collection("users").where({ _openid: openid }).limit(1).get();
  return q.data[0]?.role || "customer";
}

async function ensureCollection(name) {
  try { await db.collection(name).count(); }
  catch (e) {
    if (String(e).includes("not exist")) {
      try { await db.createCollection(name); } catch {}
    }
  }
}

exports.main = async () => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { ok: false, code: "NO_OPENID" };

  const role = await getRole(openid);
  if (role !== "staff" && role !== "admin") return { ok: false, code: "PERMISSION_DENIED" };

  await ensureCollection("coupon_allocations");

  const list = await db.collection("coupon_allocations").where({
    allocatedTo: openid,
    status: "active",
  }).orderBy("createdAt", "desc").limit(100).get();

  // 过滤还有余量的
  const items = list.data.filter(a => (a.usedQuantity || 0) < a.quantity).map(a => ({
    _id: a._id,
    templateId: a.templateId,
    templateNo: a.templateNo,
    templateName: a.templateName,
    quantity: a.quantity,
    usedQuantity: a.usedQuantity || 0,
    remaining: a.quantity - (a.usedQuantity || 0),
    createdAt: a.createdAt,
  }));

  return { ok: true, items, total: items.length };
};
