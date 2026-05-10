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
