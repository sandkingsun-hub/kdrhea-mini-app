const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// V1 不预设皮肤 · 用户初始无皮肤 · 用 species 默认 sprite
// Phase 2+ 由 PixelLab.ai 生成季节皮肤后 force=true 灌入
const SEED = [];

exports.main = async () => {
  return { ok: true, inserted: 0, skipped: 0, message: 'V1: no skin seeded by design' };
};
