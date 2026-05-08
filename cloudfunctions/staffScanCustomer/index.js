// staffScanCustomer · 员工扫客户码后调
// 入参：{ customerOpenid, action, amountFen?, points?, description? }
//   - action: 'log_offline_consume'（线下消费返利 2%·按 amountFen）
//             'spend_for_consume'（积分抵扣线下消费·按 points）
//             'reward_in_store_qr'（到店打卡补贴·固定积分）
// 出参：{ ok, action, balanceAfter, log }
//
// 安全：
// - 仅 user.role in [staff, admin] 才能调
// - 客户 openid 必须存在
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const SELF_RATE = 0.02; // 线下消费返 2%

async function getMyRole(openid) {
  const q = await db.collection('users').where({ _openid: openid }).limit(1).get();
  return q.data[0]?.role || 'customer';
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const callerOpenid = wxContext.OPENID;
  const { customerOpenid, action, amountFen, points, description } = event;

  if (!callerOpenid)
    return { ok: false, code: 'NO_OPENID' };

  // 权限校验
  const role = await getMyRole(callerOpenid);
  if (role !== 'staff' && role !== 'admin')
    return { ok: false, code: 'PERMISSION_DENIED', role };

  if (!customerOpenid)
    return { ok: false, code: 'MISSING_CUSTOMER' };
  if (callerOpenid === customerOpenid)
    return { ok: false, code: 'SELF_OPERATION' };

  // 校验客户存在
  const cust = await db.collection('users').where({ _openid: customerOpenid }).limit(1).get();
  if (cust.data.length === 0)
    return { ok: false, code: 'CUSTOMER_NOT_FOUND' };

  if (action === 'log_offline_consume') {
    if (!Number.isInteger(amountFen) || amountFen <= 0)
      return { ok: false, code: 'INVALID_AMOUNT' };
    const earnPoints = Math.floor(amountFen * SELF_RATE);
    if (earnPoints <= 0)
      return { ok: false, code: 'AMOUNT_TOO_SMALL' };
    const r = await cloud.callFunction({
      name: 'earnPoints',
      data: {
        targetOpenid: customerOpenid,
        delta: earnPoints,
        type: 'earn_self_consume',
        refType: 'offline_scan',
        refId: callerOpenid,
        description: description || `线下消费 ¥${(amountFen / 100).toFixed(2)} 返 2%`,
      },
    });
    return {
      ok: r.result?.ok || false,
      action,
      amountFen,
      pointsEarned: earnPoints,
      balanceAfter: r.result?.balanceAfter,
      detail: r.result,
    };
  }

  if (action === 'spend_for_consume') {
    if (!Number.isInteger(points) || points <= 0)
      return { ok: false, code: 'INVALID_POINTS' };
    const r = await cloud.callFunction({
      name: 'spendPoints',
      data: {
        targetOpenid: customerOpenid,
        delta: points,
        type: 'spend_deduct',
        refType: 'offline_scan',
        refId: callerOpenid,
        description: description || `线下抵扣 ${points} 积分`,
      },
    });
    return {
      ok: r.result?.ok || false,
      action,
      pointsSpent: points,
      balanceAfter: r.result?.balanceAfter,
      detail: r.result,
    };
  }

  if (action === 'reward_in_store_qr') {
    const grant = points && points > 0 ? points : 500;
    const r = await cloud.callFunction({
      name: 'earnPoints',
      data: {
        targetOpenid: customerOpenid,
        delta: grant,
        type: 'earn_in_store_qr',
        refType: 'in_store_checkin',
        refId: callerOpenid,
        description: description || `到店打卡 +${grant} 积分`,
      },
    });
    return {
      ok: r.result?.ok || false,
      action,
      pointsEarned: grant,
      balanceAfter: r.result?.balanceAfter,
      detail: r.result,
    };
  }

  return { ok: false, code: 'INVALID_ACTION' };
};
