const crypto = require("node:crypto");
// bindPhone · 把微信验证过的手机号绑到 user 表
// 入参：{ phoneCode } —— Button open-type="getPhoneNumber" 回调里的 e.detail.code
// 出参：{ ok, phone, alreadyBound }
//
// 用途：预约/线下激活/任何需要"已验证手机号"的入口
// - 防恶意：不接受客户手填·只接受微信侧验证过的号
// - 持久化：写到 users.phone + phoneHash·下次自动取
// - 不做激活·激活走 activateOldCustomer
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

async function getPhoneFromCode(code) {
  const res = await cloud.openapi.phonenumber.getPhoneNumber({ code });
  return res.phoneInfo && (res.phoneInfo.purePhoneNumber || res.phoneInfo.phoneNumber);
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  // __test_phone：dev 旁路·上线前移除
  const { phoneCode, __test_phone } = event;

  if (!openid) {
    return { ok: false, code: "NO_OPENID" };
  }

  let phone;
  if (__test_phone) {
    console.warn("[DEV] using __test_phone bypass:", __test_phone);
    phone = String(__test_phone);
  } else {
    if (!phoneCode) {
      return { ok: false, code: "MISSING_PHONE_CODE" };
    }
    try {
      phone = await getPhoneFromCode(phoneCode);
    } catch (e) {
      return { ok: false, code: "GET_PHONE_FAILED", error: String(e) };
    }
  }
  if (!phone) {
    return { ok: false, code: "EMPTY_PHONE" };
  }

  const phoneHash = sha256(phone);
  const now = new Date().toISOString();

  // 查现有 user · 看是否已绑同号
  const existing = await db.collection("users").where({ _openid: openid }).limit(1).get();
  let alreadyBound = false;
  if (existing.data.length > 0 && existing.data[0].phone === phone) {
    alreadyBound = true;
  }

  await db.collection("users").where({ _openid: openid }).update({
    data: { phone, phoneHash, lastActiveAt: now },
  });

  return { ok: true, phone, alreadyBound };
};
