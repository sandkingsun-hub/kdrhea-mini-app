// adminUpsertCharityCard · admin 后台新增/编辑认领卡
// 入: { adminToken, action: "create"|"update"|"delete"|"list", card: {...} | cardId }
// 出: { ok, card? } | { ok, items? } | { ok }
const crypto = require("node:crypto");
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const SECRET = process.env.ADMIN_AUTH_SECRET || "kd-admin-dev-secret-change-me";
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

async function ensureCollection(name) {
  try { await db.collection(name).count(); }
  catch (e) {
    if (String(e).includes("not exist")) try { await db.createCollection(name); } catch {}
  }
}

exports.main = async (event = {}) => {
  const { adminToken, action, card = {}, cardId } = event;
  if (!verifyAdminToken(adminToken)) return { ok: false, code: "UNAUTHORIZED" };
  await ensureCollection("charity_card_def");
  const now = new Date().toISOString();

  if (action === "list") {
    const r = await db.collection("charity_card_def").orderBy("sortOrder", "asc").limit(100).get();
    return { ok: true, items: r.data };
  }
  if (action === "create") {
    if (!card.name || !Number.isInteger(card.pointsPrice) || card.pointsPrice <= 0) {
      return { ok: false, code: "INVALID_CARD" };
    }
    const doc = {
      _id: card._id || `card_${Date.now()}`,
      name: String(card.name),
      description: card.description || "",
      story: card.story || "",
      pointsPrice: card.pointsPrice,
      donatedFen: card.pointsPrice,           // 1:1 配捐铁律 · 后端强制
      imageUrl: card.imageUrl || null,
      orgId: card.orgId || null,
      status: card.status || "on_shelf",
      sortOrder: card.sortOrder || 0,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection("charity_card_def").add({ data: doc });
    return { ok: true, card: doc };
  }
  if (action === "update") {
    if (!cardId) return { ok: false, code: "MISSING_CARD_ID" };
    const { _id, createdAt, ...rest } = card;
    if (rest.pointsPrice !== undefined) rest.donatedFen = rest.pointsPrice;  // 同步 1:1
    await db.collection("charity_card_def").doc(cardId).update({ data: { ...rest, updatedAt: now } });
    return { ok: true };
  }
  if (action === "delete") {
    if (!cardId) return { ok: false, code: "MISSING_CARD_ID" };
    await db.collection("charity_card_def").doc(cardId).remove();
    return { ok: true };
  }
  return { ok: false, code: "INVALID_ACTION" };
};
