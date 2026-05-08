// KDRHEA · Tab 3 · 礼遇 · 纯积分兑换的体验/礼品
import { ScrollView, Text, View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { useState } from "react";
import PageWrapper from "~/components/PageWrapper";

interface Sku {
  _id: string;
  name: string;
  category: string;
  type: string;
  pointsRequired: number;
  description: string;
  status: string;
}

interface Account {
  balance: number;
}

const FILTERS = [
  { key: "", label: "全部" },
  { key: "experience_voucher", label: "体验券" },
  { key: "physical_gift", label: "礼品" },
];

function formatPoints(n: number) {
  return n.toLocaleString("zh-CN");
}

export default function Gifts() {
  const [active, setActive] = useState(0);
  const [items, setItems] = useState<Sku[]>([]);
  const [account, setAccount] = useState<Account | null>(null);

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

  const load = async (idx: number) => {
    const params: any = { limit: 50, pointsOnly: true };
    if (FILTERS[idx].key) {
      params.type = FILTERS[idx].key;
    }
    const r = await callCloud("listSku", params);
    if (r?.ok) {
      setItems(r.items);
    }
    const a = await callCloud("getMyAccount", { logsLimit: 1 });
    if (a?.ok && a.account) {
      setAccount({ balance: a.account.balance });
    }
  };

  useLoad(() => load(0));
  useDidShow(() => load(active));

  const goDetail = (sku: Sku) => {
    Taro.navigateTo({ url: `/pages/sku-detail/index?id=${sku._id}` });
  };

  return (
    <PageWrapper navTitle="礼遇" className="h-full bg-kd-paper" shouldShowNavigationMenu={false} shouldShowBottomActions={false}>
      <View className="min-h-screen bg-kd-paper pb-24">
        {/* 顶部标题 */}
        <View className="px-5 pb-2 pt-4 text-center">
          <Text style={{ fontSize: "11px", letterSpacing: "0.32em", color: "#3C2218", fontWeight: 500 }}>
            G  I  F  T  S
          </Text>
          <Text
            className="mt-1 block text-center"
            style={{ fontSize: "10px", letterSpacing: "0.12em", color: "#937761" }}
          >
            积分兑换 · 体验 · 文创周边
          </Text>
        </View>

        {/* 我的积分余额提示 */}
        {account && (
          <View
            className="mx-5 mt-3 px-4 py-3"
            style={{
              background: "#F5EDE3",
              borderRadius: "4px",
              textAlign: "center",
            }}
          >
            <Text
              style={{ fontSize: "11px", letterSpacing: "0.16em", color: "#864D39" }}
            >
              当前可用积分
              {" "}
              {formatPoints(account.balance)}
            </Text>
          </View>
        )}

        {/* 分类 chip */}
        <ScrollView scrollX className="mt-3 px-3 py-2" style={{ whiteSpace: "nowrap" }}>
          {FILTERS.map((f, i) => (
            <View
              key={f.key || "all"}
              onClick={() => {
                setActive(i);
                load(i);
              }}
              className="mx-1 inline-block px-3 py-1"
              style={{
                background: active === i ? "#3C2218" : "transparent",
                color: active === i ? "#FBF7F1" : "#5E3425",
                border: active === i ? "1px solid #3C2218" : "1px solid #DCC9B6",
                borderRadius: "999px",
                fontSize: "12px",
                letterSpacing: "0.08em",
              }}
            >
              {f.label}
            </View>
          ))}
        </ScrollView>

        {/* 礼品列表 */}
        <View className="mt-4 px-5">
          {items.length === 0 && (
            <Text style={{ fontSize: "12px", color: "#937761" }}>暂无可兑换</Text>
          )}
          {items.map((sku) => {
            const enough = (account?.balance || 0) >= sku.pointsRequired;
            return (
              <View
                key={sku._id}
                className="border-b py-5"
                style={{ borderColor: "#E8DFD4" }}
                onClick={() => goDetail(sku)}
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
                  <View className="ml-3 text-right">
                    <Text
                      style={{
                        fontFamily: "var(--kd-font-display)",
                        fontSize: "15px",
                        color: enough ? "#864D39" : "#A98D78",
                        fontWeight: 400,
                      }}
                    >
                      {formatPoints(sku.pointsRequired)}
                      {" "}
                      分
                    </Text>
                    {!enough && (
                      <Text
                        className="mt-1 block"
                        style={{ fontSize: "10px", color: "#A98D78" }}
                      >
                        差
                        {" "}
                        {formatPoints(sku.pointsRequired - (account?.balance || 0))}
                        {" "}
                        分
                      </Text>
                    )}
                  </View>
                </View>
                <Text
                  className="mt-1 block"
                  style={{ fontSize: "11px", color: "#A98D78", lineHeight: "1.6" }}
                >
                  {sku.description}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </PageWrapper>
  );
}
