// listSku · 列出在售 SKU
// 入参：{ category?, type?, limit?: 20, skip?: 0 }
// 出参：{ ok, items, total }
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event = {}) => {
  const { category = null, type = null, limit = 20, skip = 0 } = event;

  const where = { status: 'on_shelf' };
  if (category) where.category = category;
  if (type) where.type = type;

  const cap = Math.min(limit, 100);

  const [list, count] = await Promise.all([
    db.collection('sku').where(where).orderBy('updatedAt', 'desc').skip(skip).limit(cap).get(),
    db.collection('sku').where(where).count(),
  ]);

  return {
    ok: true,
    items: list.data,
    total: count.total,
    skip,
    limit: cap,
  };
};
