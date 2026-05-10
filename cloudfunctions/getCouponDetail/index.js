// getCouponDetail · 单券详情（含 verifyToken·用于生成 QR）
// 入参：{ couponId }
// 出参：{ ok, coupon }
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { couponId } = event;

  if (!openid) {
    return { ok: false, code: "NO_OPENID" };
  }
  if (!couponId) {
    return { ok: false, code: "MISSING_ID" };
  }

  let doc;
  try {
    const r = await db.collection("user_coupons").doc(couponId).get();
    doc = r.data;
  } catch {
    return { ok: false, code: "COUPON_NOT_FOUND" };
  }

  if (doc._openid !== openid) {
    return { ok: false, code: "NOT_YOUR_COUPON" };
  }

  // 懒维护过期
  if (doc.status === "active" && doc.validUntil && new Date(doc.validUntil) < new Date()) {
    await db.collection("user_coupons").doc(couponId).update({ data: { status: "expired" } });
    doc.status = "expired";
  }

  return { ok: true, coupon: doc };
};
