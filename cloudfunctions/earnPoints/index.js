// earnPoints · 通用积分入账
// 入参：{ targetOpenid?, delta, type, refType, refId, description, pendingDays? }
//   - targetOpenid: 目标用户 openid（缺省=调用者）·管理用途时可指定他人
//   - delta: 入账积分（正整数）
//   - type: 类型枚举（见下白名单）
//   - refType / refId: 关联实体（订单/激活/活动）
//   - description: 流水描述
//   - pendingDays: 延迟到账天数（如 7 天后到账·默认 0=立即）
// 出参：{ ok, balanceAfter, logId, status }
//
// 事务：transaction 包装 points_account 增量 + points_log 写入
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const ALLOWED_TYPES = new Set([
  'earn_old_customer_activation',
  'earn_self_consume',
  'earn_referral',
  'earn_in_store_qr',
  'earn_other',
  'admin_adjust',
]);

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const callerOpenid = wxContext.OPENID;
  const {
    targetOpenid,
    delta,
    type,
    refType = null,
    refId = null,
    description = '',
    pendingDays = 0,
  } = event;

  const openid = targetOpenid || callerOpenid;

  if (!openid) return { ok: false, code: 'NO_OPENID' };
  if (!Number.isInteger(delta) || delta <= 0) {
    return { ok: false, code: 'INVALID_DELTA', message: 'delta 必须为正整数' };
  }
  if (!ALLOWED_TYPES.has(type)) {
    return { ok: false, code: 'INVALID_TYPE', message: `type 必须在白名单内: ${[...ALLOWED_TYPES].join(',')}` };
  }

  const now = new Date().toISOString();
  const isPending = pendingDays > 0;
  const pendingUntil = isPending
    ? new Date(Date.now() + pendingDays * 86400000).toISOString()
    : null;
  const status = isPending ? 'pending' : 'settled';

  const transaction = await db.startTransaction();
  try {
    // 1. 查/建账户
    const accountQuery = await transaction
      .collection('points_account')
      .where({ _openid: openid })
      .get();

    let accountId;
    let balanceAfter;
    let pendingAfter;

    if (accountQuery.data.length === 0) {
      // 新建账户
      const newAcc = {
        _openid: openid,
        balance: isPending ? 0 : delta,
        totalEarned: isPending ? 0 : delta,
        totalSpent: 0,
        pendingPoints: isPending ? delta : 0,
        lastUpdatedAt: now,
      };
      const inserted = await transaction.collection('points_account').add({ data: newAcc });
      accountId = inserted._id;
      balanceAfter = newAcc.balance;
      pendingAfter = newAcc.pendingPoints;
    } else {
      const acc = accountQuery.data[0];
      accountId = acc._id;
      const newBalance = isPending ? acc.balance : acc.balance + delta;
      const newPending = isPending ? acc.pendingPoints + delta : acc.pendingPoints;
      const newTotalEarned = isPending ? acc.totalEarned : acc.totalEarned + delta;

      await transaction.collection('points_account').doc(accountId).update({
        data: {
          balance: newBalance,
          totalEarned: newTotalEarned,
          pendingPoints: newPending,
          lastUpdatedAt: now,
        },
      });
      balanceAfter = newBalance;
      pendingAfter = newPending;
    }

    // 2. 写流水
    const logDoc = {
      _openid: openid,
      delta,
      balanceAfter,
      type,
      refType,
      refId,
      description,
      createdAt: now,
      pendingUntil,
      status,
    };
    const logInserted = await transaction.collection('points_log').add({ data: logDoc });

    await transaction.commit();

    return {
      ok: true,
      balanceAfter,
      pendingAfter,
      logId: logInserted._id,
      status,
    };
  } catch (e) {
    await transaction.rollback();
    return { ok: false, code: 'TRANSACTION_FAILED', error: String(e) };
  }
};
