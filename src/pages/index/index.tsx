// KDRHEA 小程序首页 · 品牌调性同官网（米白底 + 棕色 + 衬线 hero）
import { Text, View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { useState } from "react";
import { cache } from "~/cache";
import PageWrapper from "~/components/PageWrapper";
import PrivacyPolicyPopup from "~/components/PrivacyPolicyPopup";
import { RouteNames } from "~/constants/routes";
import { switchTab } from "~/utils/route";
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
  return (n / 100).toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function Index() {
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [skus, setSkus] = useState<Sku[]>([]);

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
    // login 同时·拉账户和 SKU
    await callCloud("login");
    const acc = await callCloud("getMyAccount", { logsLimit: 1 });
    if (acc?.ok && acc.account) {
      setAccount({
        balance: acc.account.balance,
        totalEarned: acc.account.totalEarned,
        pendingPoints: acc.account.pendingPoints,
      });
    }
    const list = await callCloud("listSku", { limit: 4 });
    if (list?.ok) {
      setSkus(list.items);
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
    // 切回首页时刷新账户余额
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
      <View className="min-h-screen bg-kd-paper pb-12">
        {/* === 品牌头部 · KDRHEA letter-spacing 标题 === */}
        <View className="px-6 pb-8 pt-12 text-center">
          <Text
            className="kd-eyebrow block"
            style={{ fontSize: "11px", letterSpacing: "0.32em", color: "#937761" }}
          >
            K  D  R  H  E  A
          </Text>
          <Text
            className="kd-display mt-3 block"
            style={{
              fontSize: "13px",
              letterSpacing: "0.18em",
              color: "#937761",
              fontWeight: 300,
            }}
          >
            CLINIC · 徐州
          </Text>
        </View>

        {/* === Hero · 衬线大字问候 === */}
        <View className="px-6 pb-10 pt-4">
          <Text
            className="kd-hero block"
            style={{
              fontFamily: "var(--kd-font-display)",
              fontSize: "32px",
              lineHeight: "1.15",
              color: "#3C2218",
              fontWeight: 400,
            }}
          >
            在这里，
          </Text>
          <Text
            className="kd-hero block"
            style={{
              fontFamily: "var(--kd-font-display)",
              fontSize: "32px",
              lineHeight: "1.15",
              color: "#3C2218",
              fontWeight: 400,
            }}
          >
            被温柔以待。
          </Text>
          <Text
            className="kd-meta mt-4 block"
            style={{ fontSize: "12px", letterSpacing: "0.16em", color: "#A98D78", fontWeight: 300 }}
          >
            A place quietly attentive.
          </Text>
        </View>

        {/* === hairline 分隔 === */}
        <View
          style={{ height: "1px", background: "#E8DFD4", marginLeft: "24px", marginRight: "24px" }}
        />

        {/* === 我的积分卡 · 极简 hairline 边 === */}
        {account && (
          <View className="mt-8 px-6">
            <Text
              className="kd-eyebrow mb-4 block"
              style={{ fontSize: "11px", letterSpacing: "0.24em", color: "#937761" }}
            >
              YOUR  POINTS
            </Text>
            <View className="flex items-baseline">
              <Text
                className="kd-display"
                style={{
                  fontFamily: "var(--kd-font-display)",
                  fontSize: "44px",
                  lineHeight: "1",
                  color: "#3C2218",
                  fontWeight: 400,
                }}
              >
                {formatPoints(account.balance)}
              </Text>
              <Text
                className="ml-3"
                style={{ fontSize: "13px", color: "#937761", fontWeight: 300 }}
              >
                ≈ ¥
                {fenToYuan(account.balance)}
              </Text>
            </View>
            {account.pendingPoints > 0 && (
              <Text
                className="kd-meta mt-2 block"
                style={{ fontSize: "11px", letterSpacing: "0.12em", color: "#A98D78" }}
              >
                {formatPoints(account.pendingPoints)}
                {" "}
                积分待结算
              </Text>
            )}
          </View>
        )}

        {/* === 推荐项目 · 列表式排版 === */}
        {skus.length > 0 && (
          <View className="mt-12 px-6">
            <View className="mb-6 flex items-baseline justify-between">
              <Text
                className="kd-eyebrow"
                style={{ fontSize: "11px", letterSpacing: "0.24em", color: "#937761" }}
              >
                CARE  ·  TREATMENTS
              </Text>
              <Text
                style={{ fontSize: "11px", letterSpacing: "0.12em", color: "#937761" }}
                onClick={() => switchTab(RouteNames.HOME)}
              >
                全部 →
              </Text>
            </View>

            {skus.map(sku => (
              <View
                key={sku._id}
                className="border-b py-5"
                style={{ borderColor: "#E8DFD4" }}
              >
                <View className="flex items-baseline justify-between">
                  <View className="flex-1">
                    <Text
                      className="kd-display block"
                      style={{
                        fontFamily: "var(--kd-font-display)",
                        fontSize: "18px",
                        lineHeight: "1.3",
                        color: "#3C2218",
                        fontWeight: 400,
                      }}
                    >
                      {sku.name}
                    </Text>
                    <Text
                      className="kd-meta mt-1 block"
                      style={{ fontSize: "11px", letterSpacing: "0.16em", color: "#937761" }}
                    >
                      {sku.category}
                    </Text>
                  </View>
                  <View className="ml-4 text-right">
                    {sku.pointsOnly
                      ? (
                          <Text
                            style={{
                              fontFamily: "var(--kd-font-display)",
                              fontSize: "16px",
                              color: "#864D39",
                              fontWeight: 400,
                            }}
                          >
                            {formatPoints(sku.pointsRequired)}
                          </Text>
                        )
                      : (
                          <Text
                            style={{
                              fontFamily: "var(--kd-font-display)",
                              fontSize: "16px",
                              color: "#3C2218",
                              fontWeight: 400,
                            }}
                          >
                            ¥
                            {fenToYuan(sku.priceFen)}
                          </Text>
                        )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* === 品牌价值主张 · 类似官网 BrandStory 一行 === */}
        <View className="mt-16 px-6 text-center">
          <Text
            className="kd-lede block"
            style={{
              fontFamily: "var(--kd-font-display)",
              fontSize: "16px",
              lineHeight: "1.7",
              color: "#5E3425",
              fontWeight: 300,
            }}
          >
            是医疗，更是美学的深耕。
          </Text>
          <Text
            className="kd-lede mt-2 block"
            style={{
              fontFamily: "var(--kd-font-display)",
              fontSize: "16px",
              lineHeight: "1.7",
              color: "#5E3425",
              fontWeight: 300,
            }}
          >
            是定制，更是安全的承诺。
          </Text>
        </View>

        {/* === footer dev 入口 · 灰极小 === */}
        <View className="mt-16 px-6 text-center">
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
