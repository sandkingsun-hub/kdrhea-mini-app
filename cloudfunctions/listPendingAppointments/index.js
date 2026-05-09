// listPendingAppointments · 员工查待处理预约（pending + confirmed）
// 入参：{ status?, limit?: 50 }
// 出参：{ ok, items, total }
//
// 权限：仅 user.role in [staff, admin]
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function getMyRole(openid) {
  const q = await db.collection('users').where({ _openid: openid }).limit(1).get();
  return q.data[0]?.role || 'customer';
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { ok: false, code: 'NO_OPENID' };

  const role = await getMyRole(openid);
  if (role !== 'staff' && role !== 'admin')
    return { ok: false, code: 'PERMISSION_DENIED' };

  const { status = null, limit = 50, skip = 0 } = event;
  const _ = db.command;

  const where = {};
  if (status) {
    where.status = status;
  } else {
    // 默认查待处理（pending + confirmed · 排除已完成/取消）
    where.status = _.in(['pending', 'confirmed']);
  }

  const cap = Math.min(limit, 200);
  const [list, count] = await Promise.all([
    db.collection('appointments').where(where).orderBy('createdAt', 'desc').skip(skip).limit(cap).get(),
    db.collection('appointments').where(where).count(),
  ]);

  return { ok: true, items: list.data, total: count.total };
};
