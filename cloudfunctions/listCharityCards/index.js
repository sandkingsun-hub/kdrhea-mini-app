// listCharityCards · 列出可认领的公益认领卡（用户端）
// 入参: { limit?: 20, skip?: 0 }
// 出参: { ok, items: [{_id, name, description, pointsPrice, donatedFen, imageUrl, sortOrder}], total }
const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event = {}) => {
  const { limit = 20, skip = 0 } = event;
  const cap = Math.min(limit, 50);
  const where = { status: "on_shelf" };

  let list = [];
  let total = 0;
  try {
    const [a, b] = await Promise.all([
      db.collection("charity_card_def").where(where).orderBy("sortOrder", "asc").skip(skip).limit(cap).get(),
      db.collection("charity_card_def").where(where).count(),
    ]);
    list = a.data;
    total = b.total;
  } catch (e) {
    if (String(e).includes("not exist") || String(e).includes("database collection not found")) {
      return { ok: true, items: [], total: 0 };
    }
    throw e;
  }

  const items = list.map((c) => ({
    _id: c._id,
    name: c.name,
    description: c.description,
    tagline: c.tagline || c.description || "",
    story: c.story || "",
    story_preview: c.story_preview || "",
    featured: !!c.featured,
    pointsPrice: c.pointsPrice,
    donatedFen: c.donatedFen,
    imageUrl: c.imageUrl || null,
    sortOrder: c.sortOrder || 0,
  }));
  return { ok: true, items, total };
};
