// devSeedPetSpecies · DEV ONLY · 一次性灌入 2 个品种
// 入参: { force?: boolean } · force=true 覆盖已存在记录
// 出参: { ok, inserted, skipped }
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const SEED = [
  {
    _id: 'cat_orange',
    name_cn: '橘猫',
    name_en: 'Orange Tabby',
    spriteUrl: 'cloud://_placeholder.png',
    spriteGrid: { cols: 4, rows: 3 },
    spriteFrameSize: { w: 96, h: 96 },
    frames: {
      idle: { row: 0, col: 0, count: 4, fps: 4 },
      happy: { row: 1, col: 0, count: 4, fps: 8 },
      sleeping: { row: 2, col: 0, count: 2, fps: 2 },
    },
    defaultSkinId: null,
    unlockCondition: null,
    status: 'on_shelf',
  },
  {
    _id: 'dog_shiba',
    name_cn: '柴犬',
    name_en: 'Shiba Inu',
    spriteUrl: 'cloud://_placeholder.png',
    spriteGrid: { cols: 4, rows: 3 },
    spriteFrameSize: { w: 96, h: 96 },
    frames: {
      idle: { row: 0, col: 0, count: 4, fps: 4 },
      happy: { row: 1, col: 0, count: 4, fps: 8 },
      sleeping: { row: 2, col: 0, count: 2, fps: 2 },
    },
    defaultSkinId: null,
    unlockCondition: null,
    status: 'on_shelf',
  },
];

async function ensureCollection(name) {
  try {
    await db.collection(name).count();
  } catch (e) {
    if (String(e).includes('not exist')) {
      try { await db.createCollection(name); } catch {}
    }
  }
}

exports.main = async (event = {}) => {
  const { force = false } = event;
  await ensureCollection('pet_species');
  const col = db.collection('pet_species');
  const now = new Date().toISOString();
  let inserted = 0, skipped = 0;

  for (const seed of SEED) {
    const data = { ...seed, createdAt: now, updatedAt: now };
    try {
      await col.doc(seed._id).get();
      if (force) {
        await col.doc(seed._id).set({ data });
        inserted++;
      } else {
        skipped++;
      }
    } catch (e) {
      // doc 不存在
      await col.add({ data });
      inserted++;
    }
  }

  return { ok: true, inserted, skipped };
};
