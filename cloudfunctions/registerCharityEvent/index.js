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
  const { eventId } = event;
  if (!eventId) return { ok: false, code: 'MISSING_EVENT' };

  await ensureCollection('charity_event_participant');

  let evt;
  try { evt = (await db.collection('charity_event').doc(eventId).get()).data; }
  catch (e) { return { ok: false, code: 'EVENT_NOT_FOUND' }; }
  if (evt.status !== 'published') return { ok: false, code: 'EVENT_NOT_OPEN' };

  const badgesR = await db.collection('user_badge').where({ openid }).get();
  if (badgesR.data.length === 0) return { ok: false, code: 'BADGE_REQUIRED' };

  const highest = badgesR.data.find(b => b.badgeId.endsWith('gold'))
    || badgesR.data.find(b => b.badgeId.endsWith('silver'))
    || badgesR.data[0];

  const existR = await db.collection('charity_event_participant')
    .where({ eventId, openid }).limit(1).get();
  if (existR.data.length > 0) return { ok: false, code: 'ALREADY_REGISTERED' };

  const countR = await db.collection('charity_event_participant')
    .where({ eventId, status: db.command.in(['registered', 'confirmed', 'attended']) }).count();
  if (countR.total >= (evt.capacity || 999)) return { ok: false, code: 'EVENT_FULL' };

  await db.collection('charity_event_participant').add({
    data: {
      eventId, openid,
      registeredAt: new Date().toISOString(),
      status: 'registered',
      eligibleVia: highest.badgeId,
      notes: '',
    },
  });

  return { ok: true };
};
