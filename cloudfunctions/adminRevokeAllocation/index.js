// adminRevokeAllocation · 收回分配（status=revoked·已发出去的不动）
// 入：{ adminToken, allocationId }
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

exports.main = async (event = {}) => {
  const { adminToken, allocationId } = event;
  const admin = verifyAdminToken(adminToken);
  if (!admin) return { ok: false, code: "UNAUTHORIZED" };
  if (!allocationId) return { ok: false, code: "MISSING_ID" };

  await db.collection("coupon_allocations").doc(allocationId).update({
    data: {
      status: "revoked",
      updatedAt: new Date().toISOString(),
      revokedBy: admin.phone,
    },
  });
  return { ok: true };
};
