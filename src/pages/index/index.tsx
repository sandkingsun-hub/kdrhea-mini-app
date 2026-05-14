// KDRHEA 小程序首页 · 功能 dashboard 风格 · 品牌调性同官网
import { Text, View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { useState } from "react";
import { cache } from "~/cache";
import PageWrapper from "~/components/PageWrapper";
import PrivacyPolicyPopup from "~/components/PrivacyPolicyPopup";
import { syncTabBarSelected } from "~/utils/tabbarSync";
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
  { key: "appointment", icon: "i-mdi-calendar-clock", label: "预约", route: "/pages/appointment/new" },
  { key: "invite", icon: "i-mdi-share-variant", label: "邀请好友", route: "/pages/invite/card" },
  { key: "medicine", icon: "i-mdi-pill", label: "药品记录", route: "/pages/my-medicines/index" },
  { key: "vouchers", icon: "i-mdi-ticket-percent", label: "我的优惠", route: "/pages/coupons/index" },
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
    const sList = await callCloud("listSku", { type: "service", pointsOnly: false, limit: 3 });
    if (sList?.ok) {
      setServices(sList.items);
    }
    // 积分礼品（纯积分）
    const gList = await callCloud("listSku", { pointsOnly: true, limit: 4 });
    if (gList?.ok) {
      setGifts(gList.items);
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
    syncTabBarSelected(0);
    if (!showPrivacyPolicy) {
      loadHome();
    }
  });

  return (
    <PageWrapper
      navTitle="KDRHEA"
      className="h-full bg-kd-paper"

      shouldShowBottomActions={false}
    >
      <PrivacyPolicyPopup
        open={showPrivacyPolicy}
        onClose={() => {
          setShowPrivacyPolicy(false);
          loadHome();
        }}
      />
      <View className="min-h-screen bg-kd-paper pb-24">
        {/* === 顶部城市选择（精简）=== */}
        <View className="flex items-center justify-end px-5 pb-1 pt-3">
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
            <Text
              style={{ fontSize: "11px", letterSpacing: "0.16em", color: "#937761" }}
              onClick={() => Taro.navigateTo({ url: "/pages/qrcode/index" })}
            >
              我的二维码 →
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
              onClick={() => {
                if (e.route) {
                  Taro.navigateTo({ url: e.route });
                } else {
                  Taro.showToast({ title: `${e.label} · 待开发`, icon: "none" });
                }
              }}
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

        {/* === 公益认领 banner · 入口接 charity-home === */}
        <View
          className="mx-5 mt-8 px-5 py-5"
          style={{
            background: "#F0C0A8",
            borderRadius: "16px",
            position: "relative",
            overflow: "hidden",
          }}
          onClick={() => Taro.navigateTo({ url: "/pages/charity-home/index" })}
        >
          {/* 装饰圆 · 错位 */}
          <View style={{
            position: "absolute",
            top: "-20px",
            right: "-16px",
            width: "100px",
            height: "100px",
            borderRadius: "50%",
            background: "rgba(192,120,96,0.4)",
          }}
          />
          <View style={{
            position: "absolute",
            bottom: "-30px",
            left: "-20px",
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "rgba(168,72,48,0.18)",
          }}
          />

          <View style={{ position: "relative", zIndex: 2 }}>
            <Text
              className="block"
              style={{
                fontSize: "10px",
                letterSpacing: "0.34em",
                textTransform: "uppercase",
                color: "#A84830",
                fontWeight: 600,
                marginBottom: "10px",
              }}
            >
              KINDNESS
            </Text>
            <Text
              className="block"
              style={{
                fontFamily: "var(--kd-font-display)",
                fontSize: "22px",
                lineHeight: "1.2",
                color: "#3C2218",
                fontWeight: 500,
                letterSpacing: "-0.01em",
              }}
            >
              用积分 · 认领一份
              {" "}
              <Text style={{ fontStyle: "italic", color: "#864D39" }}>温柔</Text>
            </Text>
            <Text
              className="mt-2 block"
              style={{
                fontSize: "11.5px",
                color: "#5E3425",
                letterSpacing: "0.04em",
                lineHeight: "1.6",
                opacity: 0.85,
              }}
            >
              KDRHEA 1:1 同等配捐 · 与你一同送达救助伙伴
            </Text>
            <View
              className="mt-4 inline-block"
              style={{
                padding: "6px 14px",
                background: "#3C2218",
                borderRadius: "999px",
              }}
            >
              <Text style={{ fontSize: "11px", color: "#F0C0A8", letterSpacing: "0.08em", fontWeight: 600 }}>
                认领一只 →
              </Text>
            </View>
          </View>
        </View>

        {/* === 治疗服务列表 === */}
        <View className="mt-10 px-5">
          <View className="mb-4 flex items-baseline justify-between">
            <Text style={{ fontSize: "11px", letterSpacing: "0.24em", color: "#864D39", fontWeight: 500 }}>
              CARE  ·  TREATMENTS
            </Text>
            <Text
              style={{ fontSize: "11px", letterSpacing: "0.12em", color: "#937761" }}
              onClick={() => Taro.switchTab({ url: "/pages/care/index" })}
            >
              全部 →
            </Text>
          </View>

          {services.map(sku => (
            <View
              key={sku._id}
              className="border-b py-4"
              style={{ borderColor: "#E8DFD4" }}
              onClick={() => Taro.navigateTo({ url: `/pages/sku-detail/index?id=${sku._id}` })}
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
              <Text
                style={{ fontSize: "11px", letterSpacing: "0.12em", color: "#937761" }}
                onClick={() => Taro.switchTab({ url: "/pages/gifts/index" })}
              >
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
                  onClick={() => Taro.navigateTo({ url: `/pages/sku-detail/index?id=${sku._id}` })}
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
