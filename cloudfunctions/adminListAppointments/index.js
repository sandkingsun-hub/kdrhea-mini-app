// adminListAppointments · admin 看所有预约
// 入: { adminToken, status?, search?, dateFrom?, dateTo?, limit?: 50, skip?: 0 }
// 出: { ok, items, total }
const crypto = require("node:crypto");
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

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

function maskPhone(p) {
  if (!p || typeof p !== "string") return p;
  if (p.length < 7) return p;
  return p.slice(0, 3) + "****" + p.slice(-4);
}

exports.main = async (event = {}) => {
  const { adminToken, status, search, dateFrom, dateTo, limit = 50, skip = 0 } = event;
  if (!verifyAdminToken(adminToken)) return { ok: false, code: "UNAUTHORIZED" };

  const where = {};
  if (status === "all") {
    // 不加 status 过滤
  } else if (status) {
    where.status = status;
  }

  // 时间过滤 · 用 createdAt
  if (dateFrom || dateTo) {
    const cond = {};
    if (dateFrom) cond[">="] = dateFrom; // ISO string
    if (dateTo) cond["<="] = dateTo;
    // CloudBase: 用 _.gte / _.lte
    const filters = [];
    if (dateFrom) filters.push(_.gte(dateFrom));
    if (dateTo) filters.push(_.lte(dateTo));
    where.createdAt = filters.length === 1 ? filters[0] : _.and(filters);
  }

  // 搜索 · 客户名 / 手机号 / 服务项 · CloudBase NoSQL 不支持 OR · 简化用 customerName
  if (search && typeof search === "string" && search.trim()) {
    const s = search.trim();
    // 优先按手机号搜
    if (/^\d+$/.test(s)) {
      where.customerPhone = new db.RegExp({ regexp: s, options: "" });
    } else {
      where.customerName = new db.RegExp({ regexp: s, options: "i" });
    }
  }

  const cap = Math.min(Number(limit) || 50, 200);
  const sk = Math.max(Number(skip) || 0, 0);

  let list = [];
  let total = 0;
  try {
    const [a, b] = await Promise.all([
      db.collection("appointments").where(where).orderBy("createdAt", "desc").skip(sk).limit(cap).get(),
      db.collection("appointments").where(where).count(),
    ]);
    list = a.data;
    total = b.total;
  } catch (e) {
    if (String(e).includes("not exist")) return { ok: true, items: [], total: 0 };
    throw e;
  }

  // 富化 · 拉 users.nickname (顾客可能改名后 appointment 里 customerName 是旧的)
  const openids = Array.from(new Set(list.map(a => a._openid).filter(Boolean)));
  const userMap = new Map();
  if (openids.length > 0) {
    try {
      const r = await db.collection("users").where({ _openid: _.in(openids) }).limit(200).get();
      for (const u of r.data) userMap.set(u._openid, u);
    } catch {}
  }

  const items = list.map(a => {
    const u = userMap.get(a._openid) || {};
    return {
      ...a,
      customerPhoneMasked: maskPhone(a.customerPhone),
      currentNickname: u.nickname || null,
      currentPhone: maskPhone(u.phone),
    };
  });

  return { ok: true, items, total };
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
