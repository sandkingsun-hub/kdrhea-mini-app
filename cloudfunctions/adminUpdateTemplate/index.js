// adminUpdateTemplate · 更新券模板（含上下架）
// 入：{ adminToken, templateId, name?, type?, value?, description?, defaultValidDays?, visibleToStaff?, status? }
// 出：{ ok }
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

const ALLOWED_TYPES = new Set(["experience", "discount", "cash", "physical_gift", "custom"]);
const ALLOWED_STATUS = new Set(["active", "archived"]);

exports.main = async (event = {}) => {
  const { adminToken, templateId, name, type, value, description, defaultValidDays, visibleToStaff, status } = event;
  const admin = verifyAdminToken(adminToken);
  if (!admin) return { ok: false, code: "UNAUTHORIZED" };
  if (!templateId) return { ok: false, code: "MISSING_ID" };

  const data = { updatedAt: new Date().toISOString() };
  if (name !== undefined) {
    if (typeof name !== "string" || name.length < 2 || name.length > 30) return { ok: false, code: "INVALID_NAME" };
    data.name = name;
  }
  if (type !== undefined) {
    if (!ALLOWED_TYPES.has(type)) return { ok: false, code: "INVALID_TYPE" };
    data.type = type;
  }
  if (value !== undefined) data.value = String(value);
  if (description !== undefined) data.description = String(description);
  if (defaultValidDays !== undefined) {
    if (typeof defaultValidDays !== "number" || defaultValidDays < 1 || defaultValidDays > 730) {
      return { ok: false, code: "INVALID_VALID_DAYS" };
    }
    data.defaultValidDays = defaultValidDays;
  }
  if (visibleToStaff !== undefined) data.visibleToStaff = !!visibleToStaff;
  if (status !== undefined) {
    if (!ALLOWED_STATUS.has(status)) return { ok: false, code: "INVALID_STATUS" };
    data.status = status;
  }

  await db.collection("coupon_templates").doc(templateId).update({ data });
  return { ok: true };
};

// === CORS wrapper for HTTP access service (auto-added, idempotent) ===
if (exports.main && !exports.main.__corsWrapped) {
  const _origMain = exports.main;
  const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
  exports.main = async (event = {}, context) => {
    if (event && event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: CORS_HEADERS, body: "" };
    }
    if (event && typeof event.body === "string") {
      try { event = { ...event, ...JSON.parse(event.body) }; } catch {}
    }
    const result = await _origMain(event, context);
    if (result && typeof result === "object" && "statusCode" in result) {
      return { ...result, headers: { ...CORS_HEADERS, ...(result.headers || {}) } };
    }
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  };
  exports.main.__corsWrapped = true;
}
