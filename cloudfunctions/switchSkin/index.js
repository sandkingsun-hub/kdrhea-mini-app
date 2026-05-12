const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event = {}) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return { ok: false, code: 'NO_OPENID' };
  const { skinId } = event;

  let pet;
  try { pet = (await db.collection('pet_state').doc(openid).get()).data; }
  catch (e) { return { ok: false, code: 'PET_NOT_INIT' }; }

  if (skinId !== null && !pet.ownedSkinIds.includes(skinId)) {
    return { ok: false, code: 'NOT_OWNED' };
  }

  await db.collection('pet_state').doc(openid).update({
    data: { currentSkinId: skinId, updatedAt: new Date().toISOString() },
  });
  return { ok: true };
};
