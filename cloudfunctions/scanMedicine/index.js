// scanMedicine · 扫码记录治疗用药/器械
// 模式 A · 顾客自扫: 入 {gsString, appointmentId?} · patient = caller openid
// 模式 B · staff 代扫: 入 {gsString, customerOpenid, appointmentId?} · staff/admin 才能用 · patient = customerOpenid
// 出: { ok, medicine, batchInfo, treatmentMedicineId, appointmentId, isPending, mode }
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

async function ensureCollection(name) {
  try { await db.collection(name).count(); }
  catch (e) {
    if (String(e).includes("not exist")) try { await db.createCollection(name); } catch {}
  }
}

// ====== GS1 element string parser ======
// 支持两种格式:
//   括号格式: (01)06901234567892(17)270615(10)L12345(21)SN001
//   紧凑格式: 0106901234567892172706151010L12345  (固定+变长 · AI 后跟值)
//             AI=01 GTIN 14 固定 · 17/11 日期 6 固定 · 10/21 变长 (FNC1=0x1d 分隔 或 末尾)
function parseGS1(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const result = { raw };

  // 括号格式优先
  const parenRe = /\((\d{2,4})\)([^(]+)/g;
  let m, hasMatch = false;
  while ((m = parenRe.exec(raw))) {
    hasMatch = true;
    const ai = m[1];
    let val = m[2].trim();
    // 去掉可能的 FNC1
    val = val.replace(/\x1d.*$/, "");
    fillField(result, ai, val);
  }

  if (!hasMatch) {
    // 紧凑格式 · GS1 DataMatrix 标准 · 含不可见 FNC1 (\x1d) 分隔变长字段
    let s = raw.replace(/\x1d/g, "|"); // 用 | 暂代 FNC1 标记
    let guard = 0;
    while (s.length > 0 && guard++ < 50) {
      // 跳过 FNC1 分隔符（leading）
      if (s.startsWith("|")) { s = s.slice(1); continue; }

      if (s.startsWith("01") && s.length >= 16) {
        fillField(result, "01", s.slice(2, 16));
        s = s.slice(16);
      } else if (s.startsWith("17") && s.length >= 8) {
        fillField(result, "17", s.slice(2, 8));
        s = s.slice(8);
      } else if (s.startsWith("11") && s.length >= 8) {
        fillField(result, "11", s.slice(2, 8));
        s = s.slice(8);
      } else if (s.startsWith("10") || s.startsWith("21")) {
        const ai = s.slice(0, 2);
        s = s.slice(2);
        // 变长 · 至 FNC1 (|) 或末尾 · 保留 | 让外层循环 skip
        const sepIdx = s.indexOf("|");
        let val;
        if (sepIdx < 0) {
          val = s;
          s = "";
        } else {
          val = s.slice(0, sepIdx);
          s = s.slice(sepIdx); // 不消 | · 留给上面 skip
        }
        fillField(result, ai, val);
      } else {
        // 无法识别 · 跳过 (避免死循环)
        break;
      }
    }
  }

  // 兜底 · 纯数字按 GS1 标准统一规整为 14 位 GTIN
  // EAN-13/UPC-A/GTIN-8 都是 GTIN-14 的子集 · 左补 0 可还原
  if (!result.gtin && /^\d+$/.test(raw)) {
    const len = raw.length;
    if (len === 14) result.gtin = raw;
    else if (len === 13) result.gtin = "0" + raw;        // EAN-13 → GTIN-14 (国内常见医疗耗材)
    else if (len === 12) result.gtin = "00" + raw;       // UPC-A → GTIN-14
    else if (len === 8) result.gtin = "000000" + raw;    // GTIN-8 → GTIN-14
    else if (len === 20) result.drugCode = raw;           // 国家药品监管码
    else if (len >= 16 && len <= 22) result.drugCode = raw; // 国内非标 UDI 容差
  }

  return result;
}

function fillField(result, ai, val) {
  switch (ai) {
    case "01": result.gtin = val; break;
    case "17": result.expireDate = parseGS1Date(val); break;
    case "11": result.mfgDate = parseGS1Date(val); break;
    case "10": result.batchNo = val; break;
    case "21": result.sn = val; break;
    default: break;
  }
}

function parseGS1Date(yymmdd) {
  if (!yymmdd || yymmdd.length !== 6) return null;
  const yy = parseInt(yymmdd.slice(0, 2));
  const mm = parseInt(yymmdd.slice(2, 4));
  let dd = parseInt(yymmdd.slice(4, 6));
  // GS1: dd=00 表示该月末 · 简化用月初 +1 月 -1 天
  if (dd === 0) dd = 1;
  const year = yy < 50 ? 2000 + yy : 1900 + yy;
  return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

// ====== main ======
exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const callerOpenid = wxContext.OPENID;
  if (!callerOpenid) return { ok: false, code: "NO_OPENID" };

  const { gsString, appointmentId: appointmentIdInput, customerOpenid: customerOpenidInput } = event;
  if (!gsString || typeof gsString !== "string") return { ok: false, code: "MISSING_GS_STRING" };

  // 模式判定 · staff 代扫需校验角色
  let patientOpenid = callerOpenid;
  let scannerRole = "customer";
  let mode = "self";
  if (customerOpenidInput && typeof customerOpenidInput === "string" && customerOpenidInput.trim() && customerOpenidInput !== callerOpenid) {
    try {
      const r = await db.collection("users").where({ _openid: callerOpenid }).limit(1).get();
      const role = (r.data[0] && r.data[0].role) || "customer";
      if (role !== "staff" && role !== "admin") {
        return { ok: false, code: "FORBIDDEN", message: "仅员工可代扫" };
      }
      scannerRole = role;
      patientOpenid = customerOpenidInput.trim();
      mode = "staff_proxy";
    } catch (e) {
      return { ok: false, code: "ROLE_CHECK_FAILED" };
    }
  }

  // 1. 解析 GS1
  const parsed = parseGS1(gsString);
  if (!parsed || (!parsed.gtin && !parsed.drugCode)) {
    return { ok: false, code: "PARSE_FAILED", raw: gsString, parsed };
  }

  await ensureCollection("medicines");
  await ensureCollection("treatment_medicines");

  // 2. 查/建 medicines 主记录
  const key = parsed.gtin || parsed.drugCode;
  const codeType = parsed.gtin ? "GTIN" : "DRUG_CODE";

  let medicine = null;
  try {
    const r = await db.collection("medicines").where({ _id: key }).limit(1).get();
    medicine = r.data[0] || null;
  } catch {}

  const now = new Date().toISOString();
  let isPending = false;

  if (!medicine) {
    // pending 创建 · admin 后台补全
    medicine = {
      _id: key,
      codeType,
      name: "",                     // admin 后期补全
      productName: "",
      registrantName: "",
      registerNo: "",
      spec: "",
      status: "pending",
      firstScannedAt: now,
      firstScannedBy: callerOpenid,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await db.collection("medicines").add({ data: medicine });
      isPending = true;
    } catch (e) {
      // 并发 add 冲突 · 重读
      const r2 = await db.collection("medicines").where({ _id: key }).limit(1).get();
      medicine = r2.data[0] || medicine;
    }
  } else {
    isPending = medicine.status === "pending";
  }

  // 3. 解析 appointmentId
  let appointmentId = (typeof appointmentIdInput === "string" && appointmentIdInput.trim()) ? appointmentIdInput.trim() : null;
  let appointmentSnapshot = null;

  if (!appointmentId) {
    // 兜底 · 找该顾客最近一次未取消的预约 (不限时间窗口)
    try {
      const r = await db
        .collection("appointments")
        .where({
          _openid: patientOpenid,
          status: _.nin(["cancelled", "canceled"]),
        })
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();
      if (r.data.length > 0) appointmentId = r.data[0]._id;
    } catch {}
  }

  if (appointmentId) {
    try {
      const r = await db.collection("appointments").doc(appointmentId).get();
      if (r.data && r.data._openid === patientOpenid) {
        appointmentSnapshot = {
          status: r.data.status,
          serviceName: r.data.serviceName || r.data.service || null,
          appointmentTime: r.data.appointmentTime || r.data.date || null,
          createdAt: r.data.createdAt,
        };
      } else {
        appointmentId = null;
      }
    } catch {
      appointmentId = null;
    }
  }

  // 4. 写 treatment_medicines · 一物一条记录 · _openid = patient (顾客)
  const tmDoc = {
    _openid: patientOpenid,
    medicineKey: key,
    codeType,
    gtin: parsed.gtin || null,
    drugCode: parsed.drugCode || null,
    batchNo: parsed.batchNo || null,
    expireDate: parsed.expireDate || null,
    sn: parsed.sn || null,
    mfgDate: parsed.mfgDate || null,
    rawCode: parsed.raw,
    appointmentId,
    appointmentSnapshot,
    scannedAt: now,
    scannedBy: callerOpenid,           // 实际操作人 (顾客自扫=患者本人 · staff 代扫=员工)
    scannerRole,                        // customer | staff | admin
    medicineSnapshot: {
      name: medicine.name,
      registrantName: medicine.registrantName,
      registerNo: medicine.registerNo,
      spec: medicine.spec,
      status: medicine.status,
    },
  };

  const addRes = await db.collection("treatment_medicines").add({ data: tmDoc });

  return {
    ok: true,
    treatmentMedicineId: addRes._id,
    medicine,
    batchInfo: {
      batchNo: parsed.batchNo,
      expireDate: parsed.expireDate,
      sn: parsed.sn,
      mfgDate: parsed.mfgDate,
    },
    appointmentId,
    appointmentSnapshot,
    isPending,
    mode,
    patientOpenid: mode === "staff_proxy" ? patientOpenid : undefined,
  };
};
