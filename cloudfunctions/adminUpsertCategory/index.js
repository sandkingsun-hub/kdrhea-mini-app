// adminUpsertCategory · admin 增/删/重命名/调整排序 SKU 分类
// 入: { adminToken, action: "create"|"update"|"delete", category?, categoryId? }
//   - action=create:  { name, sortOrder? }
//   - action=update:  categoryId + { name?, sortOrder? }
//   - action=delete:  categoryId · 删除前检查是否有 SKU 在用
// 出: { ok, categoryId?, code?, skuCount? }
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

function slugify(name) {
  return "cat_" + Buffer.from(name).toString("base64").replace(/[+/=]/g, "").slice(0, 20).toLowerCase();
}

exports.main = async (event = {}) => {
  const { adminToken, action, category = {}, categoryId } = event;
  if (!verifyAdminToken(adminToken)) return { ok: false, code: "UNAUTHORIZED" };
  await ensureCollection("sku_category");
  const now = new Date().toISOString();

  if (action === "create") {
    const name = typeof category.name === "string" ? category.name.trim() : "";
    if (!name) return { ok: false, code: "MISSING_NAME" };
    // 同名拒绝
    const dup = await db.collection("sku_category").where({ name }).limit(1).get();
    if (dup.data.length > 0) return { ok: false, code: "DUPLICATE_NAME" };
    const _id = category._id || slugify(name + Date.now());
    const doc = {
      _id,
      name,
      sortOrder: Number.isFinite(Number(category.sortOrder)) ? Math.floor(Number(category.sortOrder)) : 0,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection("sku_category").add({ data: doc });
    return { ok: true, categoryId: _id, category: doc };
  }

  if (action === "update") {
    if (!categoryId) return { ok: false, code: "MISSING_CATEGORY_ID" };
    const patch = {};
    let oldName = null;
    if (typeof category.name === "string" && category.name.trim()) {
      // 拿旧名 · 重命名时同步 SKU 表
      const cur = await db.collection("sku_category").doc(categoryId).get();
      oldName = cur.data.name;
      patch.name = category.name.trim();
    }
    if (category.sortOrder !== undefined) {
      const n = Number(category.sortOrder);
      if (Number.isFinite(n)) patch.sortOrder = Math.floor(n);
    }
    if (Object.keys(patch).length === 0) return { ok: false, code: "EMPTY_UPDATE" };
    await db.collection("sku_category").doc(categoryId).update({ data: { ...patch, updatedAt: now } });

    // 重命名时同步所有 sku.category（重要 · 否则 sku 失效）
    if (oldName && patch.name && oldName !== patch.name) {
      try {
        const skus = await db.collection("sku").where({ category: oldName }).limit(500).get();
        for (const s of skus.data) {
          await db.collection("sku").doc(s._id).update({
            data: { category: patch.name, updatedAt: now },
          });
        }
      } catch (e) {
        return { ok: true, code: "RENAMED_BUT_SKU_SYNC_FAILED", message: String(e) };
      }
    }
    return { ok: true };
  }

  if (action === "delete") {
    if (!categoryId) return { ok: false, code: "MISSING_CATEGORY_ID" };
    const cur = await db.collection("sku_category").doc(categoryId).get();
    const name = cur.data.name;
    // 拒绝删除还有 SKU 在用的分类
    const usedBy = await db.collection("sku").where({ category: name }).count();
    if (usedBy.total > 0) {
      return { ok: false, code: "CATEGORY_IN_USE", skuCount: usedBy.total, message: `还有 ${usedBy.total} 个 SKU 在用此分类 · 先转移` };
    }
    await db.collection("sku_category").doc(categoryId).remove();
    return { ok: true };
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
