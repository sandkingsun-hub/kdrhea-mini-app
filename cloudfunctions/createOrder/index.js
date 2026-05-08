// createOrder · 创建订单（status=pending_payment）·不扣积分不扣库存（payOrder 时执行）
// 入参：{ items: [{skuId, qty}], pointsUsed?: number }
// 出参：{ ok, orderId, orderNo, totalAmountFen, pointsDeductedFen, cashAmountFen, expiresAt }
//
// 校验：
// - items 非空
// - 每个 sku 必须存在 + on_shelf + 库存够（stock=-1 不限）
// - 计算总额
// - pointsUsed 不超过订单 70%（除非纯积分商品 pointsOnly=true·必须等于 pointsRequired）
// - 用户积分余额够（不扣·只校验）
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const ORDER_TIMEOUT_MIN = 15; // 15 分钟未支付自动失效

function genOrderNo() {
  const t = new Date();
  const ymd = t.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const rnd = Math.floor(Math.random() * 9000 + 1000);
  return `KDR${ymd}${rnd}`;
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { items, pointsUsed = 0 } = event;

  if (!openid) return { ok: false, code: 'NO_OPENID' };
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, code: 'EMPTY_ITEMS' };
  }
  if (!Number.isInteger(pointsUsed) || pointsUsed < 0) {
    return { ok: false, code: 'INVALID_POINTS_USED' };
  }

  // 1. 拉所有 SKU 详情
  const skuIds = items.map((i) => i.skuId);
  const skuQuery = await db.collection('sku').where({ _id: db.command.in(skuIds) }).get();
  const skuMap = {};
  for (const s of skuQuery.data) skuMap[s._id] = s;

  // 2. 校验 + 计算
  let totalAmountFen = 0;
  let totalPointsRequired = 0;
  const pricedItems = [];
  let hasPointsOnly = false;
  let hasCashSku = false;

  for (const it of items) {
    if (!it.skuId || !Number.isInteger(it.qty) || it.qty <= 0) {
      return { ok: false, code: 'INVALID_ITEM', message: `item ${JSON.stringify(it)}` };
    }
    const sku = skuMap[it.skuId];
    if (!sku) return { ok: false, code: 'SKU_NOT_FOUND', skuId: it.skuId };
    if (sku.status !== 'on_shelf') return { ok: false, code: 'SKU_OFF_SHELF', skuId: it.skuId };
    if (sku.stock !== -1 && sku.stock < it.qty) {
      return { ok: false, code: 'INSUFFICIENT_STOCK', skuId: it.skuId, stock: sku.stock };
    }
    if (sku.pointsOnly) {
      hasPointsOnly = true;
      totalPointsRequired += sku.pointsRequired * it.qty;
    } else {
      hasCashSku = true;
      totalAmountFen += sku.priceFen * it.qty;
    }
    pricedItems.push({
      skuId: sku._id,
      name: sku.name,
      priceFen: sku.priceFen,
      pointsRequired: sku.pointsRequired,
      pointsOnly: sku.pointsOnly,
      qty: it.qty,
    });
  }

  // 3. 不允许混合纯积分 + 现金商品（简化处理 · MVP 阶段）
  if (hasPointsOnly && hasCashSku) {
    return { ok: false, code: 'MIXED_CART', message: '纯积分商品不能与现金商品混合下单' };
  }

  let pointsDeductedFen = 0;
  let cashAmountFen = 0;

  if (hasPointsOnly) {
    // 纯积分订单 · pointsUsed 必须 = totalPointsRequired
    if (pointsUsed !== totalPointsRequired) {
      return {
        ok: false,
        code: 'POINTS_MISMATCH',
        required: totalPointsRequired,
        provided: pointsUsed,
      };
    }
    cashAmountFen = 0;
  } else {
    // 现金订单 · 校验积分抵扣 70% 上限（每 SKU 单独·这里取最严的）
    // 1 积分 = 1 分钱
    const equivalentFen = pointsUsed;
    const maxRatio = Math.min(...pricedItems.map((i) => skuMap[i.skuId].pointsDeductibleMaxRatio || 0.7));
    const maxDeductFen = Math.floor(totalAmountFen * maxRatio);
    if (equivalentFen > maxDeductFen) {
      return {
        ok: false,
        code: 'EXCEED_DEDUCT_RATIO',
        maxDeductFen,
        provided: equivalentFen,
      };
    }
    pointsDeductedFen = equivalentFen;
    cashAmountFen = totalAmountFen - pointsDeductedFen;
  }

  // 4. 校验积分余额够（仅校验·不扣）
  if (pointsUsed > 0) {
    const accQuery = await db.collection('points_account').where({ _openid: openid }).limit(1).get();
    if (accQuery.data.length === 0 || accQuery.data[0].balance < pointsUsed) {
      return {
        ok: false,
        code: 'INSUFFICIENT_BALANCE',
        balance: accQuery.data[0]?.balance || 0,
        required: pointsUsed,
      };
    }
  }

  // 5. 创建订单 · status=pending_payment
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ORDER_TIMEOUT_MIN * 60000).toISOString();
  const orderNo = genOrderNo();

  const orderInserted = await db.collection('orders').add({
    data: {
      _openid: openid,
      orderNo,
      items: pricedItems,
      totalAmountFen,
      totalPointsRequired,
      pointsDeductedFen,
      pointsUsed,
      cashAmountFen,
      paymentMethod: hasPointsOnly ? 'points_only' : 'wechat_pay',
      status: 'pending_payment',
      isFirstOrder: false, // 在 payOrder 时确定
      inviterOpenid: null, // 在 payOrder 时绑定
      paidAt: null,
      createdAt: now.toISOString(),
      expiresAt,
      refundedAt: null,
    },
  });

  return {
    ok: true,
    orderId: orderInserted._id,
    orderNo,
    totalAmountFen,
    totalPointsRequired,
    pointsDeductedFen,
    pointsUsed,
    cashAmountFen,
    expiresAt,
    paymentMethod: hasPointsOnly ? 'points_only' : 'wechat_pay',
  };
};
