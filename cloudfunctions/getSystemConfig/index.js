// getSystemConfig · 小程序客户端读取公开配置
// 入：{}
// 出：{ ok, shareCopyTemplates, welcomeGift }
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

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

function buildFallbackConfig() {
  return {
    shareCopyTemplates: [],
    welcomeGift: { ...DEFAULT_WELCOME_GIFT },
  };
}

function pickPublicWelcomeGift(welcomeGift = {}) {
  return {
    enabled: welcomeGift.enabled !== undefined ? !!welcomeGift.enabled : true,
    couponName: welcomeGift.couponName || DEFAULT_WELCOME_GIFT.couponName,
    couponType: welcomeGift.couponType || DEFAULT_WELCOME_GIFT.couponType,
    valueFen: Number.isFinite(welcomeGift.valueFen) ? welcomeGift.valueFen : DEFAULT_WELCOME_GIFT.valueFen,
    value: welcomeGift.value || DEFAULT_WELCOME_GIFT.value,
    description: welcomeGift.description || DEFAULT_WELCOME_GIFT.description,
    validDays: Number.isFinite(welcomeGift.validDays) ? welcomeGift.validDays : DEFAULT_WELCOME_GIFT.validDays,
  };
}

exports.main = async () => {
  let config = buildFallbackConfig();

  try {
    const res = await db.collection("system_config").doc("global").get();
    if (res.data) {
      config = {
        shareCopyTemplates: Array.isArray(res.data.shareCopyTemplates) ? res.data.shareCopyTemplates : [],
        welcomeGift: res.data.welcomeGift || { ...DEFAULT_WELCOME_GIFT },
      };
    }
  } catch {
    // 文档不存在时返回默认公开配置
  }

  const shareCopyTemplates = config.shareCopyTemplates
    .filter(item => item && item.enabled === true)
    .sort((a, b) => {
      const orderA = Number.isFinite(a.order) ? a.order : 999999;
      const orderB = Number.isFinite(b.order) ? b.order : 999999;
      return orderA - orderB;
    })
    .map(item => ({
      id: item.id,
      scene: item.scene,
      content: item.content,
    }));

  const welcomeGift = pickPublicWelcomeGift(config.welcomeGift);

  return { ok: true, shareCopyTemplates, welcomeGift };
};
