// devSeedPendingActivation · DEV ONLY · 上线前删除
// 给 pending_activation 表插一条测试数据·模拟 T-1 一次性预灌脚本的产物
// 入参：{ phone, pointsToGrant?, totalConsumeWindow? }
// 出参：{ ok, phoneHash, doc }
const cloud = require('wx-server-sdk');
const crypto = require('node:crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

exports.main = async (event = {}) => {
  const { phone, pointsToGrant = 50000, totalConsumeWindow = 1000000 } = event;
  if (!phone) return { ok: false, code: 'MISSING_PHONE' };

  const phoneHash = sha256(String(phone));
  const now = new Date().toISOString();
  const cutoffDate = new Date(Date.now() - 730 * 86400000).toISOString().slice(0, 10);

  const doc = {
    _id: phoneHash,
    phoneHash,
    pointsToGrant,
    totalConsumeWindow,
    consumeCutoffDate: cutoffDate,
    ruleVersion: 'v1.0',
    preloadedAt: now,
    consumed: false,
    consumedBy: null,
    consumedAt: null,
  };

  // upsert：先尝试删旧的·再插新的
  try {
    await db.collection('pending_activation').doc(phoneHash).remove();
  } catch (e) {
    // 不存在·正常
  }
  await db.collection('pending_activation').add({ data: doc });

  return { ok: true, phoneHash, doc };
};
