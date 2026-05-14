// adminGetCustomerMedicalRecord · admin 看某顾客完整治疗档案
// 入: { adminToken, customerOpenid }
// 出: { ok, customer: {...}, visits: [{ checkIn, medicines: [...] }, ...], otherMedicines: [...] }
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

function maskPhone(p) {
  if (!p || typeof p !== "string") return null;
  if (p.length < 7) return p;
  return p.slice(0, 3) + "****" + p.slice(-4);
}

exports.main = async (event = {}) => {
  const { adminToken, customerOpenid } = event;
  if (!verifyAdminToken(adminToken)) return { ok: false, code: "UNAUTHORIZED" };
  if (!customerOpenid || typeof customerOpenid !== "string") return { ok: false, code: "MISSING_OPENID" };

  // 1. 顾客基础信息
  let customer = null;
  try {
    const r = await db.collection("users").where({ _openid: customerOpenid }).limit(1).get();
    if (r.data.length > 0) {
      const u = r.data[0];
      customer = {
        openid: u._openid,
        nickname: u.nickname || null,
        phoneMasked: maskPhone(u.phone),
        avatarUrl: u.avatarUrl || null,
        registeredAt: u.registeredAt || null,
        balance: u.balance || 0,
      };
    }
  } catch {}
  if (!customer) return { ok: false, code: "CUSTOMER_NOT_FOUND" };

  // 2. check_ins 列表（该顾客所有到店打卡）
  let checkIns = [];
  try {
    const r = await db.collection("check_ins")
      .where({ customerOpenid })
      .orderBy("checkedInAt", "desc")
      .limit(100)
      .get();
    checkIns = r.data;
  } catch (e) {
    if (!String(e).includes("not exist")) throw e;
  }

  // 3. treatment_medicines（该顾客所有扫码记录）
  let medicines = [];
  try {
    const r = await db.collection("treatment_medicines")
      .where({ _openid: customerOpenid })
      .orderBy("scannedAt", "desc")
      .limit(200)
      .get();
    medicines = r.data;
  } catch (e) {
    if (!String(e).includes("not exist")) throw e;
  }

  // 4. 富化 medicines 主表（拿 name/registrantName/registerNo/status 最新值）
  const keys = Array.from(new Set(medicines.map(m => m.medicineKey).filter(Boolean)));
  const medicineMap = new Map();
  if (keys.length > 0) {
    try {
      const r = await db.collection("medicines").where({ _id: db.command.in(keys) }).limit(200).get();
      for (const m of r.data) medicineMap.set(m._id, m);
    } catch {}
  }

  const enrichMedicine = (tm) => {
    const m = medicineMap.get(tm.medicineKey) || tm.medicineSnapshot || {};
    return {
      _id: tm._id,
      medicineKey: tm.medicineKey,
      codeType: tm.codeType,
      name: m.name || tm.medicineSnapshot?.name || "",
      registrantName: m.registrantName || tm.medicineSnapshot?.registrantName || "",
      registerNo: m.registerNo || tm.medicineSnapshot?.registerNo || "",
      spec: m.spec || tm.medicineSnapshot?.spec || "",
      pending: !m.name || m.status === "pending",
      batchNo: tm.batchNo,
      expireDate: tm.expireDate,
      sn: tm.sn,
      mfgDate: tm.mfgDate,
      scannedAt: tm.scannedAt,
      scannerRole: tm.scannerRole,
    };
  };

  // 5. 按 check_in 聚合 medicines · 没 checkInId 进 散单
  const medicinesByCheckIn = new Map();
  const otherMedicines = [];
  for (const tm of medicines) {
    const enriched = enrichMedicine(tm);
    if (tm.checkInId) {
      if (!medicinesByCheckIn.has(tm.checkInId)) medicinesByCheckIn.set(tm.checkInId, []);
      medicinesByCheckIn.get(tm.checkInId).push(enriched);
    } else {
      otherMedicines.push(enriched);
    }
  }

  // 6. visits 数组 · 每个 visit = 一次 check-in + 该次用药
  const visits = checkIns.map(ci => ({
    checkInId: ci._id,
    dateStr: ci.dateStr,
    checkedInAt: ci.checkedInAt,
    staffOpenid: ci.staffOpenid,
    pointsGranted: ci.pointsGranted,
    medicines: medicinesByCheckIn.get(ci._id) || [],
  }));

  // 统计
  const stats = {
    totalVisits: checkIns.length,
    totalMedicines: medicines.length,
    lastVisitAt: checkIns[0]?.checkedInAt || null,
  };

  return {
    ok: true,
    customer,
    visits,
    otherMedicines,
    stats,
  };
};
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
