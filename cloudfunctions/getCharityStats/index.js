// getCharityStats · 全局累计统计（卡片墙顶部 stats）
// 入参: 无
// 出参: { ok, totalClaims, totalDonatedFen, configCharityRatio: "1:1" }
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const $ = db.command.aggregate;

exports.main = async () => {
  let totalClaims = 0;
  let totalDonatedFen = 0;
  try {
    const c = await db.collection("user_charity_claims").count();
    totalClaims = c.total;

    const sumRes = await db
      .collection("user_charity_claims")
      .aggregate()
      .group({ _id: null, sum: $.sum("$donatedFen") })
      .end();
    totalDonatedFen = (sumRes.list && sumRes.list[0] && sumRes.list[0].sum) || 0;
  } catch (e) {
    if (!String(e).includes("not exist") && !String(e).includes("database collection not found")) {
      throw e;
    }
  }

  return {
    ok: true,
    totalClaims,
    totalDonatedFen,
    configCharityRatio: "1:1",
  };
};
