// getPetPanel · 公益页所需全部数据 · 一次返
// 入参: {}
// 出参: { ok, pet, species, skin, badges, charity: { totalContributionFen, currentMonthFen, currentOrg } }
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const DEFAULT_PET = {
  currentSpeciesId: 'cat_orange',
  currentSkinId: null,
  level: 1,
  experience: 0,
  totalExperience: 0,
  totalContributionFen: 0,
  ownedSpeciesIds: ['cat_orange', 'dog_shiba'],
  ownedSkinIds: [],
  lastFedAt: null,
};

async function ensureCollection(name) {
  try { await db.collection(name).count(); }
  catch (e) {
    if (String(e).includes('not exist')) {
      try { await db.createCollection(name); } catch {}
    }
  }
}

function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  return { start, end };
}

exports.main = async () => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { ok: false, code: 'NO_OPENID' };

  await ensureCollection('pet_state');
  await ensureCollection('user_badge');
  await ensureCollection('charity_ledger');

  // 1. 拿/初始化 pet_state
  let pet;
  try {
    const r = await db.collection('pet_state').doc(openid).get();
    pet = r.data;
  } catch (e) {
    const now = new Date().toISOString();
    pet = { ...DEFAULT_PET, createdAt: now, updatedAt: now };
    await db.collection('pet_state').add({ data: { _id: openid, ...pet } });
  }

  // 2. species
  const speciesR = await db.collection('pet_species').doc(pet.currentSpeciesId).get();
  const species = speciesR.data;

  // 3. skin
  let skin = null;
  if (pet.currentSkinId) {
    try { skin = (await db.collection('pet_skin').doc(pet.currentSkinId).get()).data; } catch (e) {}
  }

  // 4. badges
  const badgesR = await db.collection('user_badge').where({ openid }).orderBy('displayOrder', 'asc').get();

  // 5. charity 当月累计
  const { start, end } = currentMonthRange();
  let currentMonthFen = 0;
  try {
    const r = await db.collection('charity_ledger')
      .aggregate()
      .match({ openid, createdAt: _.gte(start).and(_.lt(end)) })
      .group({ _id: null, total: _.aggregate.sum('$amountFen') })
      .end();
    currentMonthFen = r.list[0]?.total || 0;
  } catch (e) { /* 集合空·sum 返 0 */ }

  // 6. 当前默认公益机构
  const orgR = await db.collection('charity_org').where({ status: 'active' }).limit(1).get();
  const currentOrg = orgR.data[0] || null;

  return {
    ok: true,
    pet,
    species,
    skin,
    badges: badgesR.data,
    charity: {
      totalContributionFen: pet.totalContributionFen || 0,
      currentMonthFen,
      currentOrg,
    },
  };
};
