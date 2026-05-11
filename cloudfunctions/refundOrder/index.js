// refundOrder · 订单退款回滚（不含微信现金退款）
// 入参：{ adminToken, orderId, reason? }
// 出参：{ ok, orderId, refundedAt, stockReturned, pointsReturned, selfRebateRevoked, referralRevoked, couponsRevoked }
//
// 说明：
// - 只处理系统内库存/积分/券回滚
// - 实际微信退款需管理员在商户后台手工操作
const crypto = require('node:crypto');
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const SELF_RATE = 0.02;
const SECRET = process.env.ADMIN_AUTH_SECRET || 'kd-admin-dev-secret-change-me';

function hmac(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 32);
}

function b64urlDecode(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig || hmac(encoded) !== sig) return null;
  try {
    const payload = JSON.parse(b64urlDecode(encoded));
    if (!payload || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    if (payload.role !== 'admin') return null;
    return payload;
  } catch {
    return null;
  }
}

function calcPoints(fen, rate) {
  return Math.floor((fen || 0) * rate);
}

async function getOrCreatePointsAccount(openid, now) {
  const q = await db.collection('points_account').where({ _openid: openid }).limit(1).get();
  if (q.data.length > 0) return q.data[0];
  const inserted = await db.collection('points_account').add({
    data: {
      _openid: openid,
      balance: 0,
      totalEarned: 0,
      totalSpent: 0,
      pendingPoints: 0,
      lastUpdatedAt: now,
    },
  });
  return {
    _id: inserted._id,
    _openid: openid,
    balance: 0,
    totalEarned: 0,
    totalSpent: 0,
    pendingPoints: 0,
    lastUpdatedAt: now,
  };
}

async function appendSettledPointsLog({
  openid, delta, type, refType, refId, description, now,
}) {
  const acc = await getOrCreatePointsAccount(openid, now);
  const nextBalance = acc.balance + delta;
  const nextTotalEarned = delta > 0 ? acc.totalEarned + delta : acc.totalEarned;
  const nextTotalSpent = delta < 0 ? acc.totalSpent + Math.abs(delta) : acc.totalSpent;

  await db.collection('points_account').doc(acc._id).update({
    data: {
      balance: nextBalance,
      totalEarned: nextTotalEarned,
      totalSpent: nextTotalSpent,
      lastUpdatedAt: now,
    },
  });

  const inserted = await db.collection('points_log').add({
    data: {
      _openid: openid,
      delta,
      balanceAfter: nextBalance,
      type,
      refType,
      refId,
      description,
      createdAt: now,
      pendingUntil: null,
      status: 'settled',
    },
  });

  return { logId: inserted._id, balanceAfter: nextBalance };
}

exports.main = async (event = {}) => {
  const { adminToken, orderId, reason = null } = event;
  const admin = verifyAdminToken(adminToken);
  if (!admin) return { ok: false, code: 'UNAUTHORIZED' };
  if (!orderId) return { ok: false, code: 'MISSING_ORDER_ID' };

  let order;
  try {
    order = (await db.collection('orders').doc(orderId).get()).data;
  } catch (e) {
    return { ok: false, code: 'ORDER_NOT_FOUND' };
  }
  if (!order) return { ok: false, code: 'ORDER_NOT_FOUND' };
  if (order.status !== 'paid') {
    return { ok: false, code: 'ORDER_STATE_INVALID', currentStatus: order.status };
  }

  const now = new Date().toISOString();
  const customerOpenid = order._openid;
  const inviterOpenid = order.inviterOpenid || null;
  const pointsReturned = order.pointsUsed || 0;
  const selfRebateRevoked = Number.isInteger(order.selfRebateEarned)
    ? order.selfRebateEarned
    : calcPoints(order.cashAmountFen, SELF_RATE);
  const rewardPoints = Number.isInteger(order.rewardPoints) ? order.rewardPoints : 0;

  // 预计算需要撤销的券（先记录到 refundInfo）
  let couponRows = [];
  try {
    const couponQuery = await db.collection('user_coupons')
      .where({ sourceRefType: 'order', sourceRefId: orderId })
      .get();
    couponRows = couponQuery.data || [];
  } catch (e) {
    couponRows = [];
  }
  const couponIds = couponRows.map((c) => c._id);

  const refundInfo = {
    orderNo: order.orderNo || null,
    customerOpenid,
    inviterOpenid,
    pointsUsed: order.pointsUsed || 0,
    cashAmountFen: order.cashAmountFen || 0,
    selfRebateRevokedPlan: selfRebateRevoked,
    rewardPointsPlan: rewardPoints,
    couponIds,
    stockPlan: (order.items || []).map((it) => ({ skuId: it.skuId, qty: it.qty })),
    audit: {
      requestedAt: now,
      requestedBy: admin.sub || admin.uid || 'admin',
      reason: reason || null,
    },
  };

  // 先落订单退款状态+审计对象
  await db.collection('orders').doc(orderId).update({
    data: {
      status: 'refunded',
      refundedAt: now,
      refundReason: reason || null,
      refundInfo,
    },
  });

  // 还库存
  const stockReturned = [];
  for (const it of order.items || []) {
    let sku = null;
    try {
      sku = (await db.collection('sku').doc(it.skuId).get()).data;
    } catch (e) {
      sku = null;
    }
    if (sku && sku.stock !== -1) {
      await db.collection('sku').doc(it.skuId).update({
        data: { stock: _.inc(it.qty), updatedAt: now },
      });
      stockReturned.push({ skuId: it.skuId, qty: it.qty });
    }
  }

  // 退积分抵扣
  if (pointsReturned > 0) {
    await appendSettledPointsLog({
      openid: customerOpenid,
      delta: pointsReturned,
      type: 'refund_return',
      refType: 'order_refund',
      refId: orderId,
      description: `订单 ${order.orderNo} 退款返还抵扣积分`,
      now,
    });
  }

  // 撤回 2% 自消费返
  if (selfRebateRevoked > 0) {
    await appendSettledPointsLog({
      openid: customerOpenid,
      delta: -selfRebateRevoked,
      type: 'spend_refund_offset',
      refType: 'order_refund',
      refId: orderId,
      description: `订单 ${order.orderNo} 退款撤回自消费返`,
      now,
    });
  }

  // 撤回邀请者 5%
  let referralRevoked = 0;
  if (inviterOpenid) {
    const referralLogQ = await db.collection('points_log').where({
      _openid: inviterOpenid,
      type: 'earn_referral',
      refType: 'order',
      refId: orderId,
    }).limit(1).get();

    if (referralLogQ.data.length > 0) {
      const referralLog = referralLogQ.data[0];
      if (referralLog.status === 'pending') {
        await db.collection('points_log').doc(referralLog._id).update({
          data: {
            status: 'cancelled',
            cancelledAt: now,
            cancelReason: 'order_refunded',
          },
        });
        referralRevoked = referralLog.delta || rewardPoints || 0;
      } else {
        const revokePoints = referralLog.delta || rewardPoints || 0;
        if (revokePoints > 0) {
          await appendSettledPointsLog({
            openid: inviterOpenid,
            delta: -revokePoints,
            type: 'spend_referral_revoke',
            refType: 'order_refund',
            refId: orderId,
            description: `订单 ${order.orderNo} 退款撤回推荐返`,
            now,
          });
          referralRevoked = revokePoints;
        }
      }
    }
  }

  // 撤销已发体验/礼品券
  let couponsRevoked = 0;
  for (const c of couponRows) {
    if (c.status === 'revoked') continue;
    await db.collection('user_coupons').doc(c._id).update({
      data: {
        status: 'revoked',
        revokedAt: now,
        revokeReason: 'order_refunded',
      },
    });
    couponsRevoked += 1;
  }

  return {
    ok: true,
    orderId,
    refundedAt: now,
    stockReturned,
    pointsReturned,
    selfRebateRevoked,
    referralRevoked,
    couponsRevoked,
  };
};
