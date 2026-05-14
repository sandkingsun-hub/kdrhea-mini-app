// adminBatchUpdateSku · 批量操作 SKU
// 入: { adminToken, action: "set_status"|"delete"|"set_category", skuIds: string[], status?, category? }
// 出: { ok, updated, failed: [{skuId, error}] }
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

const ALLOWED_STATUS = new Set(["on_shelf", "off_shelf"]);

exports.main = async (event = {}) => {
  const { adminToken, action, skuIds, status, category } = event;
  if (!verifyAdminToken(adminToken)) return { ok: false, code: "UNAUTHORIZED" };
  if (!Array.isArray(skuIds) || skuIds.length === 0) return { ok: false, code: "EMPTY_IDS" };
  if (skuIds.length > 200) return { ok: false, code: "TOO_MANY", message: "单次最多 200 个" };

  const now = new Date().toISOString();
  let updated = 0;
  const failed = [];

  if (action === "set_status") {
    if (!ALLOWED_STATUS.has(status)) return { ok: false, code: "INVALID_STATUS" };
    for (const id of skuIds) {
      try {
        await db.collection("sku").doc(id).update({ data: { status, updatedAt: now } });
        updated++;
      } catch (e) {
        failed.push({ skuId: id, error: String(e.errMsg || e.message || e) });
      }
    }
    return { ok: true, updated, failed };
  }

  if (action === "delete") {
    for (const id of skuIds) {
      try {
        await db.collection("sku").doc(id).remove();
        updated++;
      } catch (e) {
        failed.push({ skuId: id, error: String(e.errMsg || e.message || e) });
      }
    }
    return { ok: true, updated, failed };
  }

  if (action === "set_category") {
    if (typeof category !== "string" || !category.trim()) return { ok: false, code: "MISSING_CATEGORY" };
    const cat = category.trim();
    for (const id of skuIds) {
      try {
        await db.collection("sku").doc(id).update({ data: { category: cat, updatedAt: now } });
        updated++;
      } catch (e) {
        failed.push({ skuId: id, error: String(e.errMsg || e.message || e) });
      }
    }
    return { ok: true, updated, failed };
  }

  return { ok: false, code: "INVALID_ACTION" };
};
// 复制这段代码追加到云函数 index.js 末尾即可
// 幂等：重复 append 不会出问题（用 __corsWrapped 标记防双层）
//
// 批量 append 命令：
//   for fn in funcA funcB funcC; do
//     grep -q "__corsWrapped" cloudfunctions/$fn/index.js || \
//       cat ~/.claude/skills/wechat-miniprogram-dev/references/cors_wrapper.js >> cloudfunctions/$fn/index.js
//   done

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
