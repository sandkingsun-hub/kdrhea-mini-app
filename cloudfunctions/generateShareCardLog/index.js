const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function ensureCollection(name) {
  try { await db.collection(name).count(); }
  catch (e) {
    if (String(e).includes('not exist')) {
      try { await db.createCollection(name); } catch {}
    }
  }
}

exports.main = async (event = {}) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return { ok: false, code: 'NO_OPENID' };
  const { snapshot } = event;
  if (!snapshot) return { ok: false, code: 'MISSING_SNAPSHOT' };

  await ensureCollection('share_card_log');

  const log = await db.collection('share_card_log').add({
    data: {
      openid,
      cardType: 'charity_certificate',
      dataSnapshot: snapshot,
      generatedAt: new Date().toISOString(),
    },
  });

  return { ok: true, logId: log._id };
};
