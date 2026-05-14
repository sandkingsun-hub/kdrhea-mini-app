// getMyMemberLevel · 顾客查自己等级 + 本年进度（5 级 + 年滚动）
// 入: 无
// 出: { ok, level, levelName, currentYearScoreFen, nextLevel, distanceFen, ... }
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const FALLBACK_LEVELS = [
  { level: 0, name: "VISITOR", thresholdFen: 0, pointsMultiplier: 1.0, birthdayCouponFen: 0 },
  { level: 1, name: "INITIAL", thresholdFen: 68000, pointsMultiplier: 1.0, birthdayCouponFen: 10000 },
  { level: 2, name: "PRIME", thresholdFen: 1000000, pointsMultiplier: 1.1, birthdayCouponFen: 30000 },
  { level: 3, name: "APEX", thresholdFen: 3000000, pointsMultiplier: 1.2, birthdayCouponFen: 80000 },
  { level: 4, name: "SOVEREIGN", thresholdFen: 5000000, pointsMultiplier: 1.25, birthdayCouponFen: 150000 },
  { level: 5, name: "ETERNAL", thresholdFen: 7000000, pointsMultiplier: 1.3, birthdayCouponFen: 200000 },
];

async function loadLevels() {
  try {
    const r = await db.collection("member_level_config").orderBy("level", "asc").get();
    if (r.data.length >= 2) return r.data;
  } catch (e) {
    if (!String(e).includes("not exist")) console.warn("loadLevels failed:", e);
  }
  return FALLBACK_LEVELS;
}

exports.main = async () => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { ok: false, code: "NO_OPENID" };

  const userQ = await db.collection("users").where({ _openid: openid }).limit(1).get();
  if (userQ.data.length === 0) return { ok: false, code: "USER_NOT_FOUND" };
  const user = userQ.data[0];

  const levels = await loadLevels();
  const currentLevel = user.level || 0;
  const currentYearScoreFen = user.currentYearScoreFen || 0;

  const currentConfig = levels.find(l => l.level === currentLevel) || levels[0];
  const nextConfig = levels.find(l => l.level === currentLevel + 1) || null;
  const distance = nextConfig ? Math.max(0, nextConfig.thresholdFen - currentYearScoreFen) : 0;

  return {
    ok: true,
    level: currentLevel,
    levelName: currentConfig.name,
    levelThresholdFen: currentConfig.thresholdFen,
    pointsMultiplier: currentConfig.pointsMultiplier || 1.0,
    birthdayCouponFen: currentConfig.birthdayCouponFen || 0,
    currentYearScoreFen,
    lastYearScoreFen: user.lastYearScoreFen || 0,
    lifetimeContributionFen: user.lifetimeContributionFen || 0,
    consumptionContributionFen: user.consumptionContributionFen || 0,
    charityContributionFen: user.charityContributionFen || 0,
    nextLevel: nextConfig ? nextConfig.level : null,
    nextLevelName: nextConfig ? nextConfig.name : null,
    nextLevelThresholdFen: nextConfig ? nextConfig.thresholdFen : null,
    distanceFen: distance,
    levelUpgradedAt: user.levelUpgradedAt || null,
    birthDate: user.birthDate || null,
    yearTag: new Date().getUTCFullYear(),
    allLevels: levels.map(l => ({
      level: l.level,
      name: l.name,
      thresholdFen: l.thresholdFen,
      pointsMultiplier: l.pointsMultiplier,
      birthdayCouponFen: l.birthdayCouponFen,
    })),
  };
};
