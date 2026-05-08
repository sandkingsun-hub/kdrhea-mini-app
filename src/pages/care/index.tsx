// KDRHEA · Tab 2 · 诊疗 · 现金 SKU（纯积分商品在 GIFTS 礼遇 Tab）
import { ScrollView, Text, View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { useState } from "react";
import PageWrapper from "~/components/PageWrapper";
import "./index.scss";

interface Sku {
  _id: string;
  name: string;
  category: string;
  type: string;
  priceFen: number;
  pointsOnly: boolean;
  pointsRequired: number;
  description: string;
  status: string;
}

const FILTERS = [
  { key: "", label: "全部" },
  { key: "service:医美注射", label: "注射" },
  { key: "service:医美抗衰", label: "抗衰" },
  { key: "service:医美光电", label: "光电" },
];

function fenToYuan(n: number) {
  return (n / 100).toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function formatPoints(n: number) {
  return n.toLocaleString("zh-CN");
}

export default function Care() {
  const [active, setActive] = useState(0);
  const [items, setItems] = useState<Sku[]>([]);
  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    const filter = FILTERS[idx];
    const [type, category] = filter.key.split(":");
    const params: any = { limit: 50, pointsOnly: false };
    if (type) {
      params.type = type;
    }
    if (category) {
      params.category = category;
    }

    const r = await callCloud("listSku", params);
    if (r?.ok) {
      setItems(r.items);
    }
    setLoading(false);
  };

  useLoad(() => {
    load(0);
  });
  useDidShow(() => {
    load(active);
  });

  const switchFilter = (i: number) => {
    setActive(i);
    load(i);
  };

  const goDetail = (sku: Sku) => {
    Taro.navigateTo({ url: `/pages/sku-detail/index?id=${sku._id}` });
  };

  return (
    <PageWrapper navTitle="诊疗" className="h-full bg-kd-paper" shouldShowNavigationMenu={false} shouldShowBottomActions={false}>
      <View className="min-h-screen bg-kd-paper pb-24">
        {/* 顶部标题 */}
        <View className="px-5 pb-2 pt-4 text-center">
          <Text style={{ fontSize: "11px", letterSpacing: "0.32em", color: "#3C2218", fontWeight: 500 }}>
            C  A  R  E
          </Text>
          <Text
            className="mt-1 block text-center"
            style={{ fontSize: "10px", letterSpacing: "0.12em", color: "#937761" }}
          >
            诊疗 · 现金支付 / 积分抵扣
          </Text>
        </View>

        {/* 分类 chip 横滚 */}
        <ScrollView scrollX className="mt-3 px-3 py-2" style={{ whiteSpace: "nowrap" }}>
          {FILTERS.map((f, i) => (
            <View
              key={f.key || "all"}
              onClick={() => switchFilter(i)}
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

        {/* SKU 列表 */}
        <View className="mt-4 px-5">
          {loading && (
            <Text style={{ fontSize: "12px", color: "#937761" }}>读取中…</Text>
          )}
          {!loading && items.length === 0 && (
            <Text style={{ fontSize: "12px", color: "#937761" }}>暂无项目</Text>
          )}
          {items.map(sku => (
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
                  {sku.pointsOnly
                    ? (
                        <Text
                          style={{
                            fontFamily: "var(--kd-font-display)",
                            fontSize: "15px",
                            color: "#864D39",
                            fontWeight: 400,
                          }}
                        >
                          {formatPoints(sku.pointsRequired)}
                          {" "}
                          分
                        </Text>
                      )
                    : (
                        <Text
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
          ))}
        </View>
      </View>
    </PageWrapper>
  );
}
