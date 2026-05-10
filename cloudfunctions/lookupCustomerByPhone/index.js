// lookupCustomerByPhone · 员工根据手机号查客户 openid
// 入：{ phone }
// 出：{ ok, customer: { openid, nickname, phone, avatarKind } } 或 { code: NOT_REGISTERED }
//
// 权限：仅 staff/admin
const crypto = require("node:crypto");
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

async function getRole(openid) {
  const q = await db.collection("users").where({ _openid: openid }).limit(1).get();
  return q.data[0]?.role || "customer";
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const callerOpenid = wxContext.OPENID;
  const { phone } = event;

  if (!callerOpenid) return { ok: false, code: "NO_OPENID" };

  const role = await getRole(callerOpenid);
  if (role !== "staff" && role !== "admin") return { ok: false, code: "PERMISSION_DENIED" };

  if (!phone || !/^1\d{10}$/.test(phone)) return { ok: false, code: "INVALID_PHONE" };

  // 先按 phoneHash 精确匹配（更稳·避免明文 phone 没存）
  const phoneHash = sha256(phone);
  let q = await db.collection("users").where({ phoneHash }).limit(1).get();
  if (q.data.length === 0) {
    // fallback 直接搜 phone
    q = await db.collection("users").where({ phone }).limit(1).get();
  }
  if (q.data.length === 0) {
    return { ok: false, code: "NOT_REGISTERED" };
  }

  const u = q.data[0];
  return {
    ok: true,
    customer: {
      openid: u._openid,
      nickname: u.nickname || null,
      phone: u.phone || phone,
      avatarKind: u.avatarKind || "default",
    },
  };
};
