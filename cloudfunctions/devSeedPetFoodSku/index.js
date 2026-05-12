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
    speciesRestrict: null,
    description: '日常喂养 · 每袋给宠物 +15 经验 · KDRHEA 1:1 配捐',
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
    speciesRestrict: null,
    description: '主推 · +80 经验 · KDRHEA 1:1 配捐',
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
    speciesRestrict: null,
    description: '进阶 · +250 经验 · KDRHEA 1:1 配捐',
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
  let inserted = 0, skipped = 0, updated = 0;
  for (const seed of SEED) {
    const data = { ...seed, updatedAt: now };
    // 用 where 检测存在性（doc.get 在某些情况下行为不可靠）
    const existR = await col.where({ _id: seed._id }).limit(1).get();
    if (existR.data && existR.data.length > 0) {
      if (force) {
        // wx-server-sdk 没有真正的 replace · update/set 都是 merge
        // 要清理旧字段（如 charityRatio）必须 remove + add
        await col.doc(seed._id).remove();
        await col.add({ data: { ...data, createdAt: now } });
        updated++;
      } else {
        skipped++;
      }
    } else {
      await col.add({ data: { ...data, createdAt: now } });
      inserted++;
    }
  }
  return { ok: true, inserted, updated, skipped };
};
