// createAppointment · 客户提交预约申请（小程序内）
// 入参：{ customerName, customerPhone, preferredDate, preferredSlot, skuId, skuName, skuCategory, customerNotes }
// 出参：{ ok, appointmentId, status: 'pending' }
//
// 业务约定：
// - 状态从 pending 起步
// - source of truth 是岚时云·小程序的记录是客户视角的影子
// - 员工在岚时云走真实流程后·在小程序员工工具里手动同步状态回来
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const ALLOWED_SLOTS = new Set(['morning', 'afternoon', 'evening']);

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const {
    customerName,
    customerPhone,
    preferredDate, // "2026-05-15"
    preferredSlot, // morning|afternoon|evening
    skuId = null,
    skuName = '',
    skuCategory = '',
    customerNotes = '',
  } = event;

  if (!openid) return { ok: false, code: 'NO_OPENID' };
  if (!customerName || customerName.length < 2) return { ok: false, code: 'INVALID_NAME' };
  if (!customerPhone || !/^1\d{10}$/.test(customerPhone)) return { ok: false, code: 'INVALID_PHONE' };
  if (!preferredDate || !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) return { ok: false, code: 'INVALID_DATE' };
  if (!ALLOWED_SLOTS.has(preferredSlot)) return { ok: false, code: 'INVALID_SLOT' };

  // 防重：同一客户 24 小时内同一日期+时段+SKU 不允许重复提交
  const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
  let duplicateCount = 0;
  try {
    const dup = await db.collection('appointments').where({
      _openid: openid,
      preferredDate,
      preferredSlot,
      skuId,
      createdAt: db.command.gte(oneDayAgo),
      status: db.command.in(['pending', 'confirmed']),
    }).count();
    duplicateCount = dup.total;
  } catch (e) {
    // 集合不存在 · 第一次调用 · 自动创建
    if (String(e).includes('not exist')) {
      try {
        await db.createCollection('appointments');
      } catch (e2) {
        // 已存在的另一种报错也忽略
      }
      duplicateCount = 0;
    } else {
      throw e;
    }
  }
  if (duplicateCount > 0) return { ok: false, code: 'DUPLICATE_RECENT' };

  const now = new Date().toISOString();
  const inserted = await db.collection('appointments').add({
    data: {
      _openid: openid,
      customerName,
      customerPhone,
      preferredDate,
      preferredSlot,
      skuId,
      skuName,
      skuCategory,
      customerNotes,
      status: 'pending',
      staffNotes: '',
      confirmedAt: null,
      confirmedBy: null,
      finalDate: null,
      finalSlot: null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    appointmentId: inserted._id,
    status: 'pending',
  };
};
