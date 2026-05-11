// adminUpdateWelcomeGift · 更新新人礼配置
// 入：{ adminToken, welcomeGift }
// 出：{ ok, welcomeGift }
const crypto = require("node:crypto");
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const SECRET = process.env.ADMIN_AUTH_SECRET || "kd-admin-dev-secret-change-me";
const ALLOWED_COUPON_TYPES = new Set(["experience", "cash", "discount", "physical_gift"]);

const DEFAULT_WELCOME_GIFT = {
  enabled: true,
  couponTemplateId: null,
  couponName: "新人首礼 · 100 元体验券",
  couponType: "experience",
  valueFen: 10000,
  value: "门店任意体验项目抵 100 元",
  description: "新会员注册首次专享·到店核销",
  validDays: 90,
};

function hmac(p) { return crypto.createHmac("sha256", SECRET).update(p).digest("hex").slice(0, 32); }
function b64urlDecode(s) { return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"); }
function verifyAdminToken(token) {
  if (!token || typeof token !== "string") return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig || hmac(encoded) !== sig) return null;
  try {
    const payload = JSON.parse(b64urlDecode(encoded));
    if (!payload || typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (payload.role !== "admin") return null;
    return payload;
  } catch { return null; }
}

function buildDefaultConfig(now) {
  return {
    version: 1,
    shareCopyTemplates: [],
    welcomeGift: { ...DEFAULT_WELCOME_GIFT },
    updatedAt: now,
    updatedBy: null,
  };
}

async function ensureSystemConfigDoc() {
  try {
    const found = await db.collection("system_config").doc("global").get();
    return found.data;
  } catch {
    const now = new Date().toISOString();
    const data = buildDefaultConfig(now);
    await db.collection("system_config").doc("global").set({ data });
    return { _id: "global", ...data };
  }
}

exports.main = async (event = {}) => {
  const { adminToken, welcomeGift } = event;
  const admin = verifyAdminToken(adminToken);
  if (!admin) return { ok: false, code: "UNAUTHORIZED" };

  if (!welcomeGift || typeof welcomeGift !== "object") {
    return { ok: false, code: "MISSING_WELCOME_GIFT" };
  }
  if (!ALLOWED_COUPON_TYPES.has(welcomeGift.couponType)) {
    return { ok: false, code: "INVALID_COUPON_TYPE" };
  }

  await ensureSystemConfigDoc();

  const now = new Date().toISOString();
  await db.collection("system_config").doc("global").update({
    data: {
      welcomeGift,
      updatedAt: now,
      updatedBy: admin.phone || admin.openid || null,
    },
  });

  return { ok: true, welcomeGift };
};
