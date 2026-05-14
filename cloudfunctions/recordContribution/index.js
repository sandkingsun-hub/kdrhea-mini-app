// recordContribution · 累加用户贡献分 + 写流水 + 升级判定（5 级 + 年滚动）
// 入: { customerOpenid?, deltaFen, source: "consume"|"charity"|"admin_adjust", refId?, description? }
// 出: { ok, oldLevel, newLevel, upgraded, currentYearScoreFen, nextLevelConfig }
//
// 业务规则:
//   - ¥1 消费 = 100 分贡献 · ¥1 公益 = 100 分贡献 · 等权累加
//   - 升级判定基于「本年累计 currentYearScoreFen」（每年 1/1 重置）vs 阈值
//   - 升级实时触发 · 保级走 cronYearlyLevelReview 每年 1/1 跑批
//   - 每次贡献都写一条 contribution_log（用于审计 + 重算）
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 5 级配置兜底（admin 改了 member_level_config 后以集合为准）
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

function calcLevel(scoreFen, levels) {
  let result = levels[0];
  for (const l of levels) {
    if (scoreFen >= l.thresholdFen) result = l;
    else break;
  }
  return result;
}

async function ensureCollection(name) {
  try { await db.collection(name).count(); }
  catch (e) {
    if (String(e).includes("not exist")) try { await db.createCollection(name); } catch {}
  }
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const callerOpenid = wxContext.OPENID;
  const { customerOpenid, deltaFen, source, refId = null, description = "" } = event;

  const openid = customerOpenid || callerOpenid;
  if (!openid) return { ok: false, code: "NO_OPENID" };
  if (!Number.isInteger(deltaFen) || deltaFen <= 0) {
    return { ok: false, code: "INVALID_DELTA", message: "deltaFen 必须为正整数" };
  }
  if (!["consume", "charity", "admin_adjust"].includes(source)) {
    return { ok: false, code: "INVALID_SOURCE" };
  }

  await ensureCollection("contribution_log");

  const levels = await loadLevels();
  const now = new Date();
  const nowIso = now.toISOString();

  // 1. 拉 user
  const userQ = await db.collection("users").where({ _openid: openid }).limit(1).get();
  if (userQ.data.length === 0) return { ok: false, code: "USER_NOT_FOUND" };
  const user = userQ.data[0];
  const oldYearScore = user.currentYearScoreFen || 0;
  const oldLevel = user.level || 0;
  const newYearScore = oldYearScore + deltaFen;
  const newLevelConfig = calcLevel(newYearScore, levels);
  const newLevel = newLevelConfig.level;
  const upgraded = newLevel > oldLevel;

  // 2. update user · 本年累计 + 历史累计（仅做记录·不用于判定）
  const update = {
    currentYearScoreFen: newYearScore,
    lifetimeContributionFen: (user.lifetimeContributionFen || 0) + deltaFen,
    lastContributionAt: nowIso,
  };
  if (source === "consume") update.consumptionContributionFen = (user.consumptionContributionFen || 0) + deltaFen;
  else if (source === "charity") update.charityContributionFen = (user.charityContributionFen || 0) + deltaFen;
  if (upgraded) {
    update.level = newLevel;
    update.levelUpgradedAt = nowIso;
  }
  await db.collection("users").doc(user._id).update({ data: update });

  // 3. 写 contribution_log（每次贡献都写 · 永久保留 · 用于审计 + 重算）
  try {
    await db.collection("contribution_log").add({
      data: {
        _openid: openid,
        deltaFen,
        source,
        refId,
        description,
        yearTag: now.getUTCFullYear(), // 用于年滚动查询
        createdAt: nowIso,
      },
    });
  } catch (e) {
    console.warn("contribution_log write failed:", e);
  }

  // 4. 写升级日志（审计）
  if (upgraded) {
    try {
      await db.collection("member_level_log").add({
        data: {
          _openid: openid,
          oldLevel,
          newLevel,
          oldLevelName: levels.find(l => l.level === oldLevel)?.name || "",
          newLevelName: newLevelConfig.name,
          triggerSource: source,
          triggerRefId: refId,
          triggerDescription: description,
          currentYearScoreFen: newYearScore,
          createdAt: nowIso,
          eventType: "upgrade",
        },
      });
    } catch {}
  }

  const nextLevelConfig = levels.find(l => l.level === newLevel + 1) || null;

  return {
    ok: true,
    oldLevel,
    newLevel,
    newLevelName: newLevelConfig.name,
    upgraded,
    currentYearScoreFen: newYearScore,
    nextLevelConfig,
  };
};
