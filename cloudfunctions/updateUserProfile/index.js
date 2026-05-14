// updateUserProfile · 更新用户的非敏感字段
// 入参：{ nickname?, avatarKind?, avatarUrl? }
// 出参：{ ok, user }
//
// 不接受 phone（走 bindPhone）/ role（走 devSetStaffRole）
// nickname 限 1-20 字
// avatarKind 必须在白名单内
// avatarUrl 必须是 cloud:// 开头（云存储 fileID）
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const ALLOWED_AVATAR_KINDS = new Set([
  "default",
  "flower",
  "leaf",
  "feather",
  "spa",
  "rose",
  "cup",
  "music",
  "paw",
  "coffee",
  "airplane",
  "fire",
]);

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { nickname, avatarKind, avatarUrl, birthDate } = event;

  if (!openid) {
    return { ok: false, code: "NO_OPENID" };
  }

  const data = { lastActiveAt: new Date().toISOString() };

  if (nickname !== undefined) {
    if (typeof nickname !== "string" || nickname.length > 20) {
      return { ok: false, code: "INVALID_NICKNAME" };
    }
    data.nickname = nickname.trim() || null;
  }

  if (avatarKind !== undefined) {
    if (avatarKind !== null && !ALLOWED_AVATAR_KINDS.has(avatarKind)) {
      return { ok: false, code: "INVALID_AVATAR_KIND" };
    }
    data.avatarKind = avatarKind;
    // 选了虚拟形象 · 自动清掉照片
    if (avatarKind && avatarKind !== "default") {
      data.avatarUrl = null;
    }
  }

  if (avatarUrl !== undefined) {
    if (avatarUrl !== null && !/^cloud:\/\//.test(avatarUrl)) {
      return { ok: false, code: "INVALID_AVATAR_URL" };
    }
    data.avatarUrl = avatarUrl;
    // 上传了照片 · 自动清掉虚拟形象
    if (avatarUrl) {
      data.avatarKind = null;
    }
  }

  if (birthDate !== undefined) {
    if (birthDate !== null && (typeof birthDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate))) {
      return { ok: false, code: "INVALID_BIRTH_DATE" };
    }
    data.birthDate = birthDate;
  }

  await db.collection("users").where({ _openid: openid }).update({ data });

  const r = await db.collection("users").where({ _openid: openid }).limit(1).get();
  return { ok: true, user: r.data[0] || null };
};
