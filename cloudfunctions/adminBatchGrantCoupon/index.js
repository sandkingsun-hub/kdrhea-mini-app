// adminBatchGrantCoupon · 批量发券（admin 直发·不走员工 allocation）
// 入：{ adminToken, templateId, audienceType, customPhones?, batchName?, dryRun? }
//   audienceType:
//     'all'           所有客户
//     'old_customer'  老客（activatedFromOldCustomer=true）
//     'recent_30d'    近 30 天注册新客
//     'custom'        手动手机号列表（customPhones: string[]）
// 出：{ ok, batchId, targetCount, successCount, failedCount, failed[] }
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

function sha256(s) { return crypto.createHash("sha256").update(s).digest("hex"); }

async function ensureCollection(name) {
  try { await db.collection(name).count(); }
  catch (e) {
    if (String(e).includes("not exist")) {
      try { await db.createCollection(name); } catch {}
    }
  }
}

async function buildAudience(audienceType, customPhones) {
  // 返回：{ openids: string[], reasons: { skipped: number, notRegistered: string[] } }
  const reasons = { skipped: 0, notRegistered: [] };

  if (audienceType === "custom") {
    if (!Array.isArray(customPhones) || customPhones.length === 0) {
      return { openids: [], reasons };
    }
    const openids = [];
    for (const phone of customPhones) {
      if (!/^1\d{10}$/.test(phone)) {
        reasons.notRegistered.push(`${phone} (格式错)`);
        continue;
      }
      const phoneHash = sha256(phone);
      let q = await db.collection("users").where({ phoneHash }).limit(1).get();
      if (q.data.length === 0) {
        q = await db.collection("users").where({ phone }).limit(1).get();
      }
      if (q.data.length === 0) {
        reasons.notRegistered.push(phone);
        continue;
      }
      openids.push(q.data[0]._openid);
    }
    return { openids, reasons };
  }

  const where = {};
  if (audienceType === "old_customer") {
    where.activatedFromOldCustomer = true;
  } else if (audienceType === "recent_30d") {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
    where.registeredAt = _.gte(cutoff);
  }
  // audienceType === 'all' 不加条件

  // 拉所有匹配的（云函数最多一次 1000，分页）
  const allOpenids = [];
  let skip = 0;
  const pageSize = 100;
  while (true) {
    const r = await db.collection("users").where(where).skip(skip).limit(pageSize).field({ _openid: true }).get();
    if (r.data.length === 0) break;
    for (const u of r.data) {
      if (u._openid) allOpenids.push(u._openid);
    }
    if (r.data.length < pageSize) break;
    skip += pageSize;
    if (skip > 5000) break; // 安全上限
  }
  return { openids: allOpenids, reasons };
}

exports.main = async (event = {}) => {
  const { adminToken, templateId, audienceType = "all", customPhones, batchName, dryRun = false } = event;
  const admin = verifyAdminToken(adminToken);
  if (!admin) return { ok: false, code: "UNAUTHORIZED" };

  if (!templateId) return { ok: false, code: "MISSING_TEMPLATE" };
  if (!["all", "old_customer", "recent_30d", "custom"].includes(audienceType)) {
    return { ok: false, code: "INVALID_AUDIENCE" };
  }

  // 校验模板
  let template;
  try {
    const r = await db.collection("coupon_templates").doc(templateId).get();
    template = r.data;
  } catch {
    return { ok: false, code: "TEMPLATE_NOT_FOUND" };
  }
  if (template.status !== "active") return { ok: false, code: "TEMPLATE_NOT_ACTIVE" };

  // 拉客群
  const { openids, reasons } = await buildAudience(audienceType, customPhones);

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      targetCount: openids.length,
      audienceType,
      template: { name: template.name, type: template.type, value: template.value },
      reasons,
    };
  }

  await ensureCollection("coupon_batches");

  const now = new Date().toISOString();
  // 先创建批次记录（pending）
  const batchInsert = await db.collection("coupon_batches").add({
    data: {
      name: batchName || `${template.name} · ${audienceType}`,
      templateId,
      templateName: template.name,
      audienceType,
      targetCount: openids.length,
      successCount: 0,
      failedCount: 0,
      failed: [],
      status: "running",
      createdBy: admin.phone,
      createdAt: now,
    },
  });
  const batchId = batchInsert._id;

  // 批量发券·串行（不并发·防 API 限流 + 库存竞争）
  let successCount = 0;
  const failed = [];
  for (const openid of openids) {
    try {
      const r = await cloud.callFunction({
        name: "grantCoupon",
        data: {
          targetOpenid: openid,
          couponName: template.name,
          couponType: template.type,
          value: template.value,
          description: template.description,
          validDays: template.defaultValidDays,
          source: "promotion",
          sourceRefType: "batch",
          sourceRefId: batchId,
          __internal_caller: "adminBatchGrantCoupon",
        },
      });
      if (r.result?.ok) {
        successCount++;
      } else {
        failed.push({ openid, code: r.result?.code || "UNKNOWN" });
      }
    } catch (e) {
      failed.push({ openid, code: "EXCEPTION", error: String(e).slice(0, 80) });
    }
  }

  // 更新批次状态
  await db.collection("coupon_batches").doc(batchId).update({
    data: {
      successCount,
      failedCount: failed.length,
      failed: failed.slice(0, 100), // 最多记 100 条失败明细
      status: "done",
      finishedAt: new Date().toISOString(),
    },
  });

  return {
    ok: true,
    batchId,
    targetCount: openids.length,
    successCount,
    failedCount: failed.length,
    failed: failed.slice(0, 20),
    reasons,
  };
};

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
