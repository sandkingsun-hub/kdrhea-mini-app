// adminUpsertMedicine · admin 新增/编辑/删除 medicines 主表
// 入: { adminToken, action: "create"|"update"|"delete"|"complete", medicine?, medicineKey? }
// 出: { ok, medicineKey?, medicine? } | { ok }
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

const ALLOWED_STATUS = new Set(["complete", "pending"]);

function normalize(input = {}) {
  const m = {};
  if (typeof input.name === "string") m.name = input.name.trim();
  if (typeof input.productName === "string") m.productName = input.productName.trim();
  if (typeof input.registrantName === "string") m.registrantName = input.registrantName.trim();
  if (typeof input.registerNo === "string") m.registerNo = input.registerNo.trim();
  if (typeof input.spec === "string") m.spec = input.spec.trim();
  if (typeof input.codeType === "string") m.codeType = input.codeType;
  if (typeof input.status === "string" && ALLOWED_STATUS.has(input.status)) m.status = input.status;
  if (typeof input.note === "string") m.note = input.note;
  return m;
}

exports.main = async (event = {}) => {
  const { adminToken, action, medicine = {}, medicineKey } = event;
  if (!verifyAdminToken(adminToken)) return { ok: false, code: "UNAUTHORIZED" };
  await ensureCollection("medicines");
  const now = new Date().toISOString();

  if (action === "create") {
    const key = (typeof medicine._id === "string" ? medicine._id.trim() : "")
      || (typeof medicine.gtin === "string" ? medicine.gtin.trim() : "");
    if (!key) return { ok: false, code: "MISSING_KEY", message: "需提供 _id (GTIN 或 药监码) 作为唯一键" };
    const n = normalize(medicine);
    if (!n.name) return { ok: false, code: "MISSING_NAME" };
    if (!n.status) n.status = "complete";
    if (!n.codeType) n.codeType = key.length === 14 ? "GTIN" : "DRUG_CODE";

    try {
      await db.collection("medicines").add({
        data: { _id: key, ...n, createdAt: now, updatedAt: now },
      });
      return { ok: true, medicineKey: key, medicine: { _id: key, ...n } };
    } catch (e) {
      return { ok: false, code: "DUPLICATE_OR_ERR", message: String(e.errMsg || e.message || e) };
    }
  }

  if (action === "update" || action === "complete") {
    if (!medicineKey) return { ok: false, code: "MISSING_KEY" };
    const n = normalize(medicine);
    // action=complete: 把 status 自动设为 complete
    if (action === "complete") n.status = "complete";
    if (Object.keys(n).length === 0) return { ok: false, code: "EMPTY_UPDATE" };
    await db.collection("medicines").doc(medicineKey).update({ data: { ...n, updatedAt: now } });
    return { ok: true };
  }

  if (action === "delete") {
    if (!medicineKey) return { ok: false, code: "MISSING_KEY" };
    const force = event.force === true;
    let usedCount = 0;
    try {
      const used = await db.collection("treatment_medicines").where({ medicineKey }).count();
      usedCount = used.total || 0;
    } catch {}

    if (usedCount > 0 && !force) {
      return {
        ok: false,
        code: "MEDICINE_IN_USE",
        usedBy: usedCount,
        message: `还有 ${usedCount} 条治疗记录引用此 medicine · 不能删（可加 force:true 级联删除）`,
      };
    }

    // force=true · 级联删除 treatment_medicines
    let cascadedTreatments = 0;
    if (force && usedCount > 0) {
      try {
        const r = await db.collection("treatment_medicines").where({ medicineKey }).remove();
        cascadedTreatments = r.stats?.removed || usedCount;
      } catch {}
    }
    await db.collection("medicines").doc(medicineKey).remove();
    return { ok: true, force, cascadedTreatments };
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
