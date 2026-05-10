// redeemCoupon · 员工核销券
// 入参：{ couponNo, verifyToken, usedNote? }
// 出参：{ ok, couponId, customerOpenid, couponName }
//
// 权限：仅 staff/admin
// 校验：状态 active + 时间内 + verifyToken 匹配 + couponNo 找到
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function getRole(openid) {
  const q = await db.collection("users").where({ _openid: openid }).limit(1).get();
  return q.data[0]?.role || "customer";
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const callerOpenid = wxContext.OPENID;
  const { couponNo, verifyToken, usedNote = "" } = event;

  if (!callerOpenid) {
    return { ok: false, code: "NO_OPENID" };
  }
  const role = await getRole(callerOpenid);
  if (role !== "staff" && role !== "admin") {
    return { ok: false, code: "PERMISSION_DENIED" };
  }

  if (!couponNo) {
    return { ok: false, code: "MISSING_COUPON_NO" };
  }

  const q = await db.collection("user_coupons").where({ couponNo }).limit(1).get();
  if (q.data.length === 0) {
    return { ok: false, code: "COUPON_NOT_FOUND" };
  }
  const c = q.data[0];

  if (c.status !== "active") {
    return { ok: false, code: "COUPON_NOT_ACTIVE", currentStatus: c.status };
  }
  if (c.validUntil && new Date(c.validUntil) < new Date()) {
    await db.collection("user_coupons").doc(c._id).update({ data: { status: "expired" } });
    return { ok: false, code: "COUPON_EXPIRED" };
  }
  if (verifyToken && c.verifyToken !== verifyToken) {
    return { ok: false, code: "VERIFY_TOKEN_MISMATCH" };
  }

  const now = new Date().toISOString();
  await db.collection("user_coupons").doc(c._id).update({
    data: {
      status: "used",
      usedAt: now,
      usedBy: callerOpenid,
      usedNote,
    },
  });

  return {
    ok: true,
    couponId: c._id,
    customerOpenid: c._openid,
    couponName: c.couponName,
  };
};
