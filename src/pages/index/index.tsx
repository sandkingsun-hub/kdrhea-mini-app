// KDRHEA 小程序首页 · 功能 dashboard 风格 · 品牌调性同官网
import { Text, View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { useState } from "react";
import { cache } from "~/cache";
import PageWrapper from "~/components/PageWrapper";
import PrivacyPolicyPopup from "~/components/PrivacyPolicyPopup";
import "./index.scss";

interface Account {
  balance: number;
  totalEarned: number;
  pendingPoints: number;
}

interface Sku {
  _id: string;
  name: string;
  category: string;
  priceFen: number;
  pointsOnly: boolean;
  pointsRequired: number;
  type: string;
}

function formatPoints(n: number): string {
  return n.toLocaleString("zh-CN");
}
function fenToYuan(n: number): string {
  return (n / 100).toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

const QUICK_ENTRIES = [
  { key: "appointment", icon: "i-mdi-calendar-clock", label: "预约" },
  { key: "invite", icon: "i-mdi-share-variant", label: "邀请好友" },
  { key: "journal", icon: "i-mdi-book-open-variant", label: "美学日记" },
  { key: "vouchers", icon: "i-mdi-ticket-percent", label: "我的优惠" },
];

export default function Index() {
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [services, setServices] = useState<Sku[]>([]);
  const [gifts, setGifts] = useState<Sku[]>([]);

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

  const loadHome = async () => {
    await callCloud("login");
    const acc = await callCloud("getMyAccount", { logsLimit: 1 });
    if (acc?.ok && acc.account) {
      setAccount({
        balance: acc.account.balance,
        totalEarned: acc.account.totalEarned,
        pendingPoints: acc.account.pendingPoints,
      });
    }
    // 治疗服务（现金）
    const sList = await callCloud("listSku", { type: "service", limit: 3 });
    if (sList?.ok) {
      setServices(sList.items);
    }
    // 积分礼品（纯积分）
    const gList = await callCloud("listSku", { limit: 6 });
    if (gList?.ok) {
      setGifts((gList.items as Sku[]).filter(s => s.pointsOnly));
    }
  };

  useLoad(() => {
    const hasAgreed = cache.getSync("privacyAgreed");
    if (!hasAgreed) {
      setShowPrivacyPolicy(true);
    }
    loadHome();
  });
  useDidShow(() => {
    if (!showPrivacyPolicy) {
      loadHome();
    }
  });

  if (showPrivacyPolicy) {
    return (
      <PageWrapper navTitle="KDRHEA" className="h-full" shouldShowBottomActions={false}>
        <PrivacyPolicyPopup
          open={showPrivacyPolicy}
          onClose={() => {
            setShowPrivacyPolicy(false);
            loadHome();
          }}
        />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      navTitle="KDRHEA"
      className="h-full bg-kd-paper"
      shouldShowNavigationMenu={false}
    >
      <View className="min-h-screen bg-kd-paper pb-24">
        {/* === 顶部 nav · 极简一行 === */}
        <View className="flex items-center justify-between px-5 pb-3 pt-4">
          <Text style={{ fontSize: "13px", letterSpacing: "0.32em", color: "#3C2218", fontWeight: 500 }}>
            K  D  R  H  E  A
          </Text>
          <Text style={{ fontSize: "11px", letterSpacing: "0.16em", color: "#937761" }}>
            徐州 ▾
          </Text>
        </View>

        {/* === 会员积分卡 · 核心区 · 米白底 + 棕字 === */}
        <View
          className="mx-5 mt-3 px-6 py-7"
          style={{
            background: "#F5EDE3",
            borderRadius: "4px",
          }}
        >
          <View className="flex items-baseline justify-between">
            <Text style={{ fontSize: "11px", letterSpacing: "0.24em", color: "#864D39", fontWeight: 400 }}>
              YOUR  POINTS
            </Text>
            <Text style={{ fontSize: "11px", letterSpacing: "0.16em", color: "#937761" }}>
              扫码核销 →
            </Text>
          </View>
          <View className="mt-3 flex items-baseline">
            <Text
              style={{
                fontFamily: "var(--kd-font-display)",
                fontSize: "40px",
                lineHeight: "1",
                color: "#3C2218",
                fontWeight: 400,
              }}
            >
              {account ? formatPoints(account.balance) : "—"}
            </Text>
            <Text className="ml-2" style={{ fontSize: "13px", color: "#864D39", fontWeight: 300 }}>
              ≈ ¥
              {account ? fenToYuan(account.balance) : "0.00"}
            </Text>
          </View>
          {account && account.pendingPoints > 0 && (
            <Text
              className="mt-2 block"
              style={{ fontSize: "11px", letterSpacing: "0.08em", color: "#864D39" }}
            >
              ✦
              {" "}
              {formatPoints(account.pendingPoints)}
              {" "}
              待结算 · 7 天后到账
            </Text>
          )}
        </View>

        {/* === 4 快捷入口 · icon + 文字 === */}
        <View className="mt-6 flex justify-around px-5">
          {QUICK_ENTRIES.map(e => (
            <View
              key={e.key}
              className="flex flex-col items-center"
              onClick={() => Taro.showToast({ title: `${e.label} · 待开发`, icon: "none" })}
            >
              <View
                className="flex items-center justify-center"
                style={{
                  width: "44px",
                  height: "44px",
                  background: "#FBF7F1",
                  border: "1px solid #E8DFD4",
                  borderRadius: "50%",
                }}
              >
                <View className={`${e.icon} text-base`} style={{ color: "#864D39" }} />
              </View>
              <Text
                className="mt-2"
                style={{ fontSize: "11px", letterSpacing: "0.06em", color: "#5E3425" }}
              >
                {e.label}
              </Text>
            </View>
          ))}
        </View>

        {/* === 治疗服务列表 === */}
        <View className="mt-10 px-5">
          <View className="mb-4 flex items-baseline justify-between">
            <Text style={{ fontSize: "11px", letterSpacing: "0.24em", color: "#864D39", fontWeight: 500 }}>
              CARE  ·  TREATMENTS
            </Text>
            <Text
              style={{ fontSize: "11px", letterSpacing: "0.12em", color: "#937761" }}
              onClick={() => Taro.showToast({ title: "全部项目 · 待开发", icon: "none" })}
            >
              全部 →
            </Text>
          </View>

          {services.map(sku => (
            <View
              key={sku._id}
              className="border-b py-4"
              style={{ borderColor: "#E8DFD4" }}
              onClick={() => Taro.showToast({ title: `${sku.name} · 详情待开发`, icon: "none" })}
            >
              <View className="flex items-baseline justify-between">
                <View className="flex-1">
                  <Text
                    className="block"
                    style={{
                      fontFamily: "var(--kd-font-display)",
                      fontSize: "16px",
                      lineHeight: "1.3",
                      color: "#3C2218",
                      fontWeight: 400,
                    }}
                  >
                    {sku.name}
                  </Text>
                  <Text
                    className="mt-1 block"
                    style={{ fontSize: "11px", letterSpacing: "0.12em", color: "#937761" }}
                  >
                    {sku.category}
                  </Text>
                </View>
                <Text
                  className="ml-3"
                  style={{
                    fontFamily: "var(--kd-font-display)",
                    fontSize: "15px",
                    color: "#3C2218",
                    fontWeight: 400,
                  }}
                >
                  ¥
                  {fenToYuan(sku.priceFen)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* === 积分兑换 · 横向滚动卡片 === */}
        {gifts.length > 0 && (
          <View className="mt-10">
            <View className="mb-4 flex items-baseline justify-between px-5">
              <Text style={{ fontSize: "11px", letterSpacing: "0.24em", color: "#864D39", fontWeight: 500 }}>
                GIFTS  ·  积分兑换
              </Text>
              <Text style={{ fontSize: "11px", letterSpacing: "0.12em", color: "#937761" }}>
                全部 →
              </Text>
            </View>
            <View
              className="flex pl-5"
              style={{ overflowX: "auto", whiteSpace: "nowrap" }}
            >
              {gifts.map(sku => (
                <View
                  key={sku._id}
                  className="mr-3 flex-shrink-0 px-4 py-4"
                  style={{
                    width: "200rpx",
                    background: "#FAF7F3",
                    border: "1px solid #E8DFD4",
                    borderRadius: "4px",
                    display: "inline-block",
                  }}
                  onClick={() => Taro.showToast({ title: `${sku.name} 兑换 · 待开发`, icon: "none" })}
                >
                  <Text
                    className="block"
                    style={{
                      fontFamily: "var(--kd-font-display)",
                      fontSize: "14px",
                      lineHeight: "1.4",
                      color: "#3C2218",
                      fontWeight: 400,
                      whiteSpace: "normal",
                    }}
                  >
                    {sku.name}
                  </Text>
                  <Text
                    className="mt-3 block"
                    style={{ fontSize: "11px", color: "#864D39", letterSpacing: "0.08em" }}
                  >
                    {formatPoints(sku.pointsRequired)}
                    {" "}
                    积分
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* === 底部精神片语（极简）=== */}
        <View className="mt-12 px-5">
          <Text
            className="block text-center"
            style={{
              fontFamily: "var(--kd-font-display)",
              fontSize: "12px",
              letterSpacing: "0.12em",
              color: "#A98D78",
              fontWeight: 300,
            }}
          >
            是医疗，更是美学的深耕
          </Text>
        </View>

        {/* === footer dev 入口 === */}
        <View className="mt-8 text-center">
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
