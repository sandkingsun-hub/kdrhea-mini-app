// adminUpdateAppointment · admin 改预约（状态/时间/备注）
// 入: { adminToken, appointmentId, status?, finalDate?, finalSlot?, staffNotes? }
// 出: { ok, appointmentId, status, finalDate, finalSlot }
// 状态机沿用 updateAppointmentStatus
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

const ALLOWED_STATUS = new Set(["pending", "confirmed", "rejected", "completed", "cancelled", "rescheduled"]);
const ALLOWED_SLOTS = new Set(["morning", "afternoon", "evening"]);

exports.main = async (event = {}) => {
  const admin = verifyAdminToken(event.adminToken);
  if (!admin) return { ok: false, code: "UNAUTHORIZED" };

  const { appointmentId, status, finalDate, finalSlot, staffNotes } = event;
  if (!appointmentId) return { ok: false, code: "MISSING_ID" };

  let doc;
  try {
    doc = (await db.collection("appointments").doc(appointmentId).get()).data;
  } catch { return { ok: false, code: "NOT_FOUND" }; }
  if (!doc) return { ok: false, code: "NOT_FOUND" };

  if (status && !ALLOWED_STATUS.has(status)) return { ok: false, code: "INVALID_STATUS" };

  const now = new Date().toISOString();
  const update = { updatedAt: now };

  if (status) update.status = status;
  if (typeof staffNotes === "string") update.staffNotes = staffNotes;

  // 时间字段（confirmed / rescheduled 时）
  if (finalDate !== undefined) {
    if (finalDate && !/^\d{4}-\d{2}-\d{2}$/.test(finalDate)) return { ok: false, code: "INVALID_DATE" };
    update.finalDate = finalDate || null;
  }
  if (finalSlot !== undefined) {
    if (finalSlot && !ALLOWED_SLOTS.has(finalSlot)) return { ok: false, code: "INVALID_SLOT" };
    update.finalSlot = finalSlot || null;
  }

  // 切到 confirmed/rescheduled 时如果没显式 finalDate/Slot · 用 preferredDate/Slot 兜底
  if (status === "confirmed" || status === "rescheduled") {
    if (update.finalDate === undefined && !doc.finalDate) update.finalDate = doc.preferredDate;
    if (update.finalSlot === undefined && !doc.finalSlot) update.finalSlot = doc.preferredSlot;
    update.confirmedAt = now;
    update.confirmedBy = "admin_web";
  }

  await db.collection("appointments").doc(appointmentId).update({ data: update });

  return {
    ok: true,
    appointmentId,
    status: update.status || doc.status,
    finalDate: update.finalDate ?? doc.finalDate,
    finalSlot: update.finalSlot ?? doc.finalSlot,
  };
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
