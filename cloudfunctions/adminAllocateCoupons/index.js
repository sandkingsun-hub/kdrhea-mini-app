// adminAllocateCoupons · admin 把模板 + 数量分配给某员工
// 入：{ adminToken, templateId, allocatedTo (openid), quantity }
// 出：{ ok, allocationId }
const crypto = require("node:crypto");
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const SECRET = process.env.ADMIN_AUTH_SECRET || "kd-admin-dev-secret-change-me";

function hmac(p) { return crypto.createHmac("sha256", SECRET).update(p).digest("hex").slice(0, 32); }
function b64urlDecode(s) { return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"); }
function verifyAdminToken(token) {
  if (!token || typeof token !== "string") return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig || hmac(encoded) !== sig) return null;
  try {
    const payload = JSON.parse(b64urlDecode(encoded));
    if (!payload || typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (payload.role !== "admin") return null;
    return payload;
  } catch { return null; }
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
  const { adminToken, templateId, allocatedTo, quantity } = event;
  const admin = verifyAdminToken(adminToken);
  if (!admin) return { ok: false, code: "UNAUTHORIZED" };

  if (!templateId) return { ok: false, code: "MISSING_TEMPLATE" };
  if (!allocatedTo) return { ok: false, code: "MISSING_TARGET" };
  if (typeof quantity !== "number" || quantity < 1 || quantity > 10000) {
    return { ok: false, code: "INVALID_QUANTITY" };
  }

  // 拉模板信息（冗余存）
  let template;
  try {
    const r = await db.collection("coupon_templates").doc(templateId).get();
    template = r.data;
  } catch {
    return { ok: false, code: "TEMPLATE_NOT_FOUND" };
  }
  if (template.status !== "active") return { ok: false, code: "TEMPLATE_NOT_ACTIVE" };

  // 校验目标员工
  const userQ = await db.collection("users").where({ _openid: allocatedTo }).limit(1).get();
  if (userQ.data.length === 0) return { ok: false, code: "STAFF_NOT_FOUND" };
  const targetUser = userQ.data[0];
  if (targetUser.role !== "staff" && targetUser.role !== "admin") {
    return { ok: false, code: "TARGET_NOT_STAFF" };
  }

  await ensureCollection("coupon_allocations");

  const now = new Date().toISOString();
  const inserted = await db.collection("coupon_allocations").add({
    data: {
      templateId,
      templateNo: template.templateNo,
      templateName: template.name,
      allocatedTo,
      allocatedToPhone: targetUser.phone || null,
      allocatedToName: targetUser.nickname || null,
      quantity,
      usedQuantity: 0,
      status: "active",
      createdBy: admin.phone,
      createdAt: now,
      updatedAt: now,
    },
  });

  return { ok: true, allocationId: inserted._id };
};
