const crypto = require("node:crypto");
// activateOldCustomer · 老客手机号匹配 pending_activation · 转入积分账户
// 入参：{ phoneCode } —— 微信 getPhoneNumber 返回的 code
// 出参：{ ok, activated, pointsGranted, totalConsumeWindow }
//
// 流程：
// 1. 用 phoneCode 调微信 OpenAPI 拿手机号
// 2. SHA256 hash
// 3. 查 pending_activation · 命中且 consumed=false → 入账
// 4. 同步更新 user 记录（phone/phoneHash/activatedFromOldCustomer）
//
// 事务：
// - 微信云数据库不原生支持跨集合事务·这里用业务侧补偿（先标 consumed=true·失败则回滚）
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

async function getPhoneFromCode(code) {
  // 调微信开放接口 phonenumber.getPhoneNumber
  // wx-server-sdk 的 cloud.openapi.phonenumber.getPhoneNumber 是云调用
  const res = await cloud.openapi.phonenumber.getPhoneNumber({ code });
  // res.phoneInfo: { phoneNumber, purePhoneNumber, countryCode, ... }
  return res.phoneInfo && (res.phoneInfo.purePhoneNumber || res.phoneInfo.phoneNumber);
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { phoneCode } = event;

  if (!openid) {
    return { ok: false, code: "NO_OPENID" };
  }
  if (!phoneCode) {
    return { ok: false, code: "MISSING_PHONE_CODE" };
  }

  // 1. 拿手机号
  let phone;
  try {
    phone = await getPhoneFromCode(phoneCode);
  } catch (e) {
    return { ok: false, code: "GET_PHONE_FAILED", error: String(e) };
  }
  if (!phone) {
    return { ok: false, code: "EMPTY_PHONE" };
  }

  const phoneHash = sha256(phone);
  const now = new Date().toISOString();

  // 2. 查 pending_activation
  // 主键 = phoneHash · 直接 doc(phoneHash) 拿
  const pendingCol = db.collection("pending_activation");
  let pendingDoc;
  try {
    const r = await pendingCol.doc(phoneHash).get();
    pendingDoc = r.data;
  } catch (e) {
    // 没有匹配·这是新客（不是老客）
    // 但仍然要把 phone 写到 user 表
    await db.collection("users").where({ _openid: openid }).update({
      data: { phone, phoneHash, lastActiveAt: now },
    });
    return { ok: true, activated: false, isOldCustomer: false };
  }

  if (pendingDoc.consumed) {
    // 已被领走（不应该发生·除非用户从两台设备登）
    return { ok: false, code: "ALREADY_CONSUMED", activated: false };
  }

  const points = pendingDoc.pointsToGrant;

  // 3. 业务事务：先标 consumed=true（占位）→ 入账 → 失败回滚
  try {
    await pendingCol.doc(phoneHash).update({
      data: {
        consumed: true,
        consumedBy: openid,
        consumedAt: now,
      },
    });
  } catch (e) {
    return { ok: false, code: "CLAIM_FAILED", error: String(e) };
  }

  try {
    // 4. 入账 points_account（增量更新）
    await db.collection("points_account").where({ _openid: openid }).update({
      data: {
        balance: _.inc(points),
        totalEarned: _.inc(points),
        lastUpdatedAt: now,
      },
    });

    // 5. 写 points_log 流水
    await db.collection("points_log").add({
      data: {
        _openid: openid,
        delta: points,
        balanceAfter: null, // 简化·实际应查更新后余额回填
        type: "earn_old_customer_activation",
        refType: "pending_activation",
        refId: phoneHash,
        description: `老客一次性激活礼·近 2 年消费折算 ${points} 积分`,
        createdAt: now,
        pendingUntil: null,
        status: "settled",
      },
    });

    // 6. 更新 user 记录
    await db.collection("users").where({ _openid: openid }).update({
      data: {
        phone,
        phoneHash,
        activatedFromOldCustomer: true,
        oldCustomerActivatedAt: now,
        lastActiveAt: now,
      },
    });

    return {
      ok: true,
      activated: true,
      isOldCustomer: true,
      pointsGranted: points,
      totalConsumeWindow: pendingDoc.totalConsumeWindow,
    };
  } catch (e) {
    // 入账失败 · 回滚 pending_activation
    await pendingCol.doc(phoneHash).update({
      data: { consumed: false, consumedBy: null, consumedAt: null },
    });
    return { ok: false, code: "GRANT_FAILED", error: String(e) };
  }
};
