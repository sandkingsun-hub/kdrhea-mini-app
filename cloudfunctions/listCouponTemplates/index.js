// listCouponTemplates · 小程序员工端拉可见模板（不需要 admin token）
// 入：{ visibleToStaff?: true }
// 出：{ ok, items }
//
// 权限：员工/管理员可调（小程序内）
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

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

  await ensureCollection("coupon_templates");

  // 员工端只看 active + visibleToStaff
  const list = await db.collection("coupon_templates")
    .where({ status: "active", visibleToStaff: true })
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  return { ok: true, items: list.data };
};
