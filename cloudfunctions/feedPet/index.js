// feedPet · 喂宠物核心事务
// 入参: { skuId }
// 出参: {
//   ok, code?, newLevel, levelUps, newBadges,
//   charityAddedFen, pointsAfter, petAfter
// }
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 升级阶梯（plan Section 4.2）
const LEVEL_THRESHOLDS = [
  0,      // Lv1 起点
  80,     // Lv1→Lv2
  320,    // Lv2→Lv3
  800,    // Lv3→Lv4
  1800,   // Lv4→Lv5
  3000,   // Lv5→Lv6
  4000,   // Lv6→Lv7
  6000,   // Lv7→Lv8
  9000,   // Lv8→Lv9
  15000,  // Lv9→Lv10
];

function calcLevelUp(currentLevel, currentExp, addedExp) {
  let level = currentLevel;
  let exp = currentExp + addedExp;
  const levelUps = [];
  while (level < 10 && exp >= LEVEL_THRESHOLDS[level]) {
    exp -= LEVEL_THRESHOLDS[level];
    level++;
    levelUps.push(level);
  }
  return { newLevel: level, newExp: exp, levelUps };
}

async function ensureCollection(name) {
  try { await db.collection(name).count(); }
  catch (e) {
    if (String(e).includes('not exist')) {
      try { await db.createCollection(name); } catch {}
    }
  }
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { ok: false, code: 'NO_OPENID' };

  const { skuId } = event;
  if (!skuId) return { ok: false, code: 'MISSING_SKU' };

  // 1. 查 SKU
  let sku;
  try { sku = (await db.collection('sku').doc(skuId).get()).data; }
  catch (e) { return { ok: false, code: 'SKU_NOT_FOUND' }; }
  if (sku.type !== 'pet_food' || sku.status !== 'on_shelf') {
    return { ok: false, code: 'SKU_NOT_AVAILABLE' };
  }

  // 2. 扣积分
  const spendR = await cloud.callFunction({
    name: 'spendPoints',
    data: { delta: sku.pointsPrice, type: 'spend_pet_food', refType: 'sku', refId: skuId, description: `喂宠 ${sku.name}` },
  });
  if (!spendR.result || !spendR.result.ok) {
    return { ok: false, code: 'SPEND_FAILED', detail: spendR.result };
  }
  const pointsAfter = spendR.result.balanceAfter;
  const pointsLogId = spendR.result.logId;

  // 3. 拿 pet_state（或初始化）
  await ensureCollection('pet_state');
  await ensureCollection('charity_ledger');
  await ensureCollection('user_badge');

  let pet;
  try { pet = (await db.collection('pet_state').doc(openid).get()).data; }
  catch (e) {
    pet = {
      _id: openid,
      currentSpeciesId: 'cat_orange',
      currentSkinId: null,
      level: 1, experience: 0, totalExperience: 0, totalContributionFen: 0,
      ownedSpeciesIds: ['cat_orange', 'dog_shiba'],
      ownedSkinIds: [],
      lastFedAt: null,
      createdAt: new Date().toISOString(),
    };
    await db.collection('pet_state').add({ data: pet });
  }

  // 4. 升级判定
  const { newLevel, newExp, levelUps } = calcLevelUp(pet.level, pet.experience, sku.experience);

  // 5. 公益记账
  const charityAddedFen = Math.floor(sku.priceFen * sku.charityRatio);
  const orgR = await db.collection('charity_org').where({ status: 'active' }).limit(1).get();
  const orgId = orgR.data[0]?._id || 'xuzhou_animal_rescue';
  const now = new Date().toISOString();
  await db.collection('charity_ledger').add({
    data: {
      openid, amountFen: charityAddedFen,
      sourceType: 'spend_pet_food', sourceRefId: pointsLogId,
      orgId, status: 'pending',
      settledMonth: null, settledAt: null,
      createdAt: now,
    },
  });

  // 6. 更新 pet_state
  const petUpdate = {
    level: newLevel,
    experience: newExp,
    totalExperience: _.inc(sku.experience),
    totalContributionFen: _.inc(charityAddedFen),
    lastFedAt: now,
    updatedAt: now,
  };
  await db.collection('pet_state').doc(openid).update({ data: petUpdate });

  // 7. 徽章颁发
  const newBadges = [];
  if (levelUps.length > 0) {
    const badgesR = await db.collection('badge_def').where({ status: 'active', 'unlock.type': 'pet_level' }).get();
    for (const badge of badgesR.data) {
      if (newLevel >= badge.unlock.threshold) {
        const existR = await db.collection('user_badge').where({ openid, badgeId: badge._id }).limit(1).get();
        if (existR.data.length === 0) {
          await db.collection('user_badge').add({
            data: {
              openid, badgeId: badge._id,
              earnedAt: now,
              displayOrder: badge.tier === 'gold' ? 1 : badge.tier === 'silver' ? 2 : 3,
            },
          });
          newBadges.push(badge._id);
        }
      }
    }
  }

  return {
    ok: true,
    newLevel, levelUps, newBadges,
    charityAddedFen, pointsAfter,
    petAfter: { ...pet, level: newLevel, experience: newExp, totalContributionFen: (pet.totalContributionFen || 0) + charityAddedFen },
  };
};
