// 券包 · 我的优惠
import { Text, View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { useState } from "react";
import PageWrapper from "~/components/PageWrapper";

interface Coupon {
  _id: string;
  couponName: string;
  couponType: string;
  description: string;
  value: string;
  validFrom: string;
  validUntil: string;
  status: string;
  source: string;
  couponNo: string;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  experience: "体验券",
  discount: "折扣券",
  cash: "抵用券",
  physical_gift: "实物礼品",
  custom: "礼券",
};

const SOURCE_LABEL: Record<string, string> = {
  gifts_redeem: "礼遇兑换",
  staff_grant: "门店赠送",
  consume_reward: "消费返赠",
  push: "活动赠送",
  promotion: "促销活动",
  old_customer_activation: "老客感恩",
};

const TABS = [
  { key: "active", label: "可用" },
  { key: "used", label: "已用" },
  { key: "expired", label: "已过期" },
];

function shortDate(iso: string) {
  if (!iso) {
    return "";
  }
  return iso.slice(0, 10);
}

function daysUntil(iso: string) {
  if (!iso) {
    return 999;
  }
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

export default function CouponsList() {
  const [tabIdx, setTabIdx] = useState(0);
  const [items, setItems] = useState<Coupon[]>([]);
  const [counts, setCounts] = useState({ active: 0, used: 0, expired: 0, revoked: 0 });
  const [loading, setLoading] = useState(true);

  const callCloud = async (n: string, d?: any): Promise<any> => {
    try {
      // @ts-expect-error wx 由微信运行时注入
      if (typeof wx === "undefined" || !wx.cloud) {
        return null;
      }
      // @ts-expect-error wx.cloud.callFunction 由微信注入
      const r = await wx.cloud.callFunction({ name: n, data: d });
      return r.result;
    } catch {
      return null;
    }
  };

  const load = async (statusKey: string) => {
    setLoading(true);
    const r = await callCloud("listMyCoupons", { status: statusKey, limit: 50 });
    if (r?.ok) {
      setItems(r.items);
      setCounts(r.counts);
    }
    setLoading(false);
  };

  useLoad(() => load(TABS[0].key));
  useDidShow(() => load(TABS[tabIdx].key));

  const goTab = (i: number) => {
    if (i === tabIdx) {
      return;
    }
    setTabIdx(i);
    load(TABS[i].key);
  };

  return (
    <PageWrapper navTitle="我的优惠" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
      <View className="min-h-screen bg-kd-paper px-5 pb-12 pt-3">
        {/* 顶部 letter-spacing 标 */}
        <View className="text-center" style={{ paddingTop: "8px" }}>
          <Text style={{ fontSize: "11px", letterSpacing: "0.32em", color: "#3C2218", fontWeight: 500 }}>
            C  O  U  P  O  N  S
          </Text>
          <Text className="mt-2 block" style={{ fontSize: "11px", letterSpacing: "0.06em", color: "#937761" }}>
            可用
            {" "}
            {counts.active}
            {" "}
            · 已用
            {" "}
            {counts.used}
            {" "}
            · 过期
            {" "}
            {counts.expired}
          </Text>
        </View>

        {/* tab 切换 · 圆角 */}
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
                  padding: "10px 0",
                  textAlign: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "var(--kd-font-display)",
                    fontSize: "13px",
                    color: active ? "#FBF7F1" : "#3C2218",
                    letterSpacing: "0.08em",
                  }}
                >
                  {t.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* 列表 */}
        <View className="mt-5">
          {loading && (
            <View className="text-center" style={{ paddingTop: "60px" }}>
              <Text style={{ fontSize: "12px", color: "#937761" }}>载入中…</Text>
            </View>
          )}

          {!loading && items.length === 0 && (
            <View className="text-center" style={{ paddingTop: "60px" }}>
              <View className="i-mdi-ticket-percent-outline mx-auto" style={{ fontSize: "44px", color: "#DCC9B6" }} />
              <Text className="mt-3 block" style={{ fontSize: "12px", color: "#937761" }}>
                {tabIdx === 0 ? "暂无可用券" : (tabIdx === 1 ? "尚无使用记录" : "无过期券")}
              </Text>
              {tabIdx === 0 && (
                <Text className="mt-2 block" style={{ fontSize: "11px", color: "#A98D78" }}>
                  到「礼遇」用积分兑换体验券
                </Text>
              )}
            </View>
          )}

          {!loading && items.map(c => <CouponCard key={c._id} coupon={c} active={c.status === "active"} />)}
        </View>
      </View>
    </PageWrapper>
  );
}

function CouponCard({ coupon, active }: { coupon: Coupon; active: boolean }) {
  const days = daysUntil(coupon.validUntil);
  const expiringSoon = active && days <= 14;
  const dim = !active;

  return (
    <View
      className="mb-3"
      onClick={() => active && Taro.navigateTo({ url: `/pages/coupons/detail?couponId=${coupon._id}` })}
      style={{
        borderRadius: "16px",
        background: dim ? "#F5F0E9" : "#FAF7F3",
        border: "1px solid #E8DFD4",
        overflow: "hidden",
        opacity: dim ? 0.55 : 1,
      }}
    >
      <View className="flex">
        {/* 左侧主信息 */}
        <View style={{ flex: 1, padding: "16px 14px" }}>
          <View className="flex items-baseline">
            <View
              style={{
                background: "#3C2218",
                color: "#FBF7F1",
                fontSize: "9px",
                letterSpacing: "0.16em",
                padding: "2px 8px",
                borderRadius: "999px",
              }}
            >
              {TYPE_LABEL[coupon.couponType] || coupon.couponType}
            </View>
            {expiringSoon && (
              <Text className="ml-2" style={{ fontSize: "10px", color: "#A65A3F", letterSpacing: "0.06em" }}>
                ·
                {" "}
                {days <= 0 ? "今日到期" : `${days} 天后到期`}
              </Text>
            )}
          </View>

          <Text
            className="mt-2 block"
            style={{
              fontFamily: "var(--kd-font-display)",
              fontSize: "16px",
              color: "#3C2218",
              fontWeight: 500,
              letterSpacing: "0.04em",
            }}
          >
            {coupon.couponName}
          </Text>

          {coupon.value && (
            <Text className="mt-1 block" style={{ fontSize: "11px", color: "#864D39", lineHeight: "1.5" }}>
              {coupon.value}
            </Text>
          )}

          <Text className="mt-2 block" style={{ fontSize: "10px", color: "#937761" }}>
            {SOURCE_LABEL[coupon.source] || ""}
            {" "}
            · 至
            {shortDate(coupon.validUntil)}
          </Text>
        </View>

        {/* 中间虚线 */}
        <View
          style={{
            width: "1px",
            margin: "16px 0",
            backgroundImage: "linear-gradient(to bottom, #DCC9B6 50%, transparent 50%)",
            backgroundSize: "1px 6px",
            backgroundRepeat: "repeat-y",
            position: "relative",
          }}
        >
          {/* 上下半圆缺口 */}
          <View
            style={{
              position: "absolute",
              top: "-10px",
              left: "-6px",
              width: "12px",
              height: "12px",
              background: "#FBF7F1",
              borderRadius: "999px",
            }}
          />
          <View
            style={{
              position: "absolute",
              bottom: "-10px",
              left: "-6px",
              width: "12px",
              height: "12px",
              background: "#FBF7F1",
              borderRadius: "999px",
            }}
          />
        </View>

        {/* 右侧动作区 */}
        <View
          style={{
            width: "84px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 8px",
          }}
        >
          {active
            ? (
                <>
                  <View className="i-mdi-qrcode-scan" style={{ fontSize: "26px", color: "#3C2218" }} />
                  <Text
                    className="mt-2"
                    style={{
                      fontFamily: "var(--kd-font-display)",
                      fontSize: "12px",
                      color: "#3C2218",
                      letterSpacing: "0.18em",
                    }}
                  >
                    使用
                  </Text>
                </>
              )
            : (
                <Text
                  style={{
                    fontFamily: "var(--kd-font-display)",
                    fontSize: "13px",
                    color: "#937761",
                    letterSpacing: "0.16em",
                  }}
                >
                  {coupon.status === "used" ? "已用" : "过期"}
                </Text>
              )}
        </View>
      </View>

      {/* 券号尾部 */}
      <View
        style={{
          background: "#F5EDE3",
          padding: "6px 14px",
          fontSize: "10px",
          color: "#864D39",
          fontFamily: "monospace",
          letterSpacing: "0.08em",
          textAlign: "center",
        }}
      >
        NO.
        {" "}
        {coupon.couponNo}
      </View>
    </View>
  );
}
