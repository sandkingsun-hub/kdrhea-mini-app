// devSeedSystemConfig · DEV ONLY · 初始化 system_config.global
// 入：{ force? }
// 出：{ ok, forced }
const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const DEFAULT_TEMPLATES = [
  { id: "c01", scene: "general", content: "想找一家做事不夸张的医美·把这家推给最在意的人。", enabled: true, order: 1 },
  { id: "c02", scene: "general", content: "KDRHEA 科迪芮雅 · 徐州一家做美学的医美机构·分享给你。", enabled: true, order: 2 },
  { id: "c03", scene: "general", content: "跟得上的咨询·跟得下的疗程·这种地方少见了。", enabled: true, order: 3 },
  { id: "c04", scene: "general", content: "找一家可以好好聊的医美·才发现不容易·所以推给你。", enabled: true, order: 4 },
  { id: "c05", scene: "general", content: "医疗·更是美学的深耕。把这家分享给你。", enabled: true, order: 5 },
  { id: "c06", scene: "general", content: "年中刷了一次科迪芮雅·体验给你一份券。", enabled: true, order: 6 },
  { id: "c07", scene: "anti_aging", content: "抗衰是慢功夫·这家会帮你慢下来·体验券送你试试。", enabled: true, order: 7 },
  { id: "c08", scene: "anti_aging", content: "不是每个抗衰项目都得快狠准·我喜欢这里的克制。", enabled: true, order: 8 },
  { id: "c09", scene: "anti_aging", content: "想找一个不被推销的抗衰·这家或许是。", enabled: true, order: 9 },
  { id: "c10", scene: "repair", content: "敏肌信赖的修护机构·KDRHEA 体验券送你·照看一下。", enabled: true, order: 10 },
  { id: "c11", scene: "repair", content: "术后修护·选对地方比选对项目更要紧·分享给你。", enabled: true, order: 11 },
  { id: "c12", scene: "repair", content: "修护期需要专业·徐州本地我用过最稳的。", enabled: true, order: 12 },
];

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

function buildSeedDoc(now) {
  return {
    version: 1,
    shareCopyTemplates: DEFAULT_TEMPLATES.map(item => ({
      ...item,
      createdAt: now,
      updatedAt: now,
    })),
    welcomeGift: { ...DEFAULT_WELCOME_GIFT },
    updatedAt: now,
    updatedBy: "system_seed",
  };
}

exports.main = async (event = {}) => {
  const { force = false } = event;

  let exists = false;
  try {
    const found = await db.collection("system_config").doc("global").get();
    exists = !!found.data;
  } catch {
    exists = false;
  }

  if (exists && !force) {
    return { ok: false, code: "ALREADY_SEEDED" };
  }

  const now = new Date().toISOString();
  const seedDoc = buildSeedDoc(now);
  await db.collection("system_config").doc("global").set({ data: seedDoc });

  return {
    ok: true,
    forced: !!force,
    templateCount: seedDoc.shareCopyTemplates.length,
    updatedAt: now,
  };
};
