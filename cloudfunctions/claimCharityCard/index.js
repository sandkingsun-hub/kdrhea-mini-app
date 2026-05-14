// claimCharityCard · 公益认领核心事务
// 入参: { cardId }
// 出参: { ok, claimId, sn, claim, balanceAfter }
// 规则:
//   - 1:1 配捐 · pointsSpent === donatedFen · 100 积分 = 1 元
//   - 卡片必须 status=on_shelf
//   - 余额不足走 spendPoints INSUFFICIENT 错误
//   - 不限制单卡认领次数（可重复认领·每次都是新凭证）
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function pad4(n) { return String(n).padStart(4, "0"); }
function yyyymmdd(d) { return d.toISOString().slice(0, 10).replace(/-/g, ""); }

async function ensureCollection(name) {
  try { await db.collection(name).count(); }
  catch (e) {
    if (String(e).includes("not exist") || String(e).includes("database collection not found")) {
      try { await db.createCollection(name); } catch {}
    }
  }
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { ok: false, code: "NO_OPENID" };
  const { cardId } = event;
  if (!cardId) return { ok: false, code: "MISSING_CARD_ID" };

  // 1. 查卡片定义 + on_shelf 校验
  let card;
  try {
    const r = await db.collection("charity_card_def").where({ _id: cardId, status: "on_shelf" }).limit(1).get();
    if (r.data.length === 0) return { ok: false, code: "CARD_NOT_FOUND" };
    card = r.data[0];
  } catch (e) {
    return { ok: false, code: "CARD_NOT_FOUND" };
  }

  // 2. 调 spendPoints 扣积分（事务边界由 spendPoints 自己保证）
  const spendRes = await cloud.callFunction({
    name: "spendPoints",
    data: {
      targetOpenid: openid,
      delta: card.pointsPrice,
      type: "spend_charity_claim",
      refType: "charity_card",
      refId: cardId,
      description: `公益认领 · ${card.name}`,
    },
  });
  if (!spendRes.result || !spendRes.result.ok) {
    return { ok: false, code: "SPEND_FAILED", detail: spendRes.result };
  }

  // 3. 生成 SN · KDR-YYYYMMDD-NNNN
  await ensureCollection("user_charity_claims");
  const now = new Date();
  const today = yyyymmdd(now);
  let seq = 1;
  try {
    const todayCount = await db
      .collection("user_charity_claims")
      .where({ sn: new db.RegExp({ regexp: `^KDR-${today}-` }) })
      .count();
    seq = todayCount.total + 1;
  } catch {}
  const sn = `KDR-${today}-${pad4(seq)}`;

  // 4. 写凭证记录
  const claim = {
    _openid: openid,
    cardId: card._id,
    cardSnapshot: {
      name: card.name,
      description: card.description,
      story: card.story || "",
      pointsPrice: card.pointsPrice,
      donatedFen: card.donatedFen,
      imageUrl: card.imageUrl || null,
    },
    pointsSpent: card.pointsPrice,
    donatedFen: card.donatedFen,
    orgId: card.orgId || null,
    sn,
    shareCount: 0,
    claimedAt: now.toISOString(),
    createdAt: now.toISOString(),
  };
  const addRes = await db.collection("user_charity_claims").add({ data: claim });

  // 累加贡献分 + 跑等级升级判定 · 公益按顾客出资金额（donatedFen 是 KDRHEA 配捐 · pointsPrice 积分=分 是顾客出的部分）
  // 1 积分 = 1 分 · 顾客花 pointsPrice 积分 = 同等金额贡献
  let levelUpgrade = null;
  try {
    const upgradeRes = await cloud.callFunction({
      name: "recordContribution",
      data: {
        customerOpenid: openid,
        deltaFen: card.pointsPrice,
        source: "charity",
        refId: addRes._id,
        description: `公益认领 · ${card.name}`,
      },
    });
    if (upgradeRes.result?.ok) {
      levelUpgrade = upgradeRes.result;
    }
  } catch (e) {
    console.warn("recordContribution failed:", e);
  }

  return {
    ok: true,
    claimId: addRes._id,
    sn,
    claim,
    levelUpgrade,
    balanceAfter: spendRes.result.balanceAfter,
  };
};
