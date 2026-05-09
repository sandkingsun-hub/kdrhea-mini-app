// updateAppointmentStatus · 员工改预约状态
// 入参：{ appointmentId, status, finalDate?, finalSlot?, staffNotes? }
// 出参：{ ok, status, finalDate, finalSlot }
//
// 状态流转：
//   pending → confirmed | rejected
//   confirmed → completed | cancelled | rescheduled
//   rescheduled → confirmed (重新确认)
//
// 权限：仅 user.role in [staff, admin]
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const ALLOWED_STATUS = new Set(['pending', 'confirmed', 'rejected', 'completed', 'cancelled', 'rescheduled']);
const ALLOWED_SLOTS = new Set(['morning', 'afternoon', 'evening']);

async function getMyRole(openid) {
  const q = await db.collection('users').where({ _openid: openid }).limit(1).get();
  return q.data[0]?.role || 'customer';
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const callerOpenid = wxContext.OPENID;
  if (!callerOpenid) return { ok: false, code: 'NO_OPENID' };

  const role = await getMyRole(callerOpenid);
  if (role !== 'staff' && role !== 'admin')
    return { ok: false, code: 'PERMISSION_DENIED' };

  const { appointmentId, status, finalDate, finalSlot, staffNotes = '' } = event;
  if (!appointmentId) return { ok: false, code: 'MISSING_ID' };
  if (!ALLOWED_STATUS.has(status)) return { ok: false, code: 'INVALID_STATUS' };

  const doc = (await db.collection('appointments').doc(appointmentId).get()).data;
  if (!doc) return { ok: false, code: 'NOT_FOUND' };

  const now = new Date().toISOString();
  const update = {
    status,
    staffNotes: staffNotes || doc.staffNotes,
    updatedAt: now,
  };

  if (status === 'confirmed' || status === 'rescheduled') {
    if (finalDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(finalDate)) return { ok: false, code: 'INVALID_DATE' };
      update.finalDate = finalDate;
    } else if (!doc.finalDate) {
      // 默认沿用客户期望
      update.finalDate = doc.preferredDate;
    }
    if (finalSlot) {
      if (!ALLOWED_SLOTS.has(finalSlot)) return { ok: false, code: 'INVALID_SLOT' };
      update.finalSlot = finalSlot;
    } else if (!doc.finalSlot) {
      update.finalSlot = doc.preferredSlot;
    }
    update.confirmedAt = now;
    update.confirmedBy = callerOpenid;
  }

  await db.collection('appointments').doc(appointmentId).update({ data: update });

  return {
    ok: true,
    appointmentId,
    status: update.status,
    finalDate: update.finalDate || doc.finalDate,
    finalSlot: update.finalSlot || doc.finalSlot,
  };
};
