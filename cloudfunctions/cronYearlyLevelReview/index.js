// cronYearlyLevelReview · 每年 1/1 凌晨跑批 · 保级判定 + 当年得分归零
// 触发器: timer @ "0 0 1 1 1 *"（每年 1/1 01:00 UTC=09:00 北京）
// 入: { dryRun?: bool } 手动 invoke 用于测试
// 出: { ok, processed, demoted, kept, errors }
//
// 流程:
//   1. 扫所有 level >= 1 用户
//   2. 看 currentYearScoreFen vs 当前等级阈值
//   3. < 阈值 → 降一级 · 写降级日志
//   4. 把 currentYearScoreFen → lastYearScoreFen · 当年归 0
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const FALLBACK_LEVELS = [
  { level: 0, name: "VISITOR", thresholdFen: 0 },
  { level: 1, name: "INITIAL", thresholdFen: 68000 },
  { level: 2, name: "PRIME", thresholdFen: 1000000 },
  { level: 3, name: "APEX", thresholdFen: 3000000 },
  { level: 4, name: "SOVEREIGN", thresholdFen: 5000000 },
  { level: 5, name: "ETERNAL", thresholdFen: 7000000 },
];

async function loadLevels() {
  try {
    const r = await db.collection("member_level_config").orderBy("level", "asc").get();
    if (r.data.length >= 2) return r.data;
  } catch {}
  return FALLBACK_LEVELS;
}

exports.main = async (event = {}) => {
  const { dryRun = false } = event;
  const levels = await loadLevels();
  const now = new Date().toISOString();
  let processed = 0, demoted = 0, kept = 0, errors = 0;
  const sample = [];

  // 分批扫所有 level >= 1 用户
  const PAGE = 100;
  let skip = 0;
  while (true) {
    let batch;
    try {
      batch = await db.collection("users")
        .where({ level: db.command.gte(1) })
        .skip(skip)
        .limit(PAGE)
        .get();
    } catch (e) {
      console.error("query users failed:", e);
      break;
    }
    if (batch.data.length === 0) break;

    for (const user of batch.data) {
      processed += 1;
      const oldLevel = user.level || 0;
      const oldLevelConfig = levels.find(l => l.level === oldLevel);
      const yearScore = user.currentYearScoreFen || 0;
      // 上一年得分不达当前等级阈值 · 降一级
      const shouldDemote = oldLevelConfig && yearScore < oldLevelConfig.thresholdFen && oldLevel > 0;
      const newLevel = shouldDemote ? oldLevel - 1 : oldLevel;

      if (sample.length < 3) {
        sample.push({
          openid: user._openid?.slice(0, 12),
          oldLevel,
          yearScore,
          threshold: oldLevelConfig?.thresholdFen,
          newLevel,
          demoted: shouldDemote,
        });
      }

      if (dryRun) {
        if (shouldDemote) demoted += 1; else kept += 1;
        continue;
      }

      try {
        // 把当年得分挪到上一年 · 当年归 0
        const update = {
          lastYearScoreFen: yearScore,
          currentYearScoreFen: 0,
          yearlyReviewedAt: now,
        };
        if (shouldDemote) {
          update.level = newLevel;
          update.levelDemotedAt = now;
        }
        await db.collection("users").doc(user._id).update({ data: update });

        if (shouldDemote) {
          demoted += 1;
          await db.collection("member_level_log").add({
            data: {
              _openid: user._openid,
              oldLevel,
              newLevel,
              oldLevelName: oldLevelConfig?.name || "",
              newLevelName: levels.find(l => l.level === newLevel)?.name || "",
              triggerSource: "yearly_review",
              triggerDescription: `年度保级判定 · 上一年累计 ¥${(yearScore / 100).toFixed(2)} 未达 ¥${(oldLevelConfig?.thresholdFen / 100).toFixed(2)}`,
              currentYearScoreFen: 0,
              lastYearScoreFen: yearScore,
              createdAt: now,
              eventType: "demote",
            },
          });
        } else {
          kept += 1;
        }
      } catch (e) {
        errors += 1;
        console.error("update user failed:", user._openid, e);
      }
    }

    if (batch.data.length < PAGE) break;
    skip += PAGE;
  }

  return { ok: true, processed, demoted, kept, errors, dryRun, sample };
};
