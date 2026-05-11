// adminUpdateShareTemplates · 管理分享文案模板
// 入：{ adminToken, action, template, templateId, newOrder }
// 出：{ ok, shareCopyTemplates }
const crypto = require("node:crypto");
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const SECRET = process.env.ADMIN_AUTH_SECRET || "kd-admin-dev-secret-change-me";

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

function generateTemplateId(existingTemplates) {
  const existing = new Set(existingTemplates.map(t => t.id));
  for (let i = 0; i < 10; i++) {
    const id = `c${crypto.randomBytes(4).toString("hex")}`;
    if (!existing.has(id)) return id;
  }
  return `c${Date.now().toString(16).slice(-8)}`;
}

exports.main = async (event = {}) => {
  const { adminToken, action, template = {}, templateId, newOrder } = event;
  const admin = verifyAdminToken(adminToken);
  if (!admin) return { ok: false, code: "UNAUTHORIZED" };

  if (!["create", "update", "delete", "reorder", "toggle"].includes(action)) {
    return { ok: false, code: "INVALID_ACTION" };
  }

  const configDoc = await ensureSystemConfigDoc();
  const now = new Date().toISOString();
  const shareCopyTemplates = Array.isArray(configDoc.shareCopyTemplates)
    ? [...configDoc.shareCopyTemplates]
    : [];

  if (action === "create") {
    if (!template.scene || !template.content) return { ok: false, code: "INVALID_TEMPLATE" };
    const createdTemplate = {
      id: generateTemplateId(shareCopyTemplates),
      scene: String(template.scene),
      content: String(template.content),
      enabled: template.enabled !== undefined ? !!template.enabled : true,
      order: Number.isFinite(template.order) ? template.order : shareCopyTemplates.length + 1,
      createdAt: now,
      updatedAt: now,
    };
    // 追加到数组末尾
    shareCopyTemplates.push(createdTemplate);
  }

  if (action === "update") {
    if (!templateId) return { ok: false, code: "MISSING_TEMPLATE_ID" };
    const index = shareCopyTemplates.findIndex(t => t.id === templateId);
    if (index < 0) return { ok: false, code: "TEMPLATE_NOT_FOUND" };

    if (template.scene !== undefined) shareCopyTemplates[index].scene = String(template.scene);
    if (template.content !== undefined) shareCopyTemplates[index].content = String(template.content);
    if (template.enabled !== undefined) shareCopyTemplates[index].enabled = !!template.enabled;
    if (template.order !== undefined) {
      if (!Number.isFinite(template.order)) return { ok: false, code: "INVALID_ORDER" };
      shareCopyTemplates[index].order = template.order;
    }
    shareCopyTemplates[index].updatedAt = now;
  }

  if (action === "delete") {
    if (!templateId) return { ok: false, code: "MISSING_TEMPLATE_ID" };
    const index = shareCopyTemplates.findIndex(t => t.id === templateId);
    if (index < 0) return { ok: false, code: "TEMPLATE_NOT_FOUND" };
    shareCopyTemplates.splice(index, 1);
  }

  if (action === "reorder") {
    if (!Array.isArray(newOrder)) return { ok: false, code: "INVALID_ORDER_PAYLOAD" };
    const orderMap = new Map();
    for (const item of newOrder) {
      if (!item || !item.id || !Number.isFinite(item.order)) {
        return { ok: false, code: "INVALID_ORDER_PAYLOAD" };
      }
      orderMap.set(item.id, item.order);
    }
    for (const item of shareCopyTemplates) {
      if (orderMap.has(item.id)) {
        item.order = orderMap.get(item.id);
        item.updatedAt = now;
      }
    }
  }

  if (action === "toggle") {
    if (!templateId) return { ok: false, code: "MISSING_TEMPLATE_ID" };
    const index = shareCopyTemplates.findIndex(t => t.id === templateId);
    if (index < 0) return { ok: false, code: "TEMPLATE_NOT_FOUND" };
    shareCopyTemplates[index].enabled = !shareCopyTemplates[index].enabled;
    shareCopyTemplates[index].updatedAt = now;
  }

  await db.collection("system_config").doc("global").update({
    data: {
      shareCopyTemplates,
      updatedAt: now,
      updatedBy: admin.phone || admin.openid || null,
    },
  });

  return { ok: true, shareCopyTemplates };
};
