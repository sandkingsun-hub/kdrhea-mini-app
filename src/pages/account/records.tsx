// 订单与积分 · 二级页 · tab 切换
import { Text, View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { useState } from "react";
import PageWrapper from "~/components/PageWrapper";

interface PointsLog {
  _id: string;
  delta: number;
  type: string;
  description: string;
  createdAt: string;
  status: string;
}

interface Order {
  _id: string;
  orderNo: string;
  items: { name: string; qty: number }[];
  status: string;
  cashAmountFen: number;
  pointsUsed: number;
  paidAt: string | null;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  earn_old_customer_activation: "老客激活",
  earn_self_consume: "消费返利",
  earn_referral: "推荐返利",
  earn_in_store_qr: "到店扫码",
  earn_other: "活动奖励",
  spend_deduct: "消费抵扣",
  spend_redeem_sku: "积分兑换",
  spend_gift: "礼品兑换",
  expire: "积分到期",
  admin_adjust: "客服调整",
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending_payment: "待支付",
  paid: "已支付",
  cancelled: "已取消",
  refunded: "已退款",
  expired: "已超时",
};

const TABS = [
  { key: "orders", label: "订单" },
  { key: "points", label: "积分流水" },
];

function fenToYuan(n: number) {
  return (n / 100).toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function formatPoints(n: number) {
  return n.toLocaleString("zh-CN");
}
function shortDate(iso: string) {
  if (!iso) {
    return "";
  }
  return iso.slice(5, 16).replace("T", " ");
}

export default function AccountRecords() {
  const [tabIdx, setTabIdx] = useState(0);
  const [logs, setLogs] = useState<PointsLog[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

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

  const load = async () => {
    setLoading(true);
    const [acc, or] = await Promise.all([
      callCloud("getMyAccount", { logsLimit: 50 }),
      callCloud("listMyOrders", { limit: 30 }),
    ]);
    if (acc?.ok) {
      setLogs(acc.recentLogs || []);
    }
    if (or?.ok) {
      setOrders(or.items);
    }
    setLoading(false);
  };

  useLoad((opts) => {
    if (opts?.tab === "points") {
      setTabIdx(1);
    }
    load();
  });
  useDidShow(load);

  const goTab = (i: number) => {
    if (i === tabIdx) {
      return;
    }
    setTabIdx(i);
  };

  return (
    <PageWrapper navTitle="订单与积分" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
      <View className="min-h-screen bg-kd-paper px-5 pb-12 pt-3">
        {/* 顶部 letter-spacing 标 */}
        <View className="text-center" style={{ paddingTop: "8px" }}>
          <Text style={{ fontSize: "11px", letterSpacing: "0.32em", color: "#3C2218", fontWeight: 500 }}>
            R  E  C  O  R  D  S
          </Text>
        </View>

        {/* tab 切换 */}
        <View
          className="mt-5 flex"
          style={{ border: "1px solid #DCC9B6", background: "#FBF7F1", borderRadius: "999px", overflow: "hidden" }}
        >
          {TABS.map((t, i) => {
            const active = i === tabIdx;
            return (
              <View
                key={t.key}
                onClick={() => goTab(i)}
                style={{
                  flex: 1,
                  background: active ? "#3C2218" : "transparent",
                  padding: "12px 0",
                  textAlign: "center",
                  borderLeft: i === 0 ? "none" : "1px solid #DCC9B6",
                }}
              >
                <Text
                  style={{
                    fontFamily: "var(--kd-font-display)",
                    fontSize: "14px",
                    color: active ? "#FBF7F1" : "#3C2218",
                    letterSpacing: "0.12em",
                  }}
                >
                  {t.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* 列表区域 */}
        <View className="mt-5">
          {loading && (
            <View className="text-center" style={{ paddingTop: "60px" }}>
              <Text style={{ fontSize: "12px", color: "#937761" }}>载入中…</Text>
            </View>
          )}

          {!loading && tabIdx === 0 && (
            <View>
              {orders.length === 0
                ? (
                    <View className="text-center" style={{ paddingTop: "60px" }}>
                      <View className="i-mdi-receipt-text-outline mx-auto" style={{ fontSize: "40px", color: "#DCC9B6" }} />
                      <Text className="mt-3 block" style={{ fontSize: "12px", color: "#937761" }}>
                        暂无订单
                      </Text>
                    </View>
                  )
                : (
                    orders.map(o => (
                      <View
                        key={o._id}
                        className="mb-3 p-4"
                        style={{ background: "#FAF7F3", border: "1px solid #E8DFD4", borderRadius: "12px" }}
                        onClick={() => Taro.navigateTo({ url: `/pages/checkout/index?orderId=${o._id}` })}
                      >
                        <View className="flex items-baseline justify-between">
                          <View style={{ flex: 1, paddingRight: "10px" }}>
                            <Text
                              className="block"
                              style={{
                                fontFamily: "var(--kd-font-display)",
                                fontSize: "15px",
                                color: "#3C2218",
                              }}
                            >
                              {o.items.map(it => it.name).join(" · ")}
                            </Text>
                            <Text className="mt-1 block" style={{ fontSize: "10px", color: "#A98D78", letterSpacing: "0.04em" }}>
                              {o.orderNo}
                            </Text>
                            <Text className="mt-1 block" style={{ fontSize: "11px", color: "#864D39" }}>
                              {shortDate(o.createdAt)}
                              {" · "}
                              {ORDER_STATUS_LABEL[o.status] || o.status}
                            </Text>
                          </View>
                          <Text
                            style={{
                              fontFamily: "var(--kd-font-display)",
                              fontSize: "16px",
                              color: "#3C2218",
                              fontWeight: 500,
                            }}
                          >
                            {o.cashAmountFen > 0 ? `¥${fenToYuan(o.cashAmountFen)}` : `${formatPoints(o.pointsUsed)}分`}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
            </View>
          )}

          {!loading && tabIdx === 1 && (
            <View>
              {logs.length === 0
                ? (
                    <View className="text-center" style={{ paddingTop: "60px" }}>
                      <View className="i-mdi-coin-outline mx-auto" style={{ fontSize: "40px", color: "#DCC9B6" }} />
                      <Text className="mt-3 block" style={{ fontSize: "12px", color: "#937761" }}>
                        暂无积分记录
                      </Text>
                    </View>
                  )
                : (
                    logs.map(log => (
                      <View
                        key={log._id}
                        className="mb-2 p-4"
                        style={{ background: "#FAF7F3", border: "1px solid #E8DFD4", borderRadius: "12px" }}
                      >
                        <View className="flex items-baseline justify-between">
                          <View style={{ flex: 1, paddingRight: "10px" }}>
                            <Text className="block" style={{ fontSize: "13px", color: "#3C2218", fontWeight: 500 }}>
                              {TYPE_LABEL[log.type] || log.type}
                            </Text>
                            <Text className="mt-1 block" style={{ fontSize: "11px", color: "#864D39", lineHeight: "1.5" }}>
                              {log.description}
                            </Text>
                            <Text className="mt-1 block" style={{ fontSize: "10px", color: "#A98D78" }}>
                              {shortDate(log.createdAt)}
                              {log.status === "pending" ? " · 待结算" : ""}
                            </Text>
                          </View>
                          <Text
                            style={{
                              fontFamily: "var(--kd-font-display)",
                              fontSize: "18px",
                              color: log.delta > 0 ? "#3C2218" : "#A98D78",
                              fontWeight: 400,
                            }}
                          >
                            {log.delta > 0 ? "+" : ""}
                            {log.delta}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
            </View>
          )}
        </View>
      </View>
    </PageWrapper>
  );
}
