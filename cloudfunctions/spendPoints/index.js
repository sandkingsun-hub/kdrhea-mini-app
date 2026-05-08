// spendPoints · 通用积分扣减
// 入参：{ delta, type, refType, refId, description, orderTotalFen?, maxRatio? }
//   - delta: 扣减积分（正整数 · 表示要扣多少积分）
//   - type: spend_deduct / spend_redeem_sku / spend_gift / admin_adjust
//   - refType / refId / description: 同 earnPoints
//   - orderTotalFen: 订单总额（分）· 用于校验抵扣比例上限
//   - maxRatio: 最大抵扣比例（0-1·缺省 0.7 = 70%）· 仅当 orderTotalFen 提供时生效
// 出参：{ ok, balanceAfter, logId }
//
// 强约束：
//   - 不允许 delta > balance（不允许透支）
//   - 若提供 orderTotalFen·校验 (delta * 1分/100积分) <= orderTotalFen * maxRatio
//     即 delta 积分等价的钱不超过订单的 maxRatio 比例
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const ALLOWED_TYPES = new Set([
  'spend_deduct',
  'spend_redeem_sku',
  'spend_gift',
  'admin_adjust',
]);

const DEFAULT_MAX_RATIO = 0.7;

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const {
    delta,
    type,
    refType = null,
    refId = null,
    description = '',
    orderTotalFen = null,
    maxRatio = DEFAULT_MAX_RATIO,
  } = event;

  if (!openid) return { ok: false, code: 'NO_OPENID' };
  if (!Number.isInteger(delta) || delta <= 0) {
    return { ok: false, code: 'INVALID_DELTA', message: 'delta 必须为正整数' };
  }
  if (!ALLOWED_TYPES.has(type)) {
    return { ok: false, code: 'INVALID_TYPE', message: `type 必须在白名单内: ${[...ALLOWED_TYPES].join(',')}` };
  }

  // 1 积分 = 1 分钱（¥0.01）· 100 积分 = 1 元
  if (orderTotalFen !== null) {
    if (!Number.isInteger(orderTotalFen) || orderTotalFen <= 0) {
      return { ok: false, code: 'INVALID_ORDER_TOTAL' };
    }
    const equivalentFen = delta; // 积分对分 1:1（1 积分 = 1 分钱）
    const maxDeductFen = Math.floor(orderTotalFen * maxRatio);
    if (equivalentFen > maxDeductFen) {
      return {
        ok: false,
        code: 'EXCEED_DEDUCT_RATIO',
        message: `积分抵扣金额 ${equivalentFen} 分超过订单 ${maxRatio * 100}% 上限（${maxDeductFen} 分）`,
      };
    }
  }

  const now = new Date().toISOString();
  const transaction = await db.startTransaction();
  try {
    const accountQuery = await transaction
      .collection('points_account')
      .where({ _openid: openid })
      .get();

    if (accountQuery.data.length === 0) {
      await transaction.rollback();
      return { ok: false, code: 'NO_ACCOUNT', message: '积分账户不存在·请先调 login' };
    }
    const acc = accountQuery.data[0];

    if (acc.balance < delta) {
      await transaction.rollback();
      return {
        ok: false,
        code: 'INSUFFICIENT_BALANCE',
        balance: acc.balance,
        required: delta,
      };
    }

    const balanceAfter = acc.balance - delta;
    await transaction.collection('points_account').doc(acc._id).update({
      data: {
        balance: balanceAfter,
        totalSpent: acc.totalSpent + delta,
        lastUpdatedAt: now,
      },
    });

    const logInserted = await transaction.collection('points_log').add({
      data: {
        _openid: openid,
        delta: -delta, // 出账记负数
        balanceAfter,
        type,
        refType,
        refId,
        description,
        createdAt: now,
        pendingUntil: null,
        status: 'settled',
      },
    });

    await transaction.commit();
    return {
      ok: true,
      balanceAfter,
      logId: logInserted._id,
    };
  } catch (e) {
    await transaction.rollback();
    return { ok: false, code: 'TRANSACTION_FAILED', error: String(e) };
  }
};
