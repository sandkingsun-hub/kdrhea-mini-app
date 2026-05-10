// adminListUsers · 用户列表（手机号搜索 + 分页）
// 入：{ adminToken, search?, limit?: 50, skip?: 0 }
// 出：{ ok, items, total, hasMore }
//
// 不返回 phoneHash·客户端不需要
const crypto = require("node:crypto");
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

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

exports.main = async (event = {}) => {
  const { adminToken, search = "", roles = null, limit = 50, skip = 0 } = event;
  const admin = verifyAdminToken(adminToken);
  if (!admin) return { ok: false, code: "UNAUTHORIZED" };

  const cap = Math.min(limit, 200);

  const where = {};
  // role 过滤·分配券时只拉员工
  if (Array.isArray(roles) && roles.length > 0) {
    where.role = _.in(roles);
  }

  // 搜手机号·支持部分匹配
  if (search && /^\d+$/.test(search)) {
    where.phone = db.RegExp({ regexp: search, options: "i" });
  } else if (search) {
    where.nickname = db.RegExp({ regexp: search, options: "i" });
  }

  const [list, count] = await Promise.all([
    db.collection("users").where(where).orderBy("registeredAt", "desc").skip(skip).limit(cap).get(),
    db.collection("users").where(where).count(),
  ]);

  // 脱敏 + 减字段
  const items = list.data.map(u => ({
    _id: u._id,
    _openid: u._openid,
    nickname: u.nickname || null,
    phone: u.phone || null,
    avatarUrl: u.avatarUrl || null,
    avatarKind: u.avatarKind || "default",
    role: u.role || "customer",
    registeredAt: u.registeredAt,
    lastActiveAt: u.lastActiveAt,
    activatedFromOldCustomer: !!u.activatedFromOldCustomer,
  }));

  return { ok: true, items, total: count.total, hasMore: skip + items.length < count.total };
};
