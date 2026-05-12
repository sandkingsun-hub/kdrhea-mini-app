const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const SEED = [{
  _id: 'xuzhou_animal_rescue',
  name_cn: '徐州小动物救助协会',
  name_en: 'Xuzhou Animal Rescue',
  description: '5A 资质 · 月度公示账目（占位 · Phase 0 由 Nick 确认）',
  logoUrl: 'cloud://_placeholder.png',
  protocolUrl: '',
  bankInfo: {},
  status: 'active',
}];

async function ensureCollection(name) {
  try { await db.collection(name).count(); }
  catch (e) {
    if (String(e).includes('not exist')) {
      try { await db.createCollection(name); } catch {}
    }
  }
}

exports.main = async (event = {}) => {
  const { force = false } = event;
  await ensureCollection('charity_org');
  const col = db.collection('charity_org');
  const now = new Date().toISOString();
  let inserted = 0, skipped = 0;
  for (const seed of SEED) {
    const data = { ...seed, createdAt: now, updatedAt: now };
    try {
      await col.doc(seed._id).get();
      if (force) { await col.doc(seed._id).set({ data }); inserted++; } else skipped++;
    } catch (e) { await col.add({ data }); inserted++; }
  }
  return { ok: true, inserted, skipped };
};
