// adminBatchImportSku · admin 批量插入 SKU
// 入: { adminToken, items: [{name, type, category?, priceFen?, pointsRequired?, ...}], skipExisting?: true }
// 出: { ok, created: [{row, name, skuId}], failed: [{row, name, error}], skipped: [{row, name}] }
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

const ALLOWED_TYPES = new Set(["service", "experience_voucher", "physical_gift", "package", "other"]);

exports.main = async (event = {}) => {
  const { adminToken, items, skipExisting = false } = event;
  if (!verifyAdminToken(adminToken)) return { ok: false, code: "UNAUTHORIZED" };
  if (!Array.isArray(items) || items.length === 0) return { ok: false, code: "EMPTY_ITEMS" };
  if (items.length > 500) return { ok: false, code: "TOO_MANY", message: "单次最多 500 条" };

  const now = new Date().toISOString();
  const result = { ok: true, created: [], failed: [], skipped: [] };

  for (let i = 0; i < items.length; i++) {
    const raw = items[i] || {};
    const row = i + 1;
    try {
      if (!raw.name || typeof raw.name !== "string") {
        result.failed.push({ row, name: raw.name, error: "name 必填" });
        continue;
      }
      if (!raw.type || !ALLOWED_TYPES.has(raw.type)) {
        result.failed.push({ row, name: raw.name, error: `type 必填且在 [${[...ALLOWED_TYPES].join(",")}] 内` });
        continue;
      }

      if (skipExisting) {
        const exist = await db.collection("sku").where({ name: raw.name.trim() }).count();
        if (exist.total > 0) {
          result.skipped.push({ row, name: raw.name });
          continue;
        }
      }

      const priceFen = Number.isFinite(Number(raw.priceFen)) ? Math.max(0, Math.floor(Number(raw.priceFen))) : 0;
      const pointsRequired = Number.isFinite(Number(raw.pointsRequired)) ? Math.max(0, Math.floor(Number(raw.pointsRequired))) : 0;

      const sku = {
        name: String(raw.name).trim(),
        type: raw.type,
        category: String(raw.category || "").trim(),
        priceFen,
        pointsRequired,
        pointsOnly: typeof raw.pointsOnly === "boolean" ? raw.pointsOnly : (priceFen === 0 && pointsRequired > 0),
        pointsDeductibleMaxRatio: Number.isFinite(Number(raw.pointsDeductibleMaxRatio)) ? Number(raw.pointsDeductibleMaxRatio) : 0.7,
        cover: String(raw.cover || "").trim(),
        description: String(raw.description || ""),
        stock: Number.isFinite(Number(raw.stock)) ? Math.floor(Number(raw.stock)) : -1,
        status: raw.status === "off_shelf" ? "off_shelf" : "on_shelf",
        createdAt: now,
        updatedAt: now,
      };

      const r = await db.collection("sku").add({ data: sku });
      result.created.push({ row, name: raw.name, skuId: r._id });
    } catch (e) {
      result.failed.push({ row, name: raw.name, error: String(e.errMsg || e.message || e) });
    }
  }

  return result;
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
