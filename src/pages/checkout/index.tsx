// 结算页 · 显示订单详情 + 模拟支付
import { Text, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useState } from "react";
import PageWrapper from "~/components/PageWrapper";

interface Order {
  _id: string;
  orderNo: string;
  items: { name: string; priceFen: number; pointsRequired: number; pointsOnly: boolean; qty: number }[];
  totalAmountFen: number;
  pointsDeductedFen: number;
  pointsUsed: number;
  cashAmountFen: number;
  paymentMethod: string;
  status: string;
  expiresAt: string;
}

function fenToYuan(n: number) {
  return (n / 100).toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function formatPoints(n: number) {
  return n.toLocaleString("zh-CN");
}

export default function Checkout() {
  const [order, setOrder] = useState<Order | null>(null);
  const [paying, setPaying] = useState(false);

  const callCloud = async (name: string, data?: any): Promise<any> => {
    try {
      // @ts-expect-error wx 由微信运行时注入
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
    const orderId = options?.orderId;
    if (!orderId) {
      Taro.showToast({ title: "缺少订单 id", icon: "none" });
      return;
    }
    // 用 listMyOrders 查（MVP·后期写 getOrder 云函数）
    const r = await callCloud("listMyOrders", { limit: 50 });
    if (r?.ok) {
      const found = (r.items as any[]).find(o => o._id === orderId);
      if (found) {
        setOrder(found);
      }
    }
  });

  const handlePay = async () => {
    if (!order || paying) {
      return;
    }
    setPaying(true);
    const r = await callCloud("payOrder", { orderId: order._id });
    if (r?.ok) {
      Taro.showToast({ title: "支付成功（mock）", icon: "success" });
      setTimeout(() => {
        Taro.switchTab({ url: "/pages/profile/index" });
      }, 1200);
    } else {
      Taro.showToast({ title: `失败: ${r?.code || "unknown"}`, icon: "none" });
      setPaying(false);
    }
  };

  if (!order) {
    return (
      <PageWrapper navTitle="支付订单" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
        <View className="h-screen flex-center">
          <Text style={{ fontSize: "12px", color: "#937761" }}>读取中…</Text>
        </View>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper navTitle="支付订单" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
      <View className="min-h-screen bg-kd-paper px-6 pt-6">
        {/* 订单号 */}
        <Text style={{ fontSize: "11px", letterSpacing: "0.16em", color: "#937761" }}>
          订单
          {" "}
          {order.orderNo}
        </Text>

        {/* 商品列表 */}
        <View className="mt-4">
          {order.items.map((it, i) => (
            <View
              key={i}
              className="border-b py-4"
              style={{ borderColor: "#E8DFD4" }}
            >
              <View className="flex items-baseline justify-between">
                <Text
                  style={{
                    fontFamily: "var(--kd-font-display)",
                    fontSize: "16px",
                    color: "#3C2218",
                    fontWeight: 400,
                  }}
                >
                  {it.name}
                </Text>
                <Text style={{ fontSize: "13px", color: "#5E3425" }}>
                  ×
                  {it.qty}
                </Text>
              </View>
              <Text className="mt-1 block" style={{ fontSize: "13px", color: "#5E3425" }}>
                {it.pointsOnly
                  ? `${formatPoints(it.pointsRequired)} 积分`
                  : `¥${fenToYuan(it.priceFen)}`}
              </Text>
            </View>
          ))}
        </View>

        {/* 金额详情 */}
        <View className="mt-6 px-2">
          <View className="flex justify-between py-1">
            <Text style={{ fontSize: "12px", color: "#937761" }}>商品金额</Text>
            <Text style={{ fontSize: "12px", color: "#5E3425" }}>
              ¥
              {fenToYuan(order.totalAmountFen)}
            </Text>
          </View>
          {order.pointsUsed > 0 && (
            <View className="flex justify-between py-1">
              <Text style={{ fontSize: "12px", color: "#937761" }}>积分抵扣</Text>
              <Text style={{ fontSize: "12px", color: "#864D39" }}>
                -¥
                {fenToYuan(order.pointsDeductedFen)}
                {" ("}
                {formatPoints(order.pointsUsed)}
                {" 分)"}
              </Text>
            </View>
          )}
          <View className="mt-2 flex items-baseline justify-between py-3" style={{ borderTop: "1px solid #E8DFD4" }}>
            <Text style={{ fontSize: "11px", letterSpacing: "0.16em", color: "#864D39", fontWeight: 500 }}>
              应付
            </Text>
            <Text
              style={{
                fontFamily: "var(--kd-font-display)",
                fontSize: "26px",
                color: "#3C2218",
                fontWeight: 500,
              }}
            >
              {order.paymentMethod === "points_only"
                ? `${formatPoints(order.pointsUsed)} 积分`
                : `¥${fenToYuan(order.cashAmountFen)}`}
            </Text>
          </View>
        </View>

        {/* 支付按钮 */}
        <View
          onClick={handlePay}
          className="mt-8 py-4 text-center"
          style={{
            background: paying ? "#A98D78" : "#3C2218",
            color: "#FBF7F1",
            fontSize: "14px",
            letterSpacing: "0.24em",
          }}
        >
          {paying ? "处理中…" : "确认支付"}
        </View>

        <Text
          className="mt-4 block text-center"
          style={{ fontSize: "10px", color: "#A98D78", letterSpacing: "0.08em" }}
        >
          ⚠ 当前为 mock 支付 · 真实微信支付待接
        </Text>
      </View>
    </PageWrapper>
  );
}
