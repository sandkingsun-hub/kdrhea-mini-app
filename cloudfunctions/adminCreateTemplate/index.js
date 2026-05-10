// adminCreateTemplate · 新建券模板
// 入：{ adminToken, name, type, value, description?, defaultValidDays, visibleToStaff }
// 出：{ ok, templateId, templateNo }
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

const ALPHA = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function shortCode(n = 4) {
  let s = "";
  for (let i = 0; i < n; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return s;
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
  const { adminToken, name, type, value = "", description = "", defaultValidDays = 180, visibleToStaff = true } = event;
  const admin = verifyAdminToken(adminToken);
  if (!admin) return { ok: false, code: "UNAUTHORIZED" };

  if (!name || name.length < 2 || name.length > 30) return { ok: false, code: "INVALID_NAME" };
  if (!ALLOWED_TYPES.has(type)) return { ok: false, code: "INVALID_TYPE" };
  if (typeof defaultValidDays !== "number" || defaultValidDays < 1 || defaultValidDays > 730) {
    return { ok: false, code: "INVALID_VALID_DAYS" };
  }

  await ensureCollection("coupon_templates");

  // templateNo 唯一·尝试 5 次
  let templateNo = "";
  for (let i = 0; i < 5; i++) {
    const c = `KDT-${shortCode(4)}`;
    const e = await db.collection("coupon_templates").where({ templateNo: c }).limit(1).get();
    if (e.data.length === 0) { templateNo = c; break; }
  }
  if (!templateNo) return { ok: false, code: "TEMPLATE_NO_GEN_FAIL" };

  const now = new Date().toISOString();
  const inserted = await db.collection("coupon_templates").add({
    data: {
      templateNo,
      name,
      type,
      value,
      description,
      defaultValidDays,
      visibleToStaff: !!visibleToStaff,
      status: "active",
      createdBy: admin.phone,
      createdAt: now,
      updatedAt: now,
    },
  });

  return { ok: true, templateId: inserted._id, templateNo };
};
