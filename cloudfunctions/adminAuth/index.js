// adminAuth · 后台管理员登录认证
// 入参：{ action, phone?, code?, token? }
//   action="sendCode"      入：phone           出：{ ok, devCode? }
//   action="verifyCode"    入：phone, code     出：{ ok, token, expiresAt }
//   action="validateToken" 入：token           出：{ ok, admin: { phone, exp } }
//
// 安全：
// - 白名单：只有 ADMIN_PHONES 里的号能 sendCode（防被刷）
// - code 5 分钟过期 + 单次使用 + 同一号 60 秒内不重发
// - token HMAC-SHA256 签名 24h 过期
// - secret 走环境变量 ADMIN_AUTH_SECRET（CloudBase 控制台配·dev 默认值不安全）
//
// SMS：
// - 当前 dev 模式：直接在云函数返回里给 devCode 让前端弹出
// - 上线前：接腾讯云 SMS API（注释里有占位）
const crypto = require("node:crypto");
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 白名单·硬编码·后期改成数据库 admins 集合
const ADMIN_PHONES = new Set([
  "19851699990", // Nick
]);

const SECRET = process.env.ADMIN_AUTH_SECRET || "kd-admin-dev-secret-change-me";
const CODE_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
// 当前 dev 模式·返回 code 让前端能拿到·上线前改 false 或删 devCode 字段
const DEV_RETURN_CODE = true;

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function hmac(payload) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex").slice(0, 32);
}

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function b64urlEncode(s) {
  return Buffer.from(s).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlDecode(s) {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function signToken(payload) {
  const payloadStr = JSON.stringify(payload);
  const encoded = b64urlEncode(payloadStr);
  const sig = hmac(encoded);
  return `${encoded}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== "string") {
    return null;
  }
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) {
    return null;
  }
  if (hmac(encoded) !== sig) {
    return null;
  }
  let payload;
  try {
    payload = JSON.parse(b64urlDecode(encoded));
  } catch {
    return null;
  }
  if (!payload || typeof payload.exp !== "number" || payload.exp < Date.now()) {
    return null;
  }
  return payload;
}

async function ensureCollection(name) {
  try {
    await db.collection(name).count();
  } catch (e) {
    if (String(e).includes("not exist")) {
      try { await db.createCollection(name); } catch {}
    }
  }
}

exports.main = async (event = {}) => {
  const { action, phone, code, token } = event;

  if (action === "sendCode") {
    if (!phone || !/^1\d{10}$/.test(phone)) {
      return { ok: false, code: "INVALID_PHONE" };
    }
    if (!ADMIN_PHONES.has(phone)) {
      return { ok: false, code: "NOT_ADMIN" };
    }
    await ensureCollection("admin_verifications");

    const phoneHash = sha256(phone);
    // 60 秒冷却·查最近一条未过期未消费的
    const now = Date.now();
    const recent = await db.collection("admin_verifications").where({
      phoneHash,
      consumed: false,
      createdAtMs: _.gt(now - RESEND_COOLDOWN_MS),
    }).limit(1).get();
    if (recent.data.length > 0) {
      return { ok: false, code: "RESEND_COOLDOWN", retryAfterSec: 60 };
    }

    const verifyCode = genCode();
    const expiresAt = new Date(now + CODE_TTL_MS).toISOString();
    await db.collection("admin_verifications").add({
      data: {
        phoneHash,
        code: verifyCode,
        createdAt: new Date(now).toISOString(),
        createdAtMs: now,
        expiresAt,
        consumed: false,
      },
    });

    // TODO 上线前接腾讯云 SMS：
    // const tencentcloud = require("tencentcloud-sdk-nodejs");
    // const SmsClient = tencentcloud.sms.v20210111.Client;
    // const client = new SmsClient({ ... });
    // await client.SendSms({ PhoneNumberSet: ["+86" + phone], TemplateId, TemplateParamSet: [verifyCode], ... });
    console.log(`[adminAuth dev] code for ${phone}: ${verifyCode}`);

    const ret = { ok: true, expiresInSec: CODE_TTL_MS / 1000 };
    if (DEV_RETURN_CODE) {
      ret.devCode = verifyCode;
    }
    return ret;
  }

  if (action === "verifyCode") {
    if (!phone || !/^1\d{10}$/.test(phone)) {
      return { ok: false, code: "INVALID_PHONE" };
    }
    if (!code || !/^\d{6}$/.test(code)) {
      return { ok: false, code: "INVALID_CODE_FORMAT" };
    }
    if (!ADMIN_PHONES.has(phone)) {
      return { ok: false, code: "NOT_ADMIN" };
    }
    await ensureCollection("admin_verifications");

    const phoneHash = sha256(phone);
    const now = Date.now();
    const r = await db.collection("admin_verifications").where({
      phoneHash,
      code,
      consumed: false,
      createdAtMs: _.gt(now - CODE_TTL_MS),
    }).orderBy("createdAtMs", "desc").limit(1).get();

    if (r.data.length === 0) {
      return { ok: false, code: "INVALID_OR_EXPIRED_CODE" };
    }

    // 标 consumed
    await db.collection("admin_verifications").doc(r.data[0]._id).update({
      data: { consumed: true, consumedAt: new Date(now).toISOString() },
    });

    const exp = now + TOKEN_TTL_MS;
    const tokenStr = signToken({ phone, role: "admin", exp });
    return {
      ok: true,
      token: tokenStr,
      expiresAt: new Date(exp).toISOString(),
      admin: { phone, role: "admin" },
    };
  }

  if (action === "validateToken") {
    const payload = verifyToken(token);
    if (!payload) {
      return { ok: false, code: "INVALID_TOKEN" };
    }
    return { ok: true, admin: payload };
  }

  return { ok: false, code: "UNKNOWN_ACTION" };
};
