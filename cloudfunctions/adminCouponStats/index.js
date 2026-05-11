// adminCouponStats · 看板统计
// 入：{ adminToken }
// 出：{ ok, summary, byTemplate[], byStaff[], expiringSoon[] }
const crypto = require("node:crypto");
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;
const $ = db.command.aggregate;

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
  const { adminToken } = event;
  const admin = verifyAdminToken(adminToken);
  if (!admin) return { ok: false, code: "UNAUTHORIZED" };

  await ensureCollection("user_coupons");

  const now = new Date().toISOString();
  const in14d = new Date(Date.now() + 14 * 86400000).toISOString();

  // === Summary ===
  const [activeCnt, usedCnt, expiredCnt, totalCnt, userCnt, templateCnt, expiringSoon] = await Promise.all([
    db.collection("user_coupons").where({ status: "active" }).count(),
    db.collection("user_coupons").where({ status: "used" }).count(),
    db.collection("user_coupons").where({ status: "expired" }).count(),
    db.collection("user_coupons").count(),
    db.collection("users").count(),
    db.collection("coupon_templates").where({ status: "active" }).count(),
    db.collection("user_coupons").where({
      status: "active",
      validUntil: _.lte(in14d),
    }).count(),
  ]);

  const summary = {
    active: activeCnt.total,
    used: usedCnt.total,
    expired: expiredCnt.total,
    total: totalCnt.total,
    redeemRate: totalCnt.total > 0 ? Math.round((usedCnt.total / totalCnt.total) * 100) : 0,
    users: userCnt.total,
    activeTemplates: templateCnt.total,
    expiringSoon14d: expiringSoon.total,
  };

  // === byTemplate · 按券名分组（最近 90 天）===
  const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();
  let byTemplate = [];
  try {
    const aggR = await db.collection("user_coupons").aggregate()
      .match({ createdAt: _.gte(cutoff) })
      .group({
        _id: "$couponName",
        granted: $.sum(1),
        used: $.sum($.cond({ if: $.eq(["$status", "used"]), then: 1, else: 0 })),
      })
      .sort({ granted: -1 })
      .limit(10)
      .end();
    byTemplate = (aggR.list || []).map(r => ({
      name: r._id || "(未命名)",
      granted: r.granted,
      used: r.used,
      redeemRate: r.granted > 0 ? Math.round((r.used / r.granted) * 100) : 0,
    }));
  } catch {}

  // === byStaff · 按发券员工分组 ===
  let byStaff = [];
  try {
    const aggR = await db.collection("user_coupons").aggregate()
      .match({ issuedBy: _.exists(true).neq(null) })
      .group({
        _id: "$issuedBy",
        granted: $.sum(1),
        used: $.sum($.cond({ if: $.eq(["$status", "used"]), then: 1, else: 0 })),
      })
      .sort({ granted: -1 })
      .limit(20)
      .end();

    // 反查员工昵称/手机号
    const staffOpenids = (aggR.list || []).map(r => r._id).filter(Boolean);
    const staffMap = {};
    if (staffOpenids.length > 0) {
      const usrs = await db.collection("users").where({ _openid: _.in(staffOpenids) }).get();
      for (const u of usrs.data) {
        staffMap[u._openid] = { nickname: u.nickname, phone: u.phone };
      }
    }
    byStaff = (aggR.list || []).map(r => ({
      openid: r._id,
      nickname: staffMap[r._id]?.nickname || null,
      phone: staffMap[r._id]?.phone || null,
      granted: r.granted,
      used: r.used,
    }));
  } catch {}

  // === expiringSoon · 即将过期券明细（前 10 张）===
  let expiringList = [];
  try {
    const r = await db.collection("user_coupons").where({
      status: "active",
      validUntil: _.lte(in14d),
    }).orderBy("validUntil", "asc").limit(10).get();
    expiringList = r.data.map(c => ({
      _id: c._id,
      couponName: c.couponName,
      couponNo: c.couponNo,
      validUntil: c.validUntil,
    }));
  } catch {}

  return {
    ok: true,
    summary,
    byTemplate,
    byStaff,
    expiringSoon: expiringList,
    generatedAt: now,
  };
};
