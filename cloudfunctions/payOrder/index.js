// payOrder · 执行支付（mock 微信支付·真实场景接 cloud.openapi.payment.unifiedOrder）
// 入参：{ orderId }
// 出参：{ ok, orderId, status, balanceAfter, selfRebateEarned, referralRewarded, rewardPoints }
//
// 流程：
// 1. 校验订单存在 + 属于本人 + status=pending_payment + 未过期
// 2. 扣库存（每个 sku stock 减 qty）
// 3. 扣积分（spendPoints · 含校验）
// 4. 改订单 status=paid · 写 paidAt · isFirstOrder 标记
// 5. 触发自消费返 2%（earnPoints · 立即到账）
// 6. 如果是首单 + user.inviterId 存在 → 推荐返 5% pending 7 天
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const SELF_RATE = 0.02;
const REFERRAL_RATE = 0.05;
const REFERRAL_PENDING_DAYS = 7;

function calcPoints(fen, rate) {
  return Math.floor(fen * rate);
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { orderId } = event;

  if (!openid) return { ok: false, code: 'NO_OPENID' };
  if (!orderId) return { ok: false, code: 'MISSING_ORDER_ID' };

  // 1. 查订单
  const order = (await db.collection('orders').doc(orderId).get()).data;
  if (!order) return { ok: false, code: 'ORDER_NOT_FOUND' };
  if (order._openid !== openid) return { ok: false, code: 'NOT_YOUR_ORDER' };
  if (order.status !== 'pending_payment') {
    return { ok: false, code: 'ORDER_STATE_INVALID', currentStatus: order.status };
  }
  if (order.expiresAt && new Date(order.expiresAt) < new Date()) {
    await db.collection('orders').doc(orderId).update({
      data: { status: 'expired', expiredAt: new Date().toISOString() },
    });
    return { ok: false, code: 'ORDER_EXPIRED' };
  }

  // 2. 扣库存（对所有有限库存的 SKU）
  for (const it of order.items) {
    const sku = (await db.collection('sku').doc(it.skuId).get()).data;
    if (!sku) return { ok: false, code: 'SKU_DISAPPEARED', skuId: it.skuId };
    if (sku.stock !== -1) {
      if (sku.stock < it.qty) {
        return { ok: false, code: 'STOCK_RAN_OUT', skuId: it.skuId, stock: sku.stock };
      }
      await db.collection('sku').doc(it.skuId).update({
        data: { stock: _.inc(-it.qty), updatedAt: new Date().toISOString() },
      });
    }
  }

  // 3. 扣积分（如果有用 pointsUsed）
  if (order.pointsUsed > 0) {
    const r = await cloud.callFunction({
      name: 'spendPoints',
      data: {
        targetOpenid: openid,
        delta: order.pointsUsed,
        type: order.paymentMethod === 'points_only' ? 'spend_redeem_sku' : 'spend_deduct',
        refType: 'order',
        refId: orderId,
        description: `订单 ${order.orderNo} ${order.paymentMethod === 'points_only' ? '纯积分兑换' : '抵扣'}`,
      },
    });
    if (!r.result || !r.result.ok) {
      // 回滚库存（如果之前扣了）
      for (const it of order.items) {
        const sku = (await db.collection('sku').doc(it.skuId).get()).data;
        if (sku && sku.stock !== -1) {
          await db.collection('sku').doc(it.skuId).update({
            data: { stock: _.inc(it.qty) },
          });
        }
      }
      return { ok: false, code: 'POINTS_SPEND_FAILED', detail: r.result };
    }
  }

  // 4. 查用户资料 · 首单改用 users.firstPaidAt 判定
  const userQ = await db.collection('users').where({ _openid: openid }).limit(1).get();
  const userDoc = userQ.data[0] || null;
  const isFirstOrder = !userDoc?.firstPaidAt;
  const inviterOpenid = userDoc?.inviterId || null;
  const now = new Date().toISOString();

  // 5. 自消费返 2%（按现金部分计算 · 不算积分抵扣那部分）
  let selfRebateEarned = 0;
  if (order.cashAmountFen > 0) {
    const selfPoints = calcPoints(order.cashAmountFen, SELF_RATE);
    if (selfPoints > 0) {
      const r = await cloud.callFunction({
        name: 'earnPoints',
        data: {
          targetOpenid: openid,
          delta: selfPoints,
          type: 'earn_self_consume',
          refType: 'order',
          refId: orderId,
          description: `订单 ${order.orderNo} 自消费返 2%`,
        },
      });
      if (r.result && r.result.ok) selfRebateEarned = selfPoints;
    }
  }

  // 6. 推荐返 5%（首单 + 有 inviter · 按现金部分）
  let rewardPoints = 0;
  let referralRewarded = false;
  if (isFirstOrder && inviterOpenid && order.cashAmountFen > 0) {
    rewardPoints = calcPoints(order.cashAmountFen, REFERRAL_RATE);
    if (rewardPoints > 0) {
      const r = await cloud.callFunction({
        name: 'earnPoints',
        data: {
          targetOpenid: inviterOpenid,
          delta: rewardPoints,
          type: 'earn_referral',
          refType: 'order',
          refId: orderId,
          description: `朋友 ${openid.slice(0, 8)} 首单 ¥${(order.cashAmountFen / 100).toFixed(2)} · 推荐返 5%`,
          pendingDays: REFERRAL_PENDING_DAYS,
        },
      });
      referralRewarded = !!(r.result && r.result.ok);

      // 同步 referral_links 累计
      if (referralRewarded && userDoc?.inviterChannel) {
        const linkQuery = await db
          .collection('referral_links')
          .where({ inviterOpenid, channel: userDoc.inviterChannel })
          .limit(1)
          .get();
        if (linkQuery.data.length > 0) {
          await db.collection('referral_links').doc(linkQuery.data[0]._id).update({
            data: {
              conversions: _.inc(1),
              totalGmvFromConversion: _.inc(order.cashAmountFen),
            },
          });
        }
      }

      // 首次现金交易打点（仅首次+现金单）
      if (referralRewarded && userDoc && !userDoc.firstPaidAt) {
        await db.collection('users').doc(userDoc._id).update({
          data: {
            firstPaidAt: now,
            firstPaidChannel: 'online',
          },
        });
      }
    }
  }

  // 首次现金交易打点（无 inviter / 推荐积分=0 也要落）
  if (isFirstOrder && order.cashAmountFen > 0 && userDoc && !userDoc.firstPaidAt && !referralRewarded) {
    await db.collection('users').doc(userDoc._id).update({
      data: {
        firstPaidAt: now,
        firstPaidChannel: 'online',
      },
    });
  }

  // 6. 改订单 status=paid · 持久化返利结果（便于退款回滚）
  await db.collection('orders').doc(orderId).update({
    data: {
      status: 'paid',
      paidAt: now,
      isFirstOrder,
      inviterOpenid,
      selfRebateEarned,
      referralRewarded,
      rewardPoints,
    },
  });

  // 7. 自动入袋：含 experience_voucher / physical_gift 类型的 SKU 发对应券
  // 礼遇兑换走这条路径
  const couponsGranted = [];
  for (const it of order.items) {
    const sku = (await db.collection('sku').doc(it.skuId).get()).data;
    if (!sku) continue;
    const couponType = sku.type === 'experience_voucher' ? 'experience'
      : sku.type === 'physical_gift' ? 'physical_gift'
      : null;
    if (!couponType) continue;

    // qty 张券
    for (let q = 0; q < it.qty; q++) {
      const r = await cloud.callFunction({
        name: 'grantCoupon',
        data: {
          targetOpenid: openid,
          couponName: sku.name,
          couponType,
          value: sku.description || '',
          description: sku.description || '',
          validDays: 180,
          source: 'gifts_redeem',
          sourceRefId: orderId,
          sourceRefType: 'order',
          __internal_caller: 'payOrder',
        },
      });
      if (r.result?.ok) {
        couponsGranted.push({ couponId: r.result.couponId, couponNo: r.result.couponNo, couponName: sku.name });
      }
    }
  }

  // 拉最终账户余额
  const finalAcc = await db.collection('points_account').where({ _openid: openid }).limit(1).get();
  const balanceAfter = finalAcc.data[0]?.balance ?? 0;

  return {
    ok: true,
    orderId,
    orderNo: order.orderNo,
    status: 'paid',
    cashAmountFen: order.cashAmountFen,
    pointsUsed: order.pointsUsed,
    isFirstOrder,
    selfRebateEarned,
    referralRewarded,
    rewardPoints,
    inviterOpenid,
    balanceAfter,
    couponsGranted,
  };
};
