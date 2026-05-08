// seedSku · 一次性塞测试 SKU 数据 · dev 用 · 上线前删除
// 入参：{ force?: boolean } · force=true 清掉旧的重塞
// 出参：{ ok, inserted, skipped }
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const TEST_SKUS = [
  {
    type: 'service',
    name: '韩国艾莉薇玻尿酸 1ml',
    category: '医美注射',
    priceFen: 280000,
    pointsOnly: false,
    pointsRequired: 0,
    pointsDeductibleMaxRatio: 0.7,
    cover: 'cloud://example.placeholder/aliv-1ml.jpg',
    description: '欧洲原装·进口正品·1ml 注射',
    status: 'on_shelf',
    stock: -1,
  },
  {
    type: 'service',
    name: '热玛吉 FLX 600 发',
    category: '医美抗衰',
    priceFen: 1880000,
    pointsOnly: false,
    pointsRequired: 0,
    pointsDeductibleMaxRatio: 0.7,
    cover: 'cloud://example.placeholder/thermage.jpg',
    description: '美国 Solta 原厂·600 发量·正品溯源',
    status: 'on_shelf',
    stock: -1,
  },
  {
    type: 'service',
    name: '光子嫩肤 M22 单次',
    category: '医美光电',
    priceFen: 80000,
    pointsOnly: false,
    pointsRequired: 0,
    pointsDeductibleMaxRatio: 0.7,
    cover: 'cloud://example.placeholder/m22.jpg',
    description: '科医人 M22 平台·单次体验',
    status: 'on_shelf',
    stock: -1,
  },
  {
    type: 'experience_voucher',
    name: 'VIP 体验日 · 半日 SPA',
    category: '体验',
    priceFen: 0,
    pointsOnly: true,
    pointsRequired: 50000,
    pointsDeductibleMaxRatio: 0,
    cover: 'cloud://example.placeholder/spa.jpg',
    description: '使用 50000 积分兑换·含半日护理 + 茶歇',
    status: 'on_shelf',
    stock: 20,
  },
  {
    type: 'physical_gift',
    name: 'KDRHEA 香薰礼盒',
    category: '文创周边',
    priceFen: 0,
    pointsOnly: true,
    pointsRequired: 30000,
    pointsDeductibleMaxRatio: 0,
    cover: 'cloud://example.placeholder/aroma.jpg',
    description: '徐州门店自取·30000 积分兑换',
    status: 'on_shelf',
    stock: 50,
  },
];

exports.main = async (event = {}) => {
  const { force = false } = event;
  const col = db.collection('sku');

  if (force) {
    // 先清掉所有 [seed] 标记的 SKU
    const all = await col.where({ _seedTag: 'auto' }).get();
    for (const doc of all.data) {
      await col.doc(doc._id).remove();
    }
  }

  const now = new Date().toISOString();
  let inserted = 0;
  let skipped = 0;

  for (const sku of TEST_SKUS) {
    // 检查是否已存在（按 name 唯一）
    const existing = await col.where({ name: sku.name }).count();
    if (existing.total > 0 && !force) {
      skipped++;
      continue;
    }
    await col.add({
      data: { ...sku, createdAt: now, updatedAt: now, _seedTag: 'auto' },
    });
    inserted++;
  }

  return { ok: true, inserted, skipped };
};
