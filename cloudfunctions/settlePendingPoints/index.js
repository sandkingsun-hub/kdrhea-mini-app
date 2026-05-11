// settlePendingPoints · 定时扫描 status='pending' && pendingUntil<=now 的流水
// 转 settled · 同步把对应账户的 pendingPoints → balance + totalEarned
// 触发：cloud timer cron · 每天 02:00 跑一次
//
// 入参：{ dryRun?: boolean, batchSize?: 100 } —— dryRun 只看不写
// 出参：{ ok, scanned, settled, skipped, totalPoints }
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event = {}) => {
  const { dryRun = false, batchSize = 100 } = event;
  const now = new Date().toISOString();

  // 1. 扫描到期的 pending 流水
  const due = await db
    .collection('points_log')
    .where({
      status: 'pending',
      pendingUntil: _.lte(now),
    })
    .limit(batchSize)
    .get();

  const scanned = due.data.length;
  if (scanned === 0) {
    return { ok: true, scanned: 0, settled: 0, skipped: 0, totalPoints: 0 };
  }

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      scanned,
      pendingLogs: due.data.map((l) => ({
        _id: l._id,
        _openid: l._openid,
        delta: l.delta,
        pendingUntil: l.pendingUntil,
      })),
    };
  }

  let settled = 0;
  let skipped = 0;
  let totalPoints = 0;
  const logsToSettle = [];

  // 2. 先剔除已退款订单的 pending 推荐返
  for (const log of due.data) {
    if (log.refType === 'order' && log.refId) {
      let order = null;
      try {
        order = (await db.collection('orders').doc(log.refId).get()).data;
      } catch (e) {
        order = null;
      }

      if (order && order.status === 'refunded') {
        await db.collection('points_log').doc(log._id).update({
          data: {
            status: 'cancelled',
            cancelledAt: now,
            cancelReason: 'order_refunded',
            refundedAt: order.refundedAt || now,
          },
        });
        skipped += 1;
        continue;
      }
    }
    logsToSettle.push(log);
  }

  // 3. 按用户聚合·一次性更新账户·避免大量小操作
  const byOpenid = new Map();
  for (const log of logsToSettle) {
    if (!byOpenid.has(log._openid)) byOpenid.set(log._openid, { points: 0, logIds: [] });
    const agg = byOpenid.get(log._openid);
    agg.points += log.delta;
    agg.logIds.push(log._id);
  }

  // 4. 对每个用户 · 事务更新账户 + 批量更新 logs
  for (const [openid, agg] of byOpenid.entries()) {
    const transaction = await db.startTransaction();
    try {
      // 账户：pendingPoints -agg.points · balance +agg.points · totalEarned +agg.points
      const accQuery = await transaction
        .collection('points_account')
        .where({ _openid: openid })
        .get();
      if (accQuery.data.length === 0) {
        await transaction.rollback();
        skipped += agg.logIds.length;
        continue;
      }
      const acc = accQuery.data[0];
      await transaction.collection('points_account').doc(acc._id).update({
        data: {
          balance: acc.balance + agg.points,
          totalEarned: acc.totalEarned + agg.points,
          pendingPoints: Math.max(0, acc.pendingPoints - agg.points),
          lastUpdatedAt: now,
        },
      });

      // 批量 update logs · status -> settled · balanceAfter 写实际值（取最后一笔后的 balance）
      // 简化处理：每条 log 单独 update（事务内不能 batch update）
      const newBalance = acc.balance + agg.points;
      for (const logId of agg.logIds) {
        await transaction
          .collection('points_log')
          .doc(logId)
          .update({
            data: {
              status: 'settled',
              balanceAfter: newBalance,
            },
          });
      }

      await transaction.commit();
      settled += agg.logIds.length;
      totalPoints += agg.points;
    } catch (e) {
      await transaction.rollback();
      skipped += agg.logIds.length;
      console.error(`settle failed for ${openid}:`, e);
    }
  }

  return {
    ok: true,
    scanned,
    settled,
    skipped,
    totalPoints,
    timestamp: now,
  };
};
