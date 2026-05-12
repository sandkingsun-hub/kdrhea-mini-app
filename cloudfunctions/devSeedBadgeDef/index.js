const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const SEED = [
  {
    _id: 'love_companion_bronze',
    name_cn: '爱心同行者 · 铜',
    name_en: 'Love Companion · Bronze',
    iconUrl: 'cloud://_placeholder.png',
    tier: 'bronze',
    unlock: { type: 'pet_level', threshold: 8 },
    perks: ['charity_event_register'],
    displayOnHome: true,
    status: 'active',
  },
  {
    _id: 'love_companion_silver',
    name_cn: '爱心同行者 · 银',
    name_en: 'Love Companion · Silver',
    iconUrl: 'cloud://_placeholder.png',
    tier: 'silver',
    unlock: { type: 'pet_level', threshold: 9 },
    perks: ['charity_event_register', 'wall_signature'],
    displayOnHome: true,
    status: 'active',
  },
  {
    _id: 'love_companion_gold',
    name_cn: '爱心同行者 · 金',
    name_en: 'Love Companion · Gold',
    iconUrl: 'cloud://_placeholder.png',
    tier: 'gold',
    unlock: { type: 'pet_level', threshold: 10 },
    perks: ['charity_event_register', 'wall_signature', 'annual_archive'],
    displayOnHome: true,
    status: 'active',
  },
];

async function ensureCollection(name) {
  try { await db.collection(name).count(); }
  catch (e) {
    if (String(e).includes('not exist')) {
      try { await db.createCollection(name); } catch {}
    }
  }
}

exports.main = async (event = {}) => {
  const { force = false } = event;
  await ensureCollection('badge_def');
  const col = db.collection('badge_def');
  const now = new Date().toISOString();
  let inserted = 0, skipped = 0;
  for (const seed of SEED) {
    const data = { ...seed, createdAt: now };
    try {
      await col.doc(seed._id).get();
      if (force) { await col.doc(seed._id).set({ data }); inserted++; }
      else skipped++;
    } catch (e) {
      await col.add({ data });
      inserted++;
    }
  }
  return { ok: true, inserted, skipped };
};
