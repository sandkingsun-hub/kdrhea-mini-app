// adminUpsertMemberLevel · admin 改某一级等级配置
// 入: { adminToken, level, name?, thresholdFen?, pointsMultiplier?, birthdayCouponFen? }
// 出: { ok, level: {...} }
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
  if (!verifyAdminToken(event.adminToken)) return { ok: false, code: "UNAUTHORIZED" };
  const { level, name, thresholdFen, pointsMultiplier, birthdayCouponFen } = event;

  if (!Number.isInteger(level) || level < 0 || level > 9) {
    return { ok: false, code: "INVALID_LEVEL" };
  }

  await ensureCollection("member_level_config");

  const now = new Date().toISOString();
  const _id = `level_${level}`;
  const updateData = { level, updatedAt: now };
  if (typeof name === "string" && name.trim()) updateData.name = name.trim().toUpperCase().slice(0, 20);
  if (Number.isInteger(thresholdFen) && thresholdFen >= 0) updateData.thresholdFen = thresholdFen;
  if (typeof pointsMultiplier === "number" && pointsMultiplier >= 1.0 && pointsMultiplier <= 5.0) {
    updateData.pointsMultiplier = Math.round(pointsMultiplier * 100) / 100;
  }
  if (Number.isInteger(birthdayCouponFen) && birthdayCouponFen >= 0) updateData.birthdayCouponFen = birthdayCouponFen;

  // upsert by _id (level_X)
  try {
    const exist = await db.collection("member_level_config").doc(_id).get();
    if (exist.data) {
      await db.collection("member_level_config").doc(_id).update({ data: updateData });
    } else {
      await db.collection("member_level_config").add({ data: { _id, ...updateData, createdAt: now } });
    }
  } catch (e) {
    if (String(e).includes("does not exist") || String(e).includes("not found")) {
      await db.collection("member_level_config").add({ data: { _id, ...updateData, createdAt: now } });
    } else {
      throw e;
    }
  }

  return { ok: true, level: { _id, ...updateData } };
};

// === CORS wrapper ===
if (exports.main && !exports.main.__corsWrapped) {
  const _origMain = exports.main;
  const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
  exports.main = async (event = {}, context) => {
    if (event && event.httpMethod === "OPTIONS") return { statusCode: 200, headers: CORS_HEADERS, body: "" };
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
