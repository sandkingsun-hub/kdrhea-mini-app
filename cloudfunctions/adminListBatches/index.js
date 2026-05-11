// adminListBatches · 看历史批量发券记录
// 入：{ adminToken, limit?: 50 }
// 出：{ ok, items, total }
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
  const { adminToken, limit = 50 } = event;
  const admin = verifyAdminToken(adminToken);
  if (!admin) return { ok: false, code: "UNAUTHORIZED" };

  await ensureCollection("coupon_batches");

  const cap = Math.min(limit, 200);
  const [list, count] = await Promise.all([
    db.collection("coupon_batches").orderBy("createdAt", "desc").limit(cap).get(),
    db.collection("coupon_batches").count(),
  ]);
  return { ok: true, items: list.data, total: count.total };
};
