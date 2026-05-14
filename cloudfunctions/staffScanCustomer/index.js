// staffScanCustomer · 员工扫客户码后调
// 入参：{ customerOpenid, action, amountFen?, points?, description? }
//   - action: 'log_offline_consume'（线下消费返利 2%·按 amountFen）
//             'spend_for_consume'（积分抵扣线下消费·按 points）
//             'reward_in_store_qr'（到店打卡补贴·固定积分）
// 出参：{ ok, action, balanceAfter, log }
//
// 安全：
// - 仅 user.role in [staff, admin] 才能调
// - 客户 openid 必须存在
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const SELF_RATE = 0.02; // 线下消费返 2%
const REFERRAL_RATE = 0.05; // 首单推荐返 5%

async function getMyRole(openid) {
  const q = await db.collection('users').where({ _openid: openid }).limit(1).get();
  return q.data[0]?.role || 'customer';
}

// 北京时间 YYYY-MM-DD · 云函数环境是 UTC · 偏移 +8h
function getBeijingDateStr(date = new Date()) {
  const ms = date.getTime() + 8 * 3600 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

async function ensureCollection(name) {
  try { await db.collection(name).count(); }
  catch (e) {
    if (String(e).includes('not exist')) try { await db.createCollection(name); } catch {}
  }
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const callerOpenid = wxContext.OPENID;
  const { customerOpenid, action, amountFen, points, description } = event;

  if (!callerOpenid)
    return { ok: false, code: 'NO_OPENID' };

  // 权限校验
  const role = await getMyRole(callerOpenid);
  if (role !== 'staff' && role !== 'admin')
    return { ok: false, code: 'PERMISSION_DENIED', role };

  if (!customerOpenid)
    return { ok: false, code: 'MISSING_CUSTOMER' };
  if (callerOpenid === customerOpenid)
    return { ok: false, code: 'SELF_OPERATION' };

  // 校验客户存在
  const cust = await db.collection('users').where({ _openid: customerOpenid }).limit(1).get();
  if (cust.data.length === 0)
    return { ok: false, code: 'CUSTOMER_NOT_FOUND' };
  const customerDoc = cust.data[0];

  if (action === 'log_offline_consume') {
    if (!Number.isInteger(amountFen) || amountFen <= 0)
      return { ok: false, code: 'INVALID_AMOUNT' };
    const earnPoints = Math.floor(amountFen * SELF_RATE);
    if (earnPoints <= 0)
      return { ok: false, code: 'AMOUNT_TOO_SMALL' };
    const r = await cloud.callFunction({
      name: 'earnPoints',
      data: {
        targetOpenid: customerOpenid,
        delta: earnPoints,
        type: 'earn_self_consume',
        refType: 'offline_scan',
        refId: callerOpenid,
        description: description || `线下消费 ¥${(amountFen / 100).toFixed(2)} 返 2%`,
      },
    });

    // 检查是否首次现金交易 + 是否有 inviter
    if (!customerDoc.firstPaidAt && customerDoc.inviterId) {
      const referralPoints = Math.floor(amountFen * REFERRAL_RATE);
      if (referralPoints > 0) {
        await cloud.callFunction({
          name: 'earnPoints',
          data: {
            targetOpenid: customerDoc.inviterId,
            delta: referralPoints,
            type: 'earn_referral',
            refType: 'offline_scan',
            refId: callerOpenid,
            description: `朋友 ${customerOpenid.slice(0, 8)} 首次线下消费 ¥${(amountFen / 100).toFixed(2)} · 推荐返 5%`,
            pendingDays: 7,
          },
        });

        // 同步 referral_links 累加（仅当 inviterChannel 有时）
        if (customerDoc.inviterChannel) {
          const linkQuery = await db.collection('referral_links')
            .where({ inviterOpenid: customerDoc.inviterId, channel: customerDoc.inviterChannel })
            .limit(1)
            .get();
          if (linkQuery.data.length > 0) {
            await db.collection('referral_links').doc(linkQuery.data[0]._id).update({
              data: {
                conversions: db.command.inc(1),
                totalGmvFromConversion: db.command.inc(amountFen),
              },
            });
          }
        }
      }
    }

    // 始终标记首单（即使没 inviter 或推荐积分=0）
    if (!customerDoc.firstPaidAt) {
      await db.collection('users').doc(customerDoc._id).update({
        data: {
          firstPaidAt: new Date().toISOString(),
          firstPaidChannel: 'offline',
        },
      });
    }

    // 累加贡献分 + 跑等级升级判定 · 不阻塞主流程
    let levelUpgrade = null;
    try {
      const upgradeRes = await cloud.callFunction({
        name: 'recordContribution',
        data: {
          customerOpenid,
          deltaFen: amountFen,
          source: 'consume',
          refId: callerOpenid,
          description: `线下消费 ¥${(amountFen / 100).toFixed(2)}`,
        },
      });
      if (upgradeRes.result?.ok) {
        levelUpgrade = upgradeRes.result;
      }
    } catch (e) {
      console.warn('recordContribution failed:', e);
    }

    return {
      ok: r.result?.ok || false,
      action,
      amountFen,
      pointsEarned: earnPoints,
      balanceAfter: r.result?.balanceAfter,
      levelUpgrade,
      detail: r.result,
    };
  }

  if (action === 'spend_for_consume') {
    if (!Number.isInteger(points) || points <= 0)
      return { ok: false, code: 'INVALID_POINTS' };
    const r = await cloud.callFunction({
      name: 'spendPoints',
      data: {
        targetOpenid: customerOpenid,
        delta: points,
        type: 'spend_deduct',
        refType: 'offline_scan',
        refId: callerOpenid,
        description: description || `线下抵扣 ${points} 积分`,
      },
    });
    return {
      ok: r.result?.ok || false,
      action,
      pointsSpent: points,
      balanceAfter: r.result?.balanceAfter,
      detail: r.result,
    };
  }

  if (action === 'reward_in_store_qr') {
    const grant = points && points > 0 ? points : 500;
    const now = new Date();
    const dateStr = getBeijingDateStr(now);

    await ensureCollection('check_ins');

    // 同日限频 · 一个工作日（北京时间 calendar date）只允许一次到店打卡
    const existing = await db.collection('check_ins')
      .where({ customerOpenid, dateStr })
      .limit(1)
      .get();
    if (existing.data.length > 0) {
      return {
        ok: false,
        code: 'CHECKIN_TOO_FREQUENT',
        message: '该顾客今日已打过卡',
        dateStr,
        existingCheckIn: {
          _id: existing.data[0]._id,
          checkedInAt: existing.data[0].checkedInAt,
        },
      };
    }

    // 1. 创建 check_in 记录（占位）
    const checkInDoc = {
      customerOpenid,
      staffOpenid: callerOpenid,
      dateStr,
      checkedInAt: now.toISOString(),
      pointsGranted: grant,
      pointsLogId: null, // 下一步回填
    };
    const addRes = await db.collection('check_ins').add({ data: checkInDoc });
    const checkInId = addRes._id;

    // 2. 调 earnPoints 发积分 · refType 引用 check_in
    const r = await cloud.callFunction({
      name: 'earnPoints',
      data: {
        targetOpenid: customerOpenid,
        delta: grant,
        type: 'earn_in_store_qr',
        refType: 'check_in',
        refId: checkInId,
        description: description || `到店打卡 +${grant} 积分`,
      },
    });

    // 3. 把 pointsLogId 回填到 check_in（如果 earnPoints 成功）
    if (r.result?.ok && r.result?.logId) {
      try {
        await db.collection('check_ins').doc(checkInId).update({
          data: { pointsLogId: r.result.logId },
        });
      } catch {}
    }

    return {
      ok: r.result?.ok || false,
      action,
      checkInId,
      pointsEarned: grant,
      balanceAfter: r.result?.balanceAfter,
      dateStr,
      detail: r.result,
    };
  }

  return { ok: false, code: 'INVALID_ACTION' };
};
