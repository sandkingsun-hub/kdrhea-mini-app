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

// 腾讯云 SMS 配置（云函数环境变量·配齐后自动切真发·缺则 dev 模式）
const SMS_SDK_APP_ID = process.env.TENCENT_SMS_SDK_APP_ID || "";
const SMS_SIGN_NAME = process.env.TENCENT_SMS_SIGN_NAME || "";
const SMS_TEMPLATE_ID = process.env.TENCENT_SMS_TEMPLATE_ID || "";
const SMS_SECRET_ID = process.env.TENCENT_SECRET_ID || "";
const SMS_SECRET_KEY = process.env.TENCENT_SECRET_KEY || "";
const SMS_REGION = process.env.TENCENT_SMS_REGION || "ap-shanghai";

const SMS_CONFIGURED = !!(SMS_SDK_APP_ID && SMS_SIGN_NAME && SMS_TEMPLATE_ID && SMS_SECRET_ID && SMS_SECRET_KEY);

// SMS 没配齐时·dev 模式：把 code 直接在响应里返回让前端弹出
// 配齐后：发真短信·不再返 devCode
const DEV_RETURN_CODE = !SMS_CONFIGURED;

async function sendRealSms(phone, code) {
  // 动态 require·避免没装包时模块加载失败
  const tencentcloud = require("tencentcloud-sdk-nodejs-sms");
  const SmsClient = tencentcloud.sms.v20210111.Client;

  const client = new SmsClient({
    credential: { secretId: SMS_SECRET_ID, secretKey: SMS_SECRET_KEY },
    region: SMS_REGION,
    profile: { httpProfile: { endpoint: "sms.tencentcloudapi.com" } },
  });

  const params = {
    SmsSdkAppId: SMS_SDK_APP_ID,
    SignName: SMS_SIGN_NAME,
    TemplateId: SMS_TEMPLATE_ID,
    TemplateParamSet: [code, String(CODE_TTL_MS / 60000)], // [验证码, 有效分钟数]
    PhoneNumberSet: [`+86${phone}`],
  };
  const r = await client.SendSms(params);
  if (r.SendStatusSet?.[0]?.Code !== "Ok") {
    throw new Error(`SMS_FAIL: ${JSON.stringify(r.SendStatusSet?.[0])}`);
  }
  return r;
}

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

    // 配齐 SMS 环境变量则真发·否则 dev 模式
    if (SMS_CONFIGURED) {
      try {
        await sendRealSms(phone, verifyCode);
        console.log(`[adminAuth] SMS sent to ${phone}`);
      } catch (e) {
        console.error(`[adminAuth] SMS failed for ${phone}:`, e);
        return { ok: false, code: "SMS_SEND_FAILED", error: String(e).slice(0, 100) };
      }
    } else {
      console.log(`[adminAuth dev] code for ${phone}: ${verifyCode}`);
    }

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

// === CORS wrapper for HTTP access service (auto-added, idempotent) ===
if (exports.main && !exports.main.__corsWrapped) {
  const _origMain = exports.main;
  const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
  exports.main = async (event = {}, context) => {
    if (event && event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: CORS_HEADERS, body: "" };
    }
    if (event && typeof event.body === "string") {
      try { event = { ...event, ...JSON.parse(event.body) }; } catch {}
    }
    const result = await _origMain(event, context);
    if (result && typeof result === "object" && "statusCode" in result) {
      return { ...result, headers: { ...CORS_HEADERS, ...(result.headers || {}) } };
    }
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  };
  exports.main.__corsWrapped = true;
}
