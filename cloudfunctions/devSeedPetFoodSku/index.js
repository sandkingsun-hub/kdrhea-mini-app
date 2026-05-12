const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const SEED = [
  {
    _id: 'sku_pet_food_small',
    name: '小袋宠粮',
    type: 'pet_food',
    category: 'pet',
    pointsOnly: true,
    priceFen: 5000,
    pointsPrice: 50,
    experience: 15,
    charityRatio: 0.5,
    speciesRestrict: null,
    description: '日常喂养 · 每袋给宠物 +15 经验',
    coverUrl: 'cloud://_placeholder.png',
    stock: -1,
    status: 'on_shelf',
    sortOrder: 10,
  },
  {
    _id: 'sku_pet_food_medium',
    name: '中袋宠粮',
    type: 'pet_food',
    category: 'pet',
    pointsOnly: true,
    priceFen: 20000,
    pointsPrice: 200,
    experience: 80,
    charityRatio: 0.6,
    speciesRestrict: null,
    description: '主推 · 性价比最高 · +80 经验 · 60% 公益折算',
    coverUrl: 'cloud://_placeholder.png',
    stock: -1,
    status: 'on_shelf',
    sortOrder: 20,
  },
  {
    _id: 'sku_pet_food_large',
    name: '大袋宠粮',
    type: 'pet_food',
    category: 'pet',
    pointsOnly: true,
    priceFen: 50000,
    pointsPrice: 500,
    experience: 250,
    charityRatio: 0.7,
    speciesRestrict: null,
    description: '进阶 · 多花多益 · +250 经验 · 70% 公益折算',
    coverUrl: 'cloud://_placeholder.png',
    stock: -1,
    status: 'on_shelf',
    sortOrder: 30,
  },
];

exports.main = async (event = {}) => {
  const { force = false } = event;
  const col = db.collection('sku');
  const now = new Date().toISOString();
  let inserted = 0, skipped = 0;
  for (const seed of SEED) {
    const data = { ...seed, createdAt: now, updatedAt: now };
    try {
      await col.doc(seed._id).get();
      if (force) { await col.doc(seed._id).set({ data }); inserted++; } else skipped++;
    } catch (e) { await col.add({ data }); inserted++; }
  }
  return { ok: true, inserted, skipped };
};
