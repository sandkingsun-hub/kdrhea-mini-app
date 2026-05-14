// genCharityShareLink · 凭证页生成分享短码 + 小程序码 wxacode
// 入参: { claimId }
// 出参: { ok, shortCode, link, path, wxacodeFileID }
//   - shortCode: 6 位 [A-Z0-9] · 朋友点链接卡分享自动绑 inviter
//   - wxacodeFileID: cloud:// 小程序码 · 嵌入凭证图 · 朋友圈手发图后长按识别进入
//
// 业务规则:
//   - 必须 claim 归属本人
//   - 累计 shareCount (异步·不阻塞返回)
//   - wxacode 生成失败不阻塞主流程 · 前端可 fallback
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { ok: false, code: "NO_OPENID" };
  const { claimId } = event;
  if (!claimId) return { ok: false, code: "MISSING_CLAIM_ID" };

  // 1. 校验 claim 归属
  let claim;
  try {
    const q = await db.collection("user_charity_claims").doc(claimId).get();
    claim = q.data;
  } catch (e) {
    return { ok: false, code: "CLAIM_NOT_FOUND" };
  }
  if (!claim || claim._openid !== openid) {
    return { ok: false, code: "FORBIDDEN" };
  }

  // 2. 调 generateReferralLink 生成短码
  const r = await cloud.callFunction({
    name: "generateReferralLink",
    data: { channel: "charity", refJournalId: claimId },
  });
  if (!r.result || !r.result.ok) {
    return { ok: false, code: "GEN_LINK_FAILED", detail: r.result };
  }
  const shortCode = r.result.shortCode;

  // 3. 生成 wxacode 小程序码（cloud-native openapi · 需小程序后台启用 wxacodeunlimit）
  //    scene 字段最多 32 字符 · "c=ABC123" = 8 字符 · 安全
  //    page 是落地小程序页面 · charity-home 在 charity 流程入口
  let wxacodeFileID = null;
  try {
    const wxaRes = await cloud.openapi.wxacode.getUnlimited({
      scene: `c=${shortCode}`,
      page: "pages/charity-home/index",
      width: 280,
      autoColor: false,
      lineColor: { r: 134, g: 77, b: 57 }, // #864D39 KDRHEA 主棕色
      isHyaline: true,
    });
    const uploadRes = await cloud.uploadFile({
      cloudPath: `charity/wxacode/${shortCode}.png`,
      fileContent: wxaRes.buffer,
    });
    wxacodeFileID = uploadRes.fileID;
  } catch (e) {
    console.warn("[genCharityShareLink] wxacode generation failed:", e && (e.errMsg || e.message || e));
  }

  // 4. 累计 shareCount · 异步
  db.collection("user_charity_claims").doc(claimId).update({
    data: { shareCount: _.inc(1) },
  }).catch(() => {});

  return {
    ok: true,
    shortCode,
    link: r.result.link,
    path: `/pages/charity-cert/index?claimId=${claimId}&ref=${shortCode}`,
    wxacodeFileID,
  };
};
