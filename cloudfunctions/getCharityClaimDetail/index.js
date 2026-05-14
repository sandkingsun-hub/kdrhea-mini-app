// getCharityClaimDetail · 单凭证详情（凭证页用 / 分享分享落地用）
// 入参: { claimId?, sn? }（任一）
// 出参: { ok, claim: {... cardSnapshot, pointsSpent, donatedFen, sn, claimedAt, claimerNickname }, isOwner }
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const callerOpenid = wxContext.OPENID;
  const { claimId, sn } = event;
  if (!claimId && !sn) return { ok: false, code: "MISSING_REF" };

  let claim = null;
  try {
    const q = claimId
      ? await db.collection("user_charity_claims").doc(claimId).get()
      : await db.collection("user_charity_claims").where({ sn }).limit(1).get();
    claim = claimId ? q.data : q.data[0];
  } catch (e) {
    return { ok: false, code: "NOT_FOUND" };
  }
  if (!claim) return { ok: false, code: "NOT_FOUND" };

  let claimerNickname = "TA";
  try {
    const u = await db.collection("users").where({ _openid: claim._openid }).limit(1).get();
    if (u.data.length > 0) {
      claimerNickname = u.data[0].nickname || u.data[0].displayName || "TA";
    }
  } catch {}

  return {
    ok: true,
    isOwner: callerOpenid === claim._openid,
    claim: {
      _id: claim._id,
      cardId: claim.cardId,
      cardSnapshot: claim.cardSnapshot,
      pointsSpent: claim.pointsSpent,
      donatedFen: claim.donatedFen,
      sn: claim.sn,
      claimedAt: claim.claimedAt,
      shareCount: claim.shareCount || 0,
      claimerNickname,
    },
  };
};
