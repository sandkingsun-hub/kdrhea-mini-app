// grantCoupon · 给用户发一张券
// 三种调用模式：
//   1. issuanceId（员工分配批次发券）：从 allocation 拉模板·扣库存
//   2. __internal_caller（payOrder 礼遇兑换）：直接发·跳过权限/库存校验
//   3. 旧 admin 直接传 couponName 等（兼容老代码·后期废弃）
//
// 入参：
//   { targetOpenid, issuanceId, ... }       员工模式（推荐）
//   { targetOpenid, couponName, couponType, value, description, validDays, source, __internal_caller }  受信模式
// 出参：{ ok, couponId, couponNo, verifyToken }
const crypto = require("node:crypto");
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const ALLOWED_TYPES = new Set(["experience", "discount", "cash", "physical_gift", "custom"]);
const ALLOWED_SOURCES = new Set([
  "gifts_redeem", "staff_grant", "consume_reward", "push", "promotion", "old_customer_activation",
]);

const ALPHA = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function shortCode(n = 6) {
  let s = "";
  for (let i = 0; i < n; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return s;
}

function genVerifyToken(openid, couponNo) {
  return crypto.createHash("sha256")
    .update(`${openid}|${couponNo}|${Date.now()}|${Math.random()}`)
    .digest("hex").slice(0, 16);
}

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

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const callerOpenid = wxContext.OPENID;
  const {
    targetOpenid,
    issuanceId = null,
    __internal_caller = null,
  } = event;

  if (!targetOpenid) return { ok: false, code: "MISSING_TARGET" };

  let couponName = event.couponName;
  let couponType = event.couponType || "custom";
  let value = event.value || "";
  let description = event.description || "";
  let validDays = event.validDays || 180;
  let source = event.source || "staff_grant";
  let sourceRefId = event.sourceRefId || null;
  let sourceRefType = event.sourceRefType || null;
  let allocation = null;

  // 模式 1：员工用 allocation 发券
  if (issuanceId) {
    if (!callerOpenid) return { ok: false, code: "NO_OPENID" };
    const role = await getRole(callerOpenid);
    if (role !== "staff" && role !== "admin") return { ok: false, code: "PERMISSION_DENIED" };

    let allocDoc;
    try {
      const r = await db.collection("coupon_allocations").doc(issuanceId).get();
      allocDoc = r.data;
    } catch {
      return { ok: false, code: "ALLOCATION_NOT_FOUND" };
    }
    if (!allocDoc) return { ok: false, code: "ALLOCATION_NOT_FOUND" };
    if (allocDoc.status !== "active") return { ok: false, code: "ALLOCATION_NOT_ACTIVE" };
    if (allocDoc.allocatedTo !== callerOpenid) return { ok: false, code: "NOT_YOUR_ALLOCATION" };
    if ((allocDoc.usedQuantity || 0) >= allocDoc.quantity) {
      return { ok: false, code: "ALLOCATION_DEPLETED" };
    }

    // 拉模板信息
    let template;
    try {
      const r = await db.collection("coupon_templates").doc(allocDoc.templateId).get();
      template = r.data;
    } catch {
      return { ok: false, code: "TEMPLATE_NOT_FOUND" };
    }

    couponName = template.name;
    couponType = template.type;
    value = template.value;
    description = template.description;
    validDays = template.defaultValidDays;
    source = "staff_grant";
    sourceRefType = "allocation";
    sourceRefId = issuanceId;
    allocation = allocDoc;
  }
  // 模式 2/3：受信调用或旧 admin 直接调
  else if (!__internal_caller) {
    return { ok: false, code: "ISSUANCE_REQUIRED" };
  }

  if (!couponName) return { ok: false, code: "MISSING_NAME" };
  if (!ALLOWED_TYPES.has(couponType)) return { ok: false, code: "INVALID_TYPE" };
  if (!ALLOWED_SOURCES.has(source)) return { ok: false, code: "INVALID_SOURCE" };

  await ensureCollection("user_coupons");

  // couponNo 唯一·尝试 5 次
  let couponNo = "";
  for (let i = 0; i < 5; i++) {
    const candidate = `KD-${shortCode(6)}`;
    const exists = await db.collection("user_coupons").where({ couponNo: candidate }).limit(1).get();
    if (exists.data.length === 0) { couponNo = candidate; break; }
  }
  if (!couponNo) return { ok: false, code: "COUPON_NO_GEN_FAIL" };

  // 如果是 allocation 模式·先 _.inc 占库存（乐观）
  if (allocation) {
    await db.collection("coupon_allocations").doc(issuanceId).update({
      data: { usedQuantity: _.inc(1), updatedAt: new Date().toISOString() },
    });
    // 读回校验·防超卖
    const after = await db.collection("coupon_allocations").doc(issuanceId).get();
    if ((after.data.usedQuantity || 0) > allocation.quantity) {
      // 回滚
      await db.collection("coupon_allocations").doc(issuanceId).update({
        data: { usedQuantity: _.inc(-1) },
      });
      return { ok: false, code: "ALLOCATION_DEPLETED" };
    }
  }

  const verifyToken = genVerifyToken(targetOpenid, couponNo);
  const now = new Date();
  const validUntil = new Date(now.getTime() + validDays * 86400000);

  try {
    const inserted = await db.collection("user_coupons").add({
      data: {
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
        issuanceId: issuanceId || null,
        issuedBy: callerOpenid || null,
        usedAt: null,
        usedBy: null,
        usedNote: null,
        createdAt: now.toISOString(),
      },
    });
    return { ok: true, couponId: inserted._id, couponNo, verifyToken };
  } catch (e) {
    // 回滚库存
    if (allocation) {
      await db.collection("coupon_allocations").doc(issuanceId).update({
        data: { usedQuantity: _.inc(-1) },
      });
    }
    return { ok: false, code: "INSERT_FAILED", error: String(e) };
  }
};
