// SKU 详情页 · 看项目详细 + 立即下单
import { Button, Text, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useState } from "react";
import PageWrapper from "~/components/PageWrapper";

interface Sku {
  _id: string;
  name: string;
  category: string;
  type: string;
  priceFen: number;
  pointsOnly: boolean;
  pointsRequired: number;
  pointsDeductibleMaxRatio: number;
  description: string;
  status: string;
  stock: number;
}

function fenToYuan(n: number) {
  return (n / 100).toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function formatPoints(n: number) {
  return n.toLocaleString("zh-CN");
}

export default function SkuDetail() {
  const [sku, setSku] = useState<Sku | null>(null);
  const [accountBalance, setAccountBalance] = useState(0);
  const [pointsToUse, setPointsToUse] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const callCloud = async (name: string, data?: any): Promise<any> => {
    try {
      // @ts-expect-error wx 由微信运行时注入·TS 不识别
      if (typeof wx === "undefined" || !wx.cloud) {
        return null;
      }
      // @ts-expect-error wx.cloud.callFunction 由微信注入
      const r = await wx.cloud.callFunction({ name, data });
      return r.result;
    } catch {
      return null;
    }
  };

  useLoad(async (options) => {
    const id = options?.id;
    if (!id) {
      Taro.showToast({ title: "缺少 SKU id", icon: "none" });
      return;
    }
    // 用 listSku 拿全部·然后 client-side filter（MVP 简化·后期写 getSku 云函数）
    const r = await callCloud("listSku", { limit: 50 });
    if (r?.ok) {
      const found = (r.items as Sku[]).find(s => s._id === id);
      if (found) {
        setSku(found);
      }
    }
    const acc = await callCloud("getMyAccount", { logsLimit: 1 });
    if (acc?.ok && acc.account) {
      setAccountBalance(acc.account.balance);
    }
  });

  const maxPointsUse = sku
    ? sku.pointsOnly
      ? sku.pointsRequired
      : Math.min(
          accountBalance,
          Math.floor(sku.priceFen * (sku.pointsDeductibleMaxRatio || 0.7)),
        )
    : 0;

  const handleBuy = async () => {
    if (!sku || submitting) {
      return;
    }
    setSubmitting(true);

    let usedPoints = pointsToUse;
    // 纯积分商品 · 强制用满
    if (sku.pointsOnly) {
      usedPoints = sku.pointsRequired;
    }

    const co = await callCloud("createOrder", {
      items: [{ skuId: sku._id, qty: 1 }],
      pointsUsed: usedPoints,
    });
    if (!co?.ok) {
      Taro.showToast({ title: `下单失败: ${co?.code || "unknown"}`, icon: "none" });
      setSubmitting(false);
      return;
    }
    Taro.navigateTo({ url: `/pages/checkout/index?orderId=${co.orderId}` });
    setSubmitting(false);
  };

  if (!sku) {
    return (
      <PageWrapper navTitle="项目详情" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
        <View className="h-screen flex-center">
          <Text style={{ fontSize: "12px", color: "#937761" }}>读取中…</Text>
        </View>
      </PageWrapper>
    );
  }

  const cashAmountFen = sku.pointsOnly ? 0 : sku.priceFen - pointsToUse;

  return (
    <PageWrapper navTitle="项目详情" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
      <View className="min-h-screen bg-kd-paper pb-32">
        {/* 类目 eyebrow */}
        <View className="px-6 pt-6">
          <Text style={{ fontSize: "11px", letterSpacing: "0.24em", color: "#864D39", fontWeight: 500 }}>
            {sku.category.toUpperCase()}
          </Text>
        </View>

        {/* 项目名 */}
        <View className="px-6 pt-2">
          <Text
            style={{
              fontFamily: "var(--kd-font-display)",
              fontSize: "26px",
              lineHeight: "1.25",
              color: "#3C2218",
              fontWeight: 400,
            }}
          >
            {sku.name}
          </Text>
        </View>

        {/* 价格 / 积分 */}
        <View className="mt-4 border-b px-6 pb-6" style={{ borderColor: "#E8DFD4" }}>
          {sku.pointsOnly
            ? (
                <Text
                  style={{
                    fontFamily: "var(--kd-font-display)",
                    fontSize: "32px",
                    color: "#864D39",
                    fontWeight: 400,
                  }}
                >
                  {formatPoints(sku.pointsRequired)}
                  {" "}
                  积分
                </Text>
              )
            : (
                <Text
                  style={{
                    fontFamily: "var(--kd-font-display)",
                    fontSize: "32px",
                    color: "#3C2218",
                    fontWeight: 400,
                  }}
                >
                  ¥
                  {fenToYuan(sku.priceFen)}
                </Text>
              )}
        </View>

        {/* 描述 */}
        <View className="px-6 pt-6">
          <Text
            className="kd-eyebrow block"
            style={{ fontSize: "11px", letterSpacing: "0.24em", color: "#937761", marginBottom: "12px" }}
          >
            ABOUT
          </Text>
          <Text
            style={{
              fontSize: "13px",
              lineHeight: "1.85",
              color: "#5E3425",
              fontWeight: 300,
            }}
          >
            {sku.description}
          </Text>
        </View>

        {/* 积分抵扣（仅现金 SKU 显示） */}
        {!sku.pointsOnly && accountBalance > 0 && maxPointsUse > 0 && (
          <View className="mt-8 border-b px-6 py-6" style={{ borderColor: "#E8DFD4", borderTop: "1px solid #E8DFD4" }}>
            <View className="flex items-baseline justify-between">
              <Text style={{ fontSize: "11px", letterSpacing: "0.24em", color: "#864D39", fontWeight: 500 }}>
                POINTS  ·  抵扣
              </Text>
              <Text style={{ fontSize: "11px", color: "#937761" }}>
                可用
                {formatPoints(accountBalance)}
              </Text>
            </View>
            <View className="mt-3 flex items-baseline justify-between">
              <Text
                style={{
                  fontFamily: "var(--kd-font-display)",
                  fontSize: "20px",
                  color: "#3C2218",
                  fontWeight: 400,
                }}
              >
                -¥
                {fenToYuan(pointsToUse)}
              </Text>
              <View className="flex">
                <View
                  onClick={() => setPointsToUse(0)}
                  className="px-3 py-1"
                  style={{
                    fontSize: "11px",
                    color: pointsToUse === 0 ? "#FBF7F1" : "#5E3425",
                    background: pointsToUse === 0 ? "#3C2218" : "transparent",
                    border: "1px solid #DCC9B6",
                    marginRight: "6px",
                  }}
                >
                  不用
                </View>
                <View
                  onClick={() => setPointsToUse(Math.floor(maxPointsUse / 2))}
                  className="px-3 py-1"
                  style={{
                    fontSize: "11px",
                    color: pointsToUse === Math.floor(maxPointsUse / 2) ? "#FBF7F1" : "#5E3425",
                    background: pointsToUse === Math.floor(maxPointsUse / 2) ? "#3C2218" : "transparent",
                    border: "1px solid #DCC9B6",
                    marginRight: "6px",
                  }}
                >
                  半抵
                </View>
                <View
                  onClick={() => setPointsToUse(maxPointsUse)}
                  className="px-3 py-1"
                  style={{
                    fontSize: "11px",
                    color: pointsToUse === maxPointsUse ? "#FBF7F1" : "#5E3425",
                    background: pointsToUse === maxPointsUse ? "#3C2218" : "transparent",
                    border: "1px solid #DCC9B6",
                  }}
                >
                  顶格
                </View>
              </View>
            </View>
            <Text
              className="mt-2 block"
              style={{ fontSize: "11px", color: "#A98D78" }}
            >
              单笔最多抵扣订单
              {Math.round((sku.pointsDeductibleMaxRatio || 0.7) * 100)}
              % · 当前最大可抵
              {formatPoints(maxPointsUse)}
              积分（¥
              {fenToYuan(maxPointsUse)}
              ）
            </Text>
          </View>
        )}

        {/* 底部 sticky 下单条 */}
        <View
          className="px-6 py-4"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: "#FBF7F1",
            borderTop: "1px solid #E8DFD4",
            zIndex: 100,
          }}
        >
          <View className="flex items-baseline justify-between">
            {/* 客服图标 · 微信原生 button */}
            <Button
              openType="contact"
              sessionFrom={`sku-${sku._id}`}
              style={{
                width: "44px",
                height: "44px",
                minWidth: "44px",
                padding: 0,
                margin: 0,
                lineHeight: "44px",
                background: "#FAF7F3",
                border: "1px solid #DCC9B6",
                borderRadius: "999px",
                color: "#3C2218",
                fontSize: "18px",
                marginRight: "12px",
                flexShrink: 0,
              }}
            >
              💬
            </Button>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: "11px", letterSpacing: "0.16em", color: "#937761" }}>
                应付
              </Text>
              <Text
                className="ml-2"
                style={{
                  fontFamily: "var(--kd-font-display)",
                  fontSize: "22px",
                  color: "#3C2218",
                  fontWeight: 500,
                }}
              >
                {sku.pointsOnly
                  ? `${formatPoints(sku.pointsRequired)} 积分`
                  : `¥${fenToYuan(cashAmountFen)}`}
              </Text>
              {!sku.pointsOnly && pointsToUse > 0 && (
                <Text className="ml-2" style={{ fontSize: "11px", color: "#864D39" }}>
                  +
                  {formatPoints(pointsToUse)}
                  分
                </Text>
              )}
            </View>
            <View
              onClick={handleBuy}
              className="px-6 py-3"
              style={{
                background: submitting ? "#A98D78" : "#3C2218",
                color: "#FBF7F1",
                fontSize: "13px",
                letterSpacing: "0.16em",
              }}
            >
              {submitting ? "处理中…" : sku.pointsOnly ? "立即兑换" : "立即购买"}
            </View>
          </View>
        </View>
      </View>
    </PageWrapper>
  );
}
