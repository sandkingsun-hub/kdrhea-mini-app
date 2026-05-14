// getMyCharityClaims · 我的爱心墙（用户认领历史）
// 入参: { limit?: 20, skip?: 0 }
// 出参: { ok, items, total, totalPointsSpent, totalDonatedFen }
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const $ = db.command.aggregate;

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { ok: false, code: "NO_OPENID" };

  const { limit = 20, skip = 0 } = event;
  const cap = Math.min(limit, 50);

  let items = [];
  let total = 0;
  let totalPointsSpent = 0;
  let totalDonatedFen = 0;
  try {
    const [a, b, sumRes] = await Promise.all([
      db.collection("user_charity_claims").where({ _openid: openid }).orderBy("claimedAt", "desc").skip(skip).limit(cap).get(),
      db.collection("user_charity_claims").where({ _openid: openid }).count(),
      db.collection("user_charity_claims").aggregate().match({ _openid: openid }).group({
        _id: null,
        pts: $.sum("$pointsSpent"),
        donated: $.sum("$donatedFen"),
      }).end(),
    ]);
    items = a.data.map((c) => ({
      _id: c._id,
      cardId: c.cardId,
      cardSnapshot: c.cardSnapshot,
      pointsSpent: c.pointsSpent,
      donatedFen: c.donatedFen,
      sn: c.sn,
      claimedAt: c.claimedAt,
      shareCount: c.shareCount || 0,
    }));
    total = b.total;
    if (sumRes.list && sumRes.list[0]) {
      totalPointsSpent = sumRes.list[0].pts || 0;
      totalDonatedFen = sumRes.list[0].donated || 0;
    }
  } catch (e) {
    if (!String(e).includes("not exist") && !String(e).includes("database collection not found")) {
      throw e;
    }
  }

  return { ok: true, items, total, totalPointsSpent, totalDonatedFen };
};
