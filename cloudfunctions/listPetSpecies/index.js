const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  const r = await db.collection('pet_species').where({ status: 'on_shelf' }).get();
  return { ok: true, items: r.data };
};
