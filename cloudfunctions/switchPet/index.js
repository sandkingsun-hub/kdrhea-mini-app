const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event = {}) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return { ok: false, code: 'NO_OPENID' };
  const { speciesId } = event;
  if (!speciesId) return { ok: false, code: 'MISSING_SPECIES' };

  let pet;
  try { pet = (await db.collection('pet_state').doc(openid).get()).data; }
  catch (e) { return { ok: false, code: 'PET_NOT_INIT' }; }

  if (!pet.ownedSpeciesIds.includes(speciesId)) {
    return { ok: false, code: 'NOT_OWNED' };
  }

  await db.collection('pet_state').doc(openid).update({
    data: { currentSpeciesId: speciesId, currentSkinId: null, updatedAt: new Date().toISOString() },
  });
  return { ok: true };
};
