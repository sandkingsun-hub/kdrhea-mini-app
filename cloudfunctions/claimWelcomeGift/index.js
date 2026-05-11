// claimWelcomeGift · 领取新人注册礼
// 入：{}
// 出：{ ok, couponId, couponName, couponType, valueFen }
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const DEFAULT_WELCOME_GIFT = {
  enabled: true,
  couponTemplateId: null,
  couponName: "新人首礼 · 100 元体验券",
  couponType: "experience",
  valueFen: 10000,
  value: "门店任意体验项目抵 100 元",
  description: "新会员注册首次专享·到店核销",
  validDays: 90,
};

async function getWelcomeGiftConfig() {
  try {
    const res = await db.collection("system_config").doc("global").get();
    if (!res.data || !res.data.welcomeGift) return { ...DEFAULT_WELCOME_GIFT };
    return { ...DEFAULT_WELCOME_GIFT, ...res.data.welcomeGift };
  } catch {
    return { ...DEFAULT_WELCOME_GIFT };
  }
}

exports.main = async () => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  if (!openid) return { ok: false, code: "NO_OPENID" };

  const userQuery = await db.collection("users").where({ _openid: openid }).limit(1).get();
  if (userQuery.data.length === 0) return { ok: false, code: "USER_NOT_FOUND" };

  const userDoc = userQuery.data[0];
  if (userDoc.invitationGiftClaimed === true) {
    return { ok: false, code: "ALREADY_CLAIMED" };
  }
  if (userDoc.firstPaidAt) {
    return { ok: false, code: "ALREADY_HAS_FIRST_TRANSACTION" };
  }

  const gift = await getWelcomeGiftConfig();
  if (!gift.enabled) {
    return { ok: false, code: "WELCOME_GIFT_DISABLED" };
  }

  let grantResult;
  try {
    const callRes = await cloud.callFunction({
      name: "grantCoupon",
      data: {
        targetOpenid: openid,
        couponName: gift.couponName,
        couponType: gift.couponType,
        value: gift.value,
        description: gift.description,
        validDays: gift.validDays,
        source: "invitation_gift",
        sourceRefId: null,
        sourceRefType: "system_config",
        __internal_caller: "claimWelcomeGift",
      },
    });
    grantResult = callRes.result;
  } catch (e) {
    return { ok: false, code: "GRANT_COUPON_FAILED", error: String(e) };
  }

  if (!grantResult?.ok || !grantResult?.couponId) {
    return {
      ok: false,
      code: grantResult?.code || "GRANT_COUPON_FAILED",
      error: grantResult?.error || null,
    };
  }

  const now = new Date().toISOString();
  await db.collection("users").doc(userDoc._id).update({
    data: {
      invitationGiftClaimed: true,
      invitationGiftClaimedAt: now,
      invitationGiftCouponId: grantResult.couponId,
      lastActiveAt: now,
    },
  });

  return {
    ok: true,
    couponId: grantResult.couponId,
    couponName: gift.couponName,
    couponType: gift.couponType,
    valueFen: gift.valueFen,
  };
};
