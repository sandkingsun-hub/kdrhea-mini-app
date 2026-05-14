// adminListMedicines · admin 列 medicines 主表
// 入: { adminToken, status? (complete/pending), search?, limit?, skip? }
// 出: { ok, items, total }
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
  const { adminToken, status, search, limit = 50, skip = 0 } = event;
  if (!verifyAdminToken(adminToken)) return { ok: false, code: "UNAUTHORIZED" };

  const where = {};
  if (status) where.status = status;
  if (search && typeof search === "string" && search.trim()) {
    const s = search.trim();
    // 同时搜 name / _id (GTIN) / registerNo
    where._search = db.command.or([
      { name: new db.RegExp({ regexp: s, options: "i" }) },
      { _id: new db.RegExp({ regexp: s, options: "i" }) },
      { registerNo: new db.RegExp({ regexp: s, options: "i" }) },
    ]);
    // CloudBase NoSQL 不支持 OR · 简化只搜 name
    delete where._search;
    where.name = new db.RegExp({ regexp: s, options: "i" });
  }

  const cap = Math.min(Number(limit) || 50, 200);
  const sk = Math.max(Number(skip) || 0, 0);

  let list = [];
  let total = 0;
  try {
    const [a, b] = await Promise.all([
      db.collection("medicines").where(where).orderBy("updatedAt", "desc").skip(sk).limit(cap).get(),
      db.collection("medicines").where(where).count(),
    ]);
    list = a.data;
    total = b.total;
  } catch (e) {
    if (String(e).includes("not exist")) {
      return { ok: true, items: [], total: 0 };
    }
    throw e;
  }

  return { ok: true, items: list, total };
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
