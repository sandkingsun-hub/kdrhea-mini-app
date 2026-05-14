// devSeedCharityCards · seed/upsert 公益认领卡 · 4 张 · 统一 500 积分（1:1 配捐 ¥5）
// dev only · 幂等 · 已存在则补字段 update · 不存在则 add
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function ensureCollection(name) {
  try { await db.collection(name).count(); }
  catch (e) {
    if (String(e).includes("not exist")) try { await db.createCollection(name); } catch {}
  }
}

const ORG_ID = "org_wujin_rescue";
const SEED = [
  {
    _id: "card_xiaoju",
    name: "小橘",
    description: "救助小猫 · 等待温暖",
    tagline: "橘色街猫 · 等待温柔",
    story: "它是某个清晨在咖啡店门口被发现的小橘 · 怕生 · 但会偷偷蹭过来要吃的。眼神干净 · 在等一份温柔。\n\n你的每一次认领 · 都会让一只像小橘一样的小生命 · 拿到口粮 · 救助 · 或者一次绝育手术。",
    story_preview: '"蜷在便利店门口的纸箱里 · 学着不再害怕人的手"',
    featured: true,
    sortOrder: 10,
  },
  {
    _id: "card_xiaonai",
    name: "小奶",
    description: "救助幼犬 · 期待主人",
    tagline: "金毛幼犬 · 期待主人",
    story: "刚断奶就被发现在小区垃圾桶旁。还不太会走 · 却已经学会摇尾巴。它在等一个会蹲下来叫它名字的人。\n\n你认领它 · 不是带它走 · 是替它在世界上多撑一阵子。",
    story_preview: '"刚断奶就被发现在垃圾桶旁 · 已经学会摇尾巴"',
    featured: false,
    sortOrder: 20,
  },
  {
    _id: "card_xiaoban",
    name: "小斑",
    description: "救助流浪犬 · 渴望陪伴",
    tagline: "斑点田园 · 渴望陪伴",
    story: "曾经是某家走丢的孩子 · 现在没人认。它学会了在城市里安静地存活 · 但记忆里还有被叫名字的声音。\n\n善意会让它再被叫一次。",
    story_preview: '"曾经是某家走丢的孩子 · 在城市里安静地存活"',
    featured: false,
    sortOrder: 30,
  },
  {
    _id: "card_xiaohui",
    name: "小灰",
    description: "救助兔兔 · 寻找家",
    tagline: "灰兔 · 寻找家",
    story: "复活节后被随意丢弃的家兔之一。耳朵软软 · 眼神圆圆 · 不属于任何野生生态 · 也不属于流浪世界。\n\n它需要被人重新接住。",
    story_preview: '"复活节后被丢弃的家兔 · 软软的耳朵 · 圆圆的眼"',
    featured: false,
    sortOrder: 40,
  },
];

const POINTS_PRICE = 500;
const DONATED_FEN = 500;

exports.main = async () => {
  await ensureCollection("charity_card_def");
  const now = new Date().toISOString();
  const result = { created: [], updated: [] };

  for (const card of SEED) {
    const exist = await db.collection("charity_card_def").where({ _id: card._id }).limit(1).get();
    const payload = {
      ...card,
      pointsPrice: POINTS_PRICE,
      donatedFen: DONATED_FEN,
      orgId: ORG_ID,
      status: "on_shelf",
    };
    if (exist.data.length > 0) {
      // upsert · update 现有 + 补字段（不动 createdAt / imageUrl 若已设）
      const { _id, ...rest } = payload;
      await db.collection("charity_card_def").doc(_id).update({
        data: { ...rest, updatedAt: now },
      });
      result.updated.push(card._id);
    } else {
      await db.collection("charity_card_def").add({
        data: { ...payload, imageUrl: null, createdAt: now, updatedAt: now },
      });
      result.created.push(card._id);
    }
  }
  return { ok: true, ...result };
};
