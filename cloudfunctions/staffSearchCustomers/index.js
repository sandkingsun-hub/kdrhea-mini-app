// staffSearchCustomers · 员工按姓名/手机号搜顾客
// 用于 staff/medicine-scanner 第二种绑定方式（除扫会员码外）
// 入: { name?, phone?, limit? = 10 }
// 出: { ok, items: [{ openid, nickname, phoneMasked, avatarUrl, latestAppointment? }] }
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function maskPhone(phone) {
  if (!phone || typeof phone !== "string") return null;
  if (phone.length < 7) return phone;
  return phone.slice(0, 3) + "****" + phone.slice(-4);
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const callerOpenid = wxContext.OPENID;
  if (!callerOpenid) return { ok: false, code: "NO_OPENID" };

  // 角色校验 · 仅 staff/admin
  try {
    const r = await db.collection("users").where({ _openid: callerOpenid }).limit(1).get();
    const role = (r.data[0] && r.data[0].role) || "customer";
    if (role !== "staff" && role !== "admin") {
      return { ok: false, code: "FORBIDDEN", message: "仅员工可搜索顾客" };
    }
  } catch (e) {
    return { ok: false, code: "ROLE_CHECK_FAILED" };
  }

  const { name = "", phone = "", limit = 10 } = event;
  const trimName = String(name || "").trim();
  const trimPhone = String(phone || "").trim();
  if (!trimName && !trimPhone) return { ok: false, code: "MISSING_QUERY" };

  const cap = Math.min(Math.max(1, parseInt(limit) || 10), 50);
  const where = {};

  if (trimPhone) {
    if (!/^\d+$/.test(trimPhone)) return { ok: false, code: "INVALID_PHONE" };
    where.phone = db.RegExp({ regexp: trimPhone, options: "" });
  } else {
    where.nickname = db.RegExp({ regexp: trimName, options: "i" });
  }

  let list;
  try {
    list = await db.collection("users").where(where).orderBy("registeredAt", "desc").limit(cap).get();
  } catch (e) {
    return { ok: false, code: "DB_QUERY_FAILED", message: String(e).slice(0, 200) };
  }

  // 富化 · 顺便带最近未取消预约
  const items = await Promise.all(list.data.map(async (u) => {
    const openid = u._openid;
    let latestAppointment = null;
    try {
      const ra = await db.collection("appointments")
        .where({ _openid: openid, status: _.nin(["cancelled", "canceled"]) })
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();
      if (ra.data.length > 0) {
        const a = ra.data[0];
        latestAppointment = {
          _id: a._id,
          serviceName: a.serviceName || a.service || null,
          status: a.status,
          appointmentTime: a.appointmentTime || a.date || null,
        };
      }
    } catch {}
    return {
      openid,
      nickname: u.nickname || null,
      phoneMasked: maskPhone(u.phone),
      avatarUrl: u.avatarUrl || null,
      latestAppointment,
    };
  }));

  return { ok: true, items, total: items.length };
};
