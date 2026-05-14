// devSeedCharityOrgs · 一次性 seed 救助机构
// dev only · 重复 invoke 幂等（已存在的不变 · 不存在则建）
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

async function ensureCollection(name) {
  try { await db.collection(name).count(); }
  catch (e) {
    if (String(e).includes("not exist")) try { await db.createCollection(name); } catch {}
  }
}

const SEED = [
  {
    _id: "org_wujin_rescue",
    name: "武进流浪动物救助站",
    description: "常州本地民间救助机构 · 主要救助流浪猫狗 · 配合 KDRHEA 公益认领项目",
    contact: null,
    status: "active",
  },
];

exports.main = async () => {
  await ensureCollection("charity_orgs");
  const now = new Date().toISOString();
  const result = { created: [], skipped: [] };

  for (const org of SEED) {
    const exist = await db.collection("charity_orgs").where({ _id: org._id }).limit(1).get();
    if (exist.data.length > 0) {
      result.skipped.push(org._id);
      continue;
    }
    await db.collection("charity_orgs").add({ data: { ...org, createdAt: now, updatedAt: now } });
    result.created.push(org._id);
  }
  return { ok: true, ...result };
};
