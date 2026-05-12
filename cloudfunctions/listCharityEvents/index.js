const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event = {}) => {
  const { status } = event;
  const where = {};
  if (status) where.status = status;
  else where.status = db.command.in(['published', 'ongoing', 'done']);
  async function safeQuery() {
    try { return await db.collection('charity_event').where(where).orderBy('scheduledAt', 'desc').get(); }
    catch (e) { return { data: [] }; }
  }
  const r = await safeQuery();
  return { ok: true, items: r.data };
};
