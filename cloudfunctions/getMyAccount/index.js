// getMyAccount · 查询自己的积分账户 + 最近流水
// 入参：{ logsLimit?: 20 }
// 出参：{ ok, account, recentLogs }
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { logsLimit = 20 } = event;

  if (!openid) return { ok: false, code: 'NO_OPENID' };

  const accountQuery = await db.collection('points_account').where({ _openid: openid }).limit(1).get();
  const account = accountQuery.data[0] || null;

  const logs = await db
    .collection('points_log')
    .where({ _openid: openid })
    .orderBy('createdAt', 'desc')
    .limit(Math.min(logsLimit, 100))
    .get();

  return {
    ok: true,
    account,
    recentLogs: logs.data,
  };
};
