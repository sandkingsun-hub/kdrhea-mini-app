const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  const r = await db.collection('sku')
    .where({ status: 'on_shelf', type: 'pet_food' })
    .orderBy('sortOrder', 'asc').get();
  return { ok: true, items: r.data };
};
