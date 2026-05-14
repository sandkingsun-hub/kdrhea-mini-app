// adminUpsertSku · admin 新增/编辑/删除/上下架 SKU
// 入: { adminToken, action: "create"|"update"|"delete"|"toggle_status", sku?, skuId? }
// 出: { ok, skuId?, sku?, status? }
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
const ALLOWED_STATUS = new Set(["on_shelf", "off_shelf"]);

function normalizeSku(input = {}) {
  const sku = {};
  if (typeof input.name === "string") sku.name = input.name.trim();
  if (typeof input.category === "string") sku.category = input.category.trim();
  if (typeof input.type === "string" && ALLOWED_TYPES.has(input.type)) sku.type = input.type;
  if (input.priceFen !== undefined) {
    const n = Number(input.priceFen);
    if (Number.isFinite(n)) sku.priceFen = Math.max(0, Math.floor(n));
  }
  if (input.pointsRequired !== undefined) {
    const n = Number(input.pointsRequired);
    if (Number.isFinite(n)) sku.pointsRequired = Math.max(0, Math.floor(n));
  }
  if (typeof input.pointsOnly === "boolean") sku.pointsOnly = input.pointsOnly;
  if (input.pointsDeductibleMaxRatio !== undefined) {
    const n = Number(input.pointsDeductibleMaxRatio);
    if (Number.isFinite(n) && n >= 0 && n <= 1) sku.pointsDeductibleMaxRatio = n;
  }
  if (typeof input.cover === "string") sku.cover = input.cover.trim();
  if (typeof input.description === "string") sku.description = input.description;
  if (input.stock !== undefined) {
    const n = Number(input.stock);
    if (Number.isFinite(n)) sku.stock = Math.floor(n);
  }
  if (typeof input.status === "string" && ALLOWED_STATUS.has(input.status)) sku.status = input.status;
  if (input.sortOrder !== undefined) {
    const n = Number(input.sortOrder);
    if (Number.isFinite(n)) sku.sortOrder = Math.floor(n);
  }
  if (Array.isArray(input.tags)) {
    sku.tags = input.tags
      .filter(t => typeof t === "string" && t.trim())
      .map(t => t.trim())
      .slice(0, 20);
  }
  return sku;
}

exports.main = async (event = {}) => {
  const { adminToken, action, sku = {}, skuId } = event;
  if (!verifyAdminToken(adminToken)) return { ok: false, code: "UNAUTHORIZED" };
  const now = new Date().toISOString();

  if (action === "create") {
    const n = normalizeSku(sku);
    if (!n.name || !n.type) return { ok: false, code: "MISSING_REQUIRED", message: "name + type 必填" };
    if (n.status === undefined) n.status = "on_shelf";
    if (n.pointsRequired === undefined) n.pointsRequired = 0;
    if (n.priceFen === undefined) n.priceFen = 0;
    if (n.pointsOnly === undefined) n.pointsOnly = n.pointsRequired > 0 && n.priceFen === 0;
    if (n.stock === undefined) n.stock = -1;
    if (n.pointsDeductibleMaxRatio === undefined) n.pointsDeductibleMaxRatio = 0.7;
    if (n.sortOrder === undefined) n.sortOrder = 0;
    if (n.tags === undefined) n.tags = [];

    const r = await db.collection("sku").add({
      data: { ...n, createdAt: now, updatedAt: now },
    });
    return { ok: true, skuId: r._id, sku: { _id: r._id, ...n } };
  }

  if (action === "update") {
    if (!skuId) return { ok: false, code: "MISSING_SKU_ID" };
    const n = normalizeSku(sku);
    if (Object.keys(n).length === 0) return { ok: false, code: "EMPTY_UPDATE" };
    await db.collection("sku").doc(skuId).update({ data: { ...n, updatedAt: now } });
    return { ok: true };
  }

  if (action === "delete") {
    if (!skuId) return { ok: false, code: "MISSING_SKU_ID" };
    await db.collection("sku").doc(skuId).remove();
    return { ok: true };
  }

  if (action === "toggle_status") {
    if (!skuId) return { ok: false, code: "MISSING_SKU_ID" };
    const cur = await db.collection("sku").doc(skuId).get();
    const next = cur.data.status === "on_shelf" ? "off_shelf" : "on_shelf";
    await db.collection("sku").doc(skuId).update({ data: { status: next, updatedAt: now } });
    return { ok: true, status: next };
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
