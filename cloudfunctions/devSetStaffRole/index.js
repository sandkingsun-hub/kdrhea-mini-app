// devSetStaffRole · DEV ONLY · 给指定 openid 设置 role
// 上线前删除 / 改为 admin 后台权限管理
// 入参：{ targetOpenid, role }
// 出参：{ ok, openid, role }
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const ALLOWED = new Set(['customer', 'staff', 'admin']);

exports.main = async (event = {}) => {
  const { targetOpenid, role } = event;
  if (!targetOpenid)
    return { ok: false, code: 'MISSING_OPENID' };
  if (!ALLOWED.has(role))
    return { ok: false, code: 'INVALID_ROLE' };

  const q = await db.collection('users').where({ _openid: targetOpenid }).limit(1).get();
  if (q.data.length === 0)
    return { ok: false, code: 'USER_NOT_FOUND' };

  await db.collection('users').doc(q.data[0]._id).update({
    data: { role },
  });

  return { ok: true, openid: targetOpenid, role };
};
