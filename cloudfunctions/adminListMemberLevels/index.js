// adminListMemberLevels · admin 看会员等级配置
// 入: { adminToken }
// 出: { ok, items }
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

const DEFAULT_LEVELS = [
  { level: 0, name: "VISITOR", thresholdFen: 0, pointsMultiplier: 1.0, birthdayCouponFen: 0 },
  { level: 1, name: "INITIAL", thresholdFen: 68000, pointsMultiplier: 1.0, birthdayCouponFen: 10000 },
  { level: 2, name: "PRIME", thresholdFen: 1000000, pointsMultiplier: 1.1, birthdayCouponFen: 30000 },
  { level: 3, name: "APEX", thresholdFen: 3000000, pointsMultiplier: 1.2, birthdayCouponFen: 80000 },
  { level: 4, name: "SOVEREIGN", thresholdFen: 5000000, pointsMultiplier: 1.25, birthdayCouponFen: 150000 },
  { level: 5, name: "ETERNAL", thresholdFen: 7000000, pointsMultiplier: 1.3, birthdayCouponFen: 200000 },
];

exports.main = async (event = {}) => {
  if (!verifyAdminToken(event.adminToken)) return { ok: false, code: "UNAUTHORIZED" };

  let items = [];
  try {
    const r = await db.collection("member_level_config").orderBy("level", "asc").get();
    items = r.data;
  } catch (e) {
    if (!String(e).includes("not exist")) throw e;
  }

  // 如果集合不存在或为空 · 返回默认配置（admin 端可以保存即填充）
  if (items.length === 0) items = DEFAULT_LEVELS.map(l => ({ ...l, _id: `level_${l.level}` }));

  return { ok: true, items };
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
