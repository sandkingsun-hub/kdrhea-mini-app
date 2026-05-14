// adminUpsertCharityOrg · admin 后台新增/编辑救助机构（内部对账用）
// 入: { adminToken, action: "create"|"update"|"delete", org: {...} | orgId }
// 出: { ok, org? } | { ok }
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
    if (String(e).includes("not exist")) try { await db.createCollection(name); } catch {}
  }
}

exports.main = async (event = {}) => {
  const { adminToken, action, org = {}, orgId } = event;
  if (!verifyAdminToken(adminToken)) return { ok: false, code: "UNAUTHORIZED" };

  await ensureCollection("charity_orgs");
  const now = new Date().toISOString();

  if (action === "create") {
    if (!org.name) return { ok: false, code: "MISSING_NAME" };
    const doc = {
      _id: org._id || `org_${Date.now()}`,
      name: String(org.name),
      description: org.description || "",
      contact: org.contact || null,
      status: org.status || "active",
      createdAt: now,
      updatedAt: now,
    };
    await db.collection("charity_orgs").add({ data: doc });
    return { ok: true, org: doc };
  }
  if (action === "update") {
    if (!orgId) return { ok: false, code: "MISSING_ORG_ID" };
    const { _id, createdAt, ...rest } = org;
    await db.collection("charity_orgs").doc(orgId).update({ data: { ...rest, updatedAt: now } });
    return { ok: true };
  }
  if (action === "delete") {
    if (!orgId) return { ok: false, code: "MISSING_ORG_ID" };
    await db.collection("charity_orgs").doc(orgId).remove();
    return { ok: true };
  }
  return { ok: false, code: "INVALID_ACTION" };
};
