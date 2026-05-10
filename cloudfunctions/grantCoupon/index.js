// grantCoupon · 给用户发一张券
// 入参：{ targetOpenid, couponName, couponType, value, description, validDays?, source, sourceRefId?, sourceRefType? }
// 出参：{ ok, couponId, couponNo, verifyToken }
//
// 权限：仅 staff/admin（员工后台手动发）·或受信云函数互调（payOrder 等）
// 受信调用：传 __internal_caller='payOrder' 即可绕过角色校验（云函数互调环境）
const crypto = require("node:crypto");
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const ALLOWED_TYPES = new Set(["experience", "discount", "cash", "physical_gift", "custom"]);
const ALLOWED_SOURCES = new Set([
  "gifts_redeem", // 礼遇兑换
  "staff_grant", // 员工后台手发
  "consume_reward", // 消费返赠
  "push", // 推送活动
  "promotion", // 促销
  "old_customer_activation", // 老客激活赠
]);

// 6 位人类可读 · 去 0 O 1 I
const ALPHA = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function shortCode(n = 6) {
  let s = "";
  for (let i = 0; i < n; i++) {
    s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  }
  return s;
}

function genVerifyToken(openid, couponNo) {
  // 16 位 hex · 防普通伪造（不防服务端泄露）
  return crypto
    .createHash("sha256")
    .update(`${openid}|${couponNo}|${Date.now()}|${Math.random()}`)
    .digest("hex")
    .slice(0, 16);
}

async function getRole(openid) {
  const q = await db.collection("users").where({ _openid: openid }).limit(1).get();
  return q.data[0]?.role || "customer";
}

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
  const callerOpenid = wxContext.OPENID;
  const {
    targetOpenid,
    couponName,
    couponType = "custom",
    value = "",
    description = "",
    validDays = 180,
    source = "staff_grant",
    sourceRefId = null,
    sourceRefType = null,
    __internal_caller = null,
  } = event;

  if (!targetOpenid) {
    return { ok: false, code: "MISSING_TARGET" };
  }
  if (!couponName) {
    return { ok: false, code: "MISSING_NAME" };
  }
  if (!ALLOWED_TYPES.has(couponType)) {
    return { ok: false, code: "INVALID_TYPE" };
  }
  if (!ALLOWED_SOURCES.has(source)) {
    return { ok: false, code: "INVALID_SOURCE" };
  }

  // 权限：受信云函数互调可绕过 · 否则要 staff/admin
  if (!__internal_caller) {
    if (!callerOpenid) {
      return { ok: false, code: "NO_OPENID" };
    }
    const role = await getRole(callerOpenid);
    if (role !== "staff" && role !== "admin") {
      return { ok: false, code: "PERMISSION_DENIED" };
    }
  }

  await ensureCollection("user_coupons");

  // couponNo 唯一·尝试 5 次
  let couponNo = "";
  for (let i = 0; i < 5; i++) {
    const candidate = `KD-${shortCode(6)}`;
    const exists = await db.collection("user_coupons").where({ couponNo: candidate }).limit(1).get();
    if (exists.data.length === 0) {
      couponNo = candidate;
      break;
    }
  }
  if (!couponNo) {
    return { ok: false, code: "COUPON_NO_GEN_FAIL" };
  }

  const verifyToken = genVerifyToken(targetOpenid, couponNo);
  const now = new Date();
  const validUntil = new Date(now.getTime() + validDays * 86400000);

  const doc = {
    _openid: targetOpenid,
    couponName,
    couponType,
    value,
    description,
    validFrom: now.toISOString(),
    validUntil: validUntil.toISOString(),
    status: "active",
    source,
    sourceRefId,
    sourceRefType,
    couponNo,
    verifyToken,
    usedAt: null,
    usedBy: null,
    usedNote: null,
    createdAt: now.toISOString(),
  };

  const inserted = await db.collection("user_coupons").add({ data: doc });

  return { ok: true, couponId: inserted._id, couponNo, verifyToken };
};
