// simulateFirstOrder · 模拟用户首单完成 · 触发推荐返
// 入参：{ orderTotalFen }（默认 30000 = ¥300）
// 出参：{ ok, orderId, isFirstOrder, referralRewarded, rewardPoints, inviterOpenid }
//
// 真实场景里这逻辑会嵌在 payOrder 里·这里独立出来用于测试
//
// 业务流：
// 1. 查 user · 看是不是有 inviter
// 2. 查 orders · 看是不是首单（status='paid' 计数 == 0）
// 3. 写入 orders · 标记 isFirstOrder + inviterOpenid
// 4. 给自己 +2% 自消费返（settled 立即到账）
// 5. 如果是首单 + 有 inviter → 给 inviter +5% 推荐返（pending 7 天）
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const SELF_RATE = 0.02; // 自消费返 2%
const REFERRAL_RATE = 0.05; // 推荐返 5%
const REFERRAL_PENDING_DAYS = 7;

// 1 积分 = 1 分钱（¥0.01）· orderTotalFen 是分·返多少积分 = orderTotalFen × rate
function calcPoints(fen, rate) {
  return Math.floor(fen * rate);
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { orderTotalFen = 30000 } = event;

  if (!openid) return { ok: false, code: 'NO_OPENID' };
  if (!Number.isInteger(orderTotalFen) || orderTotalFen <= 0) {
    return { ok: false, code: 'INVALID_AMOUNT' };
  }

  // 1. 查 user
  const userQuery = await db.collection('users').where({ _openid: openid }).limit(1).get();
  if (userQuery.data.length === 0) {
    return { ok: false, code: 'USER_NOT_FOUND' };
  }
  const user = userQuery.data[0];
  const inviterOpenid = user.inviterId || null;

  // 2. 查是否首单
  const paidOrders = await db
    .collection('orders')
    .where({ _openid: openid, status: 'paid' })
    .count();
  const isFirstOrder = paidOrders.total === 0;

  // 3. 写订单
  const now = new Date().toISOString();
  const orderInserted = await db.collection('orders').add({
    data: {
      _openid: openid,
      orderNo: `SIM${Date.now()}`,
      items: [{ skuId: 'sim-sku', name: '[模拟] 治疗项目', priceFen: orderTotalFen, qty: 1 }],
      totalAmountFen: orderTotalFen,
      pointsDeductedFen: 0,
      pointsUsed: 0,
      cashAmountFen: orderTotalFen,
      paymentMethod: 'wechat_pay',
      status: 'paid',
      isFirstOrder,
      inviterOpenid,
      paidAt: now,
      createdAt: now,
      refundedAt: null,
    },
  });
  const orderId = orderInserted._id;

  // 4. 自消费返 2% 立即到账
  // 关键：云函数间调用·下游 wxContext.OPENID 为空·必须显式传 targetOpenid
  const selfPoints = calcPoints(orderTotalFen, SELF_RATE);
  let selfEarnOk = false;
  if (selfPoints > 0) {
    const r = await cloud.callFunction({
      name: 'earnPoints',
      data: {
        targetOpenid: openid,
        delta: selfPoints,
        type: 'earn_self_consume',
        refType: 'order',
        refId: orderId,
        description: `订单 ${orderId} 自消费返 2%`,
      },
    });
    selfEarnOk = r.result && r.result.ok;
  }

  // 5. 推荐返 5%（仅首单 + 有 inviter）
  let rewardPoints = 0;
  let referralRewarded = false;
  if (isFirstOrder && inviterOpenid) {
    rewardPoints = calcPoints(orderTotalFen, REFERRAL_RATE);
    if (rewardPoints > 0) {
      const r = await cloud.callFunction({
        name: 'earnPoints',
        data: {
          targetOpenid: inviterOpenid,
          delta: rewardPoints,
          type: 'earn_referral',
          refType: 'order',
          refId: orderId,
          description: `朋友 ${openid.slice(0, 8)} 首单 ¥${orderTotalFen / 100} · 推荐返 5%`,
          pendingDays: REFERRAL_PENDING_DAYS,
        },
      });
      referralRewarded = r.result && r.result.ok;

      // 同步 referral_links · conversions+1 + GMV 累加
      // 找 inviter 在该 user.inviterChannel 下的 link · 累加
      if (referralRewarded && user.inviterChannel) {
        const linkQuery = await db
          .collection('referral_links')
          .where({
            inviterOpenid,
            channel: user.inviterChannel,
          })
          .limit(1)
          .get();
        if (linkQuery.data.length > 0) {
          await db
            .collection('referral_links')
            .doc(linkQuery.data[0]._id)
            .update({
              data: {
                conversions: db.command.inc(1),
                totalGmvFromConversion: db.command.inc(orderTotalFen),
              },
            });
        }
      }
    }
  }

  return {
    ok: true,
    orderId,
    isFirstOrder,
    selfPointsEarned: selfPoints,
    selfEarnOk,
    referralRewarded,
    rewardPoints,
    inviterOpenid,
  };
};
