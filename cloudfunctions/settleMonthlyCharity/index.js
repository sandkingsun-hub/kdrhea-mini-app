// settleMonthlyCharity · 月度公益结算 · 定时器每月 1 号 02:00 自动跑
// 入参: 无（定时触发）· 也可手动调用 {} 测试
// 出参: { ok, monthKey, totalFen, contributorsCount, byOrg } 或 { ok, code: 'ALREADY_SETTLED' }
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function lastMonthKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const lastM = m === 0 ? 12 : m;
  const lastY = m === 0 ? y - 1 : y;
  return `${lastY}-${String(lastM).padStart(2, '0')}`;
}

function lastMonthRange() {
  const now = new Date();
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  return { lastMonthStart, lastMonthEnd };
}

async function ensureCollection(name) {
  try { await db.collection(name).count(); }
  catch (e) {
    if (String(e).includes('not exist')) {
      try { await db.createCollection(name); } catch {}
    }
  }
}

exports.main = async () => {
  const monthKey = lastMonthKey();
  await ensureCollection('charity_monthly');
  await ensureCollection('charity_ledger');
  await ensureCollection('charity_supply_log');
  await ensureCollection('charity_event');

  // 幂等：若已有该月文档则跳过
  try {
    const exist = await db.collection('charity_monthly').doc(monthKey).get();
    if (exist.data) return { ok: true, code: 'ALREADY_SETTLED', monthKey };
  } catch (e) { /* 不存在 · 继续 */ }

  const { lastMonthStart, lastMonthEnd } = lastMonthRange();

  // 1. 聚合 charity_ledger 上月 pending
  // cashFromUsersFen = 企业真捐部分（companyDonatedFen）· 月度对外结算口径
  // userTotalSpentFen = 用户花费等值（amountFen）· 内部对账用
  let byOrgUsers = [];
  try {
    const ledgerR = await db.collection('charity_ledger')
      .aggregate()
      .match({ createdAt: _.gte(lastMonthStart).and(_.lt(lastMonthEnd)), status: 'pending' })
      .group({
        _id: '$orgId',
        cashFromUsersFen: _.aggregate.sum('$companyDonatedFen'),
        userTotalSpentFen: _.aggregate.sum('$amountFen'),
        contributorsCount: _.aggregate.addToSet('$openid'),
      })
      .end();
    byOrgUsers = ledgerR.list.map(o => ({
      orgId: o._id,
      cashFromUsersFen: o.cashFromUsersFen || 0,
      userTotalSpentFen: o.userTotalSpentFen || 0,
      contributorsCount: o.contributorsCount.length,
    }));
  } catch (e) { /* 集合空·跳过 */ }

  // 2. 聚合 charity_supply_log 上月
  let byOrgSupply = [];
  try {
    const supplyR = await db.collection('charity_supply_log')
      .aggregate()
      .match({ occurredAt: _.gte(lastMonthStart).and(_.lt(lastMonthEnd)), status: 'confirmed' })
      .group({
        _id: '$orgId',
        supplyFromCompanyFen: _.aggregate.sum('$amountFen'),
      })
      .end();
    byOrgSupply = supplyR.list.map(o => ({ orgId: o._id, supplyFromCompanyFen: o.supplyFromCompanyFen }));
  } catch (e) { /* 集合空·跳过 */ }

  // 3. 合并 byOrg
  const orgMap = new Map();
  byOrgUsers.forEach(o => orgMap.set(o.orgId, { ...o, supplyFromCompanyFen: 0 }));
  byOrgSupply.forEach(o => {
    if (orgMap.has(o.orgId)) Object.assign(orgMap.get(o.orgId), { supplyFromCompanyFen: o.supplyFromCompanyFen });
    else orgMap.set(o.orgId, { orgId: o.orgId, cashFromUsersFen: 0, contributorsCount: 0, supplyFromCompanyFen: o.supplyFromCompanyFen });
  });
  const byOrg = Array.from(orgMap.values());

  // 4. 拉 events
  let eventIds = [];
  try {
    const eventsR = await db.collection('charity_event')
      .where({ scheduledAt: _.gte(lastMonthStart).and(_.lt(lastMonthEnd)) })
      .get();
    eventIds = eventsR.data.map(e => e._id);
  } catch (e) { /* 跳过 */ }

  // 5. 汇总
  const cashFromUsersFen = byOrg.reduce((s, o) => s + (o.cashFromUsersFen || 0), 0);
  const supplyFromCompanyFen = byOrg.reduce((s, o) => s + (o.supplyFromCompanyFen || 0), 0);
  const contributorsCount = byOrg.reduce((s, o) => s + (o.contributorsCount || 0), 0);
  const totalFen = cashFromUsersFen + supplyFromCompanyFen;

  // 6. 写 charity_monthly
  const now = new Date().toISOString();
  await db.collection('charity_monthly').add({
    data: {
      _id: monthKey,
      cashFromUsersFen, supplyFromCompanyFen, cashFromCompanyFen: 0,
      totalFen, contributorsCount,
      byOrg, eventIds,
      receiptUrls: [], notes: '',
      status: 'draft', confirmedAt: null, paidAt: null,
      createdBy: 'system',
      createdAt: now, updatedAt: now,
    },
  });

  // 7. 批量更新 charity_ledger.status = settled
  try {
    await db.collection('charity_ledger')
      .where({ createdAt: _.gte(lastMonthStart).and(_.lt(lastMonthEnd)), status: 'pending' })
      .update({ data: { status: 'settled', settledMonth: monthKey, settledAt: now } });
  } catch (e) { /* 集合空·跳过 */ }

  return { ok: true, monthKey, totalFen, contributorsCount, byOrg };
};
