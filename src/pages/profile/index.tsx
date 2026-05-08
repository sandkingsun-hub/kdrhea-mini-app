// 我的 · Tab 3 · 用户卡 + 流水 + 订单 + 邀请
import { Text, View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { useState } from "react";
import PageWrapper from "~/components/PageWrapper";
import "./index.scss";

interface User {
  _openid: string;
  phone: string | null;
  registeredAt: string;
  activatedFromOldCustomer: boolean;
}

interface Account {
  balance: number;
  totalEarned: number;
  totalSpent: number;
  pendingPoints: number;
}

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

export default function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [logs, setLogs] = useState<PointsLog[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

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

  const load = async () => {
    const lg = await callCloud("login");
    if (lg?.ok && lg.user) {
      setUser({
        _openid: lg.user._openid,
        phone: lg.user.phone,
        registeredAt: lg.user.registeredAt,
        activatedFromOldCustomer: lg.user.activatedFromOldCustomer,
      });
    }
    const acc = await callCloud("getMyAccount", { logsLimit: 8 });
    if (acc?.ok) {
      setAccount({
        balance: acc.account.balance,
        totalEarned: acc.account.totalEarned,
        totalSpent: acc.account.totalSpent,
        pendingPoints: acc.account.pendingPoints,
      });
      setLogs(acc.recentLogs || []);
    }
    const or = await callCloud("listMyOrders", { limit: 5 });
    if (or?.ok) {
      setOrders(or.items);
    }
  };

  useLoad(load);
  useDidShow(load);

  const handleInvite = async () => {
    const r = await callCloud("generateReferralLink", { channel: "direct_share" });
    if (!r?.ok) {
      Taro.showToast({ title: "生成失败", icon: "none" });
      return;
    }
    Taro.setClipboardData({
      data: `KDRHEA · 我的邀请码 ${r.shortCode}`,
      success: () => Taro.showToast({ title: "邀请码已复制", icon: "success" }),
    });
  };

  return (
    <PageWrapper navTitle="我的" className="h-full bg-kd-paper" shouldShowNavigationMenu={false} shouldShowBottomActions={false}>
      <View className="min-h-screen bg-kd-paper pb-24">
        {/* 顶部 ME 标签 */}
        <View className="px-6 pb-2 pt-6">
          <Text style={{ fontSize: "11px", letterSpacing: "0.32em", color: "#937761" }}>
            M  E
          </Text>
        </View>

        {/* 用户信息 */}
        <View className="px-6 pb-6 pt-4" style={{ borderBottom: "1px solid #E8DFD4" }}>
          <Text
            className="block"
            style={{
              fontFamily: "var(--kd-font-display)",
              fontSize: "20px",
              color: "#3C2218",
              fontWeight: 400,
            }}
          >
            {user?.phone ? user.phone : "微信用户"}
          </Text>
          <Text className="mt-1 block" style={{ fontSize: "11px", color: "#937761" }}>
            {user
              ? `注册于 ${user.registeredAt.slice(0, 10)}`
              : "未登录"}
          </Text>
          {user?.activatedFromOldCustomer && (
            <View
              className="mt-2 inline-block px-2 py-0.5"
              style={{
                fontSize: "10px",
                letterSpacing: "0.12em",
                color: "#864D39",
                background: "#F5EDE3",
                border: "1px solid #DCC9B6",
              }}
            >
              已激活老客
            </View>
          )}
        </View>

        {/* 积分概览 */}
        {account && (
          <View className="px-6 py-6" style={{ borderBottom: "1px solid #E8DFD4" }}>
            <View className="flex justify-between">
              <View>
                <Text style={{ fontSize: "11px", letterSpacing: "0.16em", color: "#937761" }}>
                  当前可用
                </Text>
                <Text
                  className="mt-1 block"
                  style={{
                    fontFamily: "var(--kd-font-display)",
                    fontSize: "24px",
                    color: "#3C2218",
                    fontWeight: 500,
                  }}
                >
                  {formatPoints(account.balance)}
                </Text>
              </View>
              <View>
                <Text style={{ fontSize: "11px", letterSpacing: "0.16em", color: "#937761" }}>
                  累计获得
                </Text>
                <Text
                  className="mt-1 block"
                  style={{
                    fontFamily: "var(--kd-font-display)",
                    fontSize: "18px",
                    color: "#5E3425",
                    fontWeight: 400,
                  }}
                >
                  {formatPoints(account.totalEarned)}
                </Text>
              </View>
              <View>
                <Text style={{ fontSize: "11px", letterSpacing: "0.16em", color: "#937761" }}>
                  待结算
                </Text>
                <Text
                  className="mt-1 block"
                  style={{
                    fontFamily: "var(--kd-font-display)",
                    fontSize: "18px",
                    color: "#864D39",
                    fontWeight: 400,
                  }}
                >
                  {formatPoints(account.pendingPoints)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* 流水 */}
        <View className="px-6 py-6" style={{ borderBottom: "1px solid #E8DFD4" }}>
          <Text style={{ fontSize: "11px", letterSpacing: "0.24em", color: "#864D39", fontWeight: 500 }}>
            POINTS  ·  流水
          </Text>
          <View className="mt-3">
            {logs.length === 0 && (
              <Text style={{ fontSize: "12px", color: "#937761" }}>暂无积分记录</Text>
            )}
            {logs.map(log => (
              <View key={log._id} className="border-b py-3" style={{ borderColor: "#F5EDE3" }}>
                <View className="flex items-baseline justify-between">
                  <View className="flex-1">
                    <Text className="block" style={{ fontSize: "13px", color: "#3C2218" }}>
                      {TYPE_LABEL[log.type] || log.type}
                    </Text>
                    <Text className="mt-1 block" style={{ fontSize: "11px", color: "#937761" }}>
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
                      fontSize: "16px",
                      color: log.delta > 0 ? "#3C2218" : "#A98D78",
                      fontWeight: 400,
                    }}
                  >
                    {log.delta > 0 ? "+" : ""}
                    {log.delta}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 订单 */}
        <View className="px-6 py-6" style={{ borderBottom: "1px solid #E8DFD4" }}>
          <Text style={{ fontSize: "11px", letterSpacing: "0.24em", color: "#864D39", fontWeight: 500 }}>
            ORDERS  ·  我的订单
          </Text>
          <View className="mt-3">
            {orders.length === 0 && (
              <Text style={{ fontSize: "12px", color: "#937761" }}>暂无订单</Text>
            )}
            {orders.map(o => (
              <View
                key={o._id}
                className="border-b py-3"
                style={{ borderColor: "#F5EDE3" }}
                onClick={() => Taro.navigateTo({ url: `/pages/checkout/index?orderId=${o._id}` })}
              >
                <View className="flex items-baseline justify-between">
                  <View className="flex-1">
                    <Text
                      className="block"
                      style={{
                        fontFamily: "var(--kd-font-display)",
                        fontSize: "14px",
                        color: "#3C2218",
                      }}
                    >
                      {o.items.map(it => it.name).join(" · ")}
                    </Text>
                    <Text className="mt-1 block" style={{ fontSize: "10px", color: "#A98D78" }}>
                      {o.orderNo}
                      {" · "}
                      {ORDER_STATUS_LABEL[o.status] || o.status}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontFamily: "var(--kd-font-display)",
                      fontSize: "14px",
                      color: "#3C2218",
                    }}
                  >
                    {o.cashAmountFen > 0 ? `¥${fenToYuan(o.cashAmountFen)}` : `${formatPoints(o.pointsUsed)}分`}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 操作入口 */}
        <View className="px-6 py-2">
          <View
            className="flex items-center justify-between border-b py-4"
            style={{ borderColor: "#E8DFD4" }}
            onClick={handleInvite}
          >
            <Text style={{ fontSize: "13px", color: "#3C2218" }}>分享给在意的人</Text>
            <Text style={{ fontSize: "11px", color: "#937761" }}>→</Text>
          </View>
          <View
            className="flex items-center justify-between border-b py-4"
            style={{ borderColor: "#E8DFD4" }}
            onClick={() => Taro.showToast({ title: "我的优惠 · 待开发", icon: "none" })}
          >
            <Text style={{ fontSize: "13px", color: "#3C2218" }}>我的优惠</Text>
            <Text style={{ fontSize: "11px", color: "#937761" }}>→</Text>
          </View>
          <View
            className="flex items-center justify-between border-b py-4"
            style={{ borderColor: "#E8DFD4" }}
            onClick={() => Taro.showToast({ title: "联系客服 · 待开发", icon: "none" })}
          >
            <Text style={{ fontSize: "13px", color: "#3C2218" }}>联系客服</Text>
            <Text style={{ fontSize: "11px", color: "#937761" }}>→</Text>
          </View>
        </View>

        {/* footer dev */}
        <View className="mt-6 px-6 text-center">
          <Text
            style={{ fontSize: "10px", letterSpacing: "0.12em", color: "#C4AD98" }}
            onClick={() => Taro.navigateTo({ url: "/pages/devtools/index" })}
          >
            ⚙ developer · dev only
          </Text>
        </View>
      </View>
    </PageWrapper>
  );
}
