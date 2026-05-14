// listMyMedicineRecords · 顾客看自己的药品扫码历史
// 入: { limit?: 30, skip?: 0, appointmentId? (按预约 filter) }
// 出: { ok, items: [{ ...treatment_medicine + medicine }], total }
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { ok: false, code: "NO_OPENID" };

  const { limit = 30, skip = 0, appointmentId } = event;
  const cap = Math.min(Number(limit) || 30, 100);
  const sk = Math.max(Number(skip) || 0, 0);

  const where = { _openid: openid };
  if (appointmentId) where.appointmentId = appointmentId;

  let list = [];
  let total = 0;
  try {
    const [a, b] = await Promise.all([
      db.collection("treatment_medicines").where(where).orderBy("scannedAt", "desc").skip(sk).limit(cap).get(),
      db.collection("treatment_medicines").where(where).count(),
    ]);
    list = a.data;
    total = b.total;
  } catch (e) {
    if (String(e).includes("not exist")) {
      return { ok: true, items: [], total: 0 };
    }
    throw e;
  }

  // 拉关联 medicines 最新状态（snapshot 防止 admin 补全后老记录看不到）
  const keys = Array.from(new Set(list.map(r => r.medicineKey).filter(Boolean)));
  let medicineMap = new Map();
  if (keys.length > 0) {
    try {
      const r = await db.collection("medicines").where({ _id: db.command.in(keys) }).limit(100).get();
      for (const m of r.data) medicineMap.set(m._id, m);
    } catch {}
  }

  const items = list.map(t => {
    const m = medicineMap.get(t.medicineKey) || t.medicineSnapshot || {};
    return {
      _id: t._id,
      medicineKey: t.medicineKey,
      codeType: t.codeType,
      name: m.name || t.medicineSnapshot?.name || "",
      registrantName: m.registrantName || t.medicineSnapshot?.registrantName || "",
      registerNo: m.registerNo || t.medicineSnapshot?.registerNo || "",
      spec: m.spec || t.medicineSnapshot?.spec || "",
      pending: !m.name || m.status === "pending",
      batchNo: t.batchNo,
      expireDate: t.expireDate,
      sn: t.sn,
      mfgDate: t.mfgDate,
      appointmentId: t.appointmentId,
      appointmentSnapshot: t.appointmentSnapshot,
      scannedAt: t.scannedAt,
    };
  });

  return { ok: true, items, total };
};
