// listMyOrders · 我的订单列表
// 入参：{ status?, limit?: 20, skip?: 0 }
// 出参：{ ok, items, total }
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { status = null, limit = 20, skip = 0 } = event;

  if (!openid) return { ok: false, code: 'NO_OPENID' };

  const where = { _openid: openid };
  if (status) where.status = status;

  const cap = Math.min(limit, 100);

  const [list, count] = await Promise.all([
    db.collection('orders').where(where).orderBy('createdAt', 'desc').skip(skip).limit(cap).get(),
    db.collection('orders').where(where).count(),
  ]);

  return {
    ok: true,
    items: list.data,
    total: count.total,
    skip,
    limit: cap,
  };
};
