// dataCheck · 数据一致性人工检查 · 运营周跑（函数名前缀 _ 不允许）
// 入参: 无 · 出参: { ok, issues: [...], totalChecked }
// 验证：1) user_badge 颁发的徽章对应用户必须达到 unlock threshold
//       2) charity_ledger sum 必须 ≈ pet_state.totalContributionFen
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async () => {
  const issues = [];

  // 1. user_badge 颁发的徽章对应用户必须达到 unlock threshold
  let badgeDefs = [];
  try { badgeDefs = (await db.collection('badge_def').get()).data; }
  catch (e) { /* 空 · 跳过 */ }
  const badgeMap = new Map(badgeDefs.map(b => [b._id, b]));

  let userBadges = [];
  try { userBadges = (await db.collection('user_badge').limit(1000).get()).data; }
  catch (e) { /* 空 · 跳过 */ }

  for (const ub of userBadges) {
    const def = badgeMap.get(ub.badgeId);
    if (!def) { issues.push({ type: 'orphan_badge', userBadge: ub }); continue; }
    if (def.unlock && def.unlock.type === 'pet_level') {
      try {
        const pet = (await db.collection('pet_state').doc(ub.openid).get()).data;
        if (pet.level < def.unlock.threshold) {
          issues.push({
            type: 'badge_below_threshold',
            openid: ub.openid, badgeId: ub.badgeId,
            currentLevel: pet.level, threshold: def.unlock.threshold,
          });
        }
      } catch (e) { issues.push({ type: 'missing_pet_state', openid: ub.openid }); }
    }
  }

  // 2. charity_ledger sum 必须 ≈ pet_state.totalContributionFen
  let pets = [];
  try { pets = (await db.collection('pet_state').limit(500).get()).data; }
  catch (e) { /* 空 · 跳过 */ }

  for (const pet of pets) {
    try {
      const lr = await db.collection('charity_ledger')
        .aggregate()
        .match({ openid: pet._id })
        .group({ _id: null, total: _.aggregate.sum('$amountFen') })
        .end();
      const actual = lr.list[0]?.total || 0;
      if (Math.abs(actual - (pet.totalContributionFen || 0)) > 0) {
        issues.push({
          type: 'contribution_mismatch',
          openid: pet._id,
          redundant: pet.totalContributionFen,
          actual,
        });
      }
    } catch (e) { /* 跳过 */ }
  }

  return {
    ok: issues.length === 0,
    issues,
    totalChecked: { userBadges: userBadges.length, pets: pets.length },
  };
};
