// 券详情 · 二维码核销
// 二维码内容 = JSON {t:'coupon', no, vt}·员工 scanner 扫到后调 redeemCoupon
import { Canvas, Text, View } from "@tarojs/components";
import Taro, { useLoad, useReady } from "@tarojs/taro";
import qrcode from "qrcode-generator";
import { useEffect, useState } from "react";
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
  verifyToken: string;
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

function shortDate(iso: string) {
  return iso ? iso.slice(0, 10) : "";
}

export default function CouponDetail() {
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [pageReady, setPageReady] = useState(false);

  useReady(() => {
    setPageReady(true);
  });

  const callCloud = async (n: string, d?: any): Promise<any> => {
    try {
      if (typeof wx === "undefined" || !wx.cloud) {
        return null;
      }

      const r = await wx.cloud.callFunction({ name: n, data: d });
      return r.result;
    } catch {
      return null;
    }
  };

  // Canvas 2D：page ready + coupon active 才画
  // 用 useReady 替代 setTimeout/nextTick·确保 Canvas DOM 真挂载后再 query
  useEffect(() => {
    if (!pageReady || !coupon || coupon.status !== "active") {
      return;
    }
    const payload = JSON.stringify({ t: "coupon", no: coupon.couponNo, vt: coupon.verifyToken });

    Taro.createSelectorQuery()
      .select("#coupon-qr-canvas")
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res?.[0]?.node;
        if (!canvas) {
          console.warn("[coupon-qr] canvas node not ready", res);
          return;
        }
        const cssWidth = res[0].width || 200;
        const cssHeight = res[0].height || 200;

        const qr = qrcode(0, "M");
        qr.addData(payload);
        qr.make();
        const moduleCount = qr.getModuleCount();

        let dpr = 2;
        try {
          dpr = Taro.getWindowInfo().pixelRatio || 2;
        } catch {}

        canvas.width = Math.round(cssWidth * dpr);
        canvas.height = Math.round(cssHeight * dpr);

        const ctx = canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = "#FBF7F1";
        ctx.fillRect(0, 0, cssWidth, cssHeight);
        ctx.fillStyle = "#3C2218";

        const cell = cssWidth / moduleCount;
        for (let r = 0; r < moduleCount; r++) {
          for (let c = 0; c < moduleCount; c++) {
            if (qr.isDark(r, c)) {
              ctx.fillRect(c * cell, r * cell, cell + 0.5, cell + 0.5);
            }
          }
        }
      });
  }, [pageReady, coupon]);

  useLoad(async (options) => {
    const id = options?.couponId;
    if (!id) {
      setLoadFailed(true);
      return;
    }
    const r = await callCloud("getCouponDetail", { couponId: id });
    if (r?.ok && r.coupon) {
      setCoupon(r.coupon);
    } else {
      setLoadFailed(true);
    }
  });

  if (loadFailed) {
    return (
      <PageWrapper navTitle="券详情" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
        <View className="flex flex-col items-center px-6 pt-20">
          <View className="i-mdi-ticket-confirmation-outline" style={{ fontSize: "44px", color: "#DCC9B6" }} />
          <Text className="mt-4" style={{ fontSize: "13px", color: "#3C2218" }}>该券不可用或已被收回</Text>
        </View>
      </PageWrapper>
    );
  }

  if (!coupon) {
    return (
      <PageWrapper navTitle="券详情" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
        <View className="h-screen flex-center">
          <Text style={{ fontSize: "12px", color: "#937761" }}>载入中…</Text>
        </View>
      </PageWrapper>
    );
  }

  const isUsable = coupon.status === "active";

  return (
    <PageWrapper navTitle="券详情" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
      <View className="min-h-screen bg-kd-paper px-5 pb-12 pt-3">
        {/* 顶部 letter-spacing 标 */}
        <View className="text-center" style={{ paddingTop: "8px" }}>
          <Text style={{ fontSize: "11px", letterSpacing: "0.32em", color: "#3C2218", fontWeight: 500 }}>
            C  O  U  P  O  N
          </Text>
        </View>

        {/* 大券卡 */}
        <View
          className="mt-5"
          style={{
            background: isUsable ? "#FAF7F3" : "#F5F0E9",
            border: "1px solid #DCC9B6",
            borderRadius: "16px",
            overflow: "hidden",
            opacity: isUsable ? 1 : 0.65,
          }}
        >
          {/* 顶部色条 */}
          <View style={{ background: "#3C2218", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <View
              style={{
                background: "#FBF7F1",
                color: "#3C2218",
                fontSize: "10px",
                letterSpacing: "0.18em",
                padding: "3px 12px",
                borderRadius: "999px",
              }}
            >
              {TYPE_LABEL[coupon.couponType] || coupon.couponType}
            </View>
            <Text style={{ fontSize: "10px", color: "#DCC9B6", letterSpacing: "0.06em" }}>
              {SOURCE_LABEL[coupon.source] || ""}
            </Text>
          </View>

          {/* 主信息 */}
          <View style={{ padding: "20px 18px", textAlign: "center" }}>
            <Text
              style={{
                fontFamily: "var(--kd-font-display)",
                fontSize: "20px",
                color: "#3C2218",
                fontWeight: 500,
                letterSpacing: "0.04em",
              }}
            >
              {coupon.couponName}
            </Text>
            {coupon.value && (
              <Text className="mt-2 block" style={{ fontSize: "12px", color: "#864D39", lineHeight: "1.7" }}>
                {coupon.value}
              </Text>
            )}
            <Text className="mt-3 block" style={{ fontSize: "10px", color: "#937761", letterSpacing: "0.06em" }}>
              有效期
              {" "}
              {shortDate(coupon.validFrom)}
              {" "}
              ~
              {" "}
              {shortDate(coupon.validUntil)}
            </Text>
          </View>

          {/* 虚线分隔 */}
          <View
            style={{
              height: "1px",
              margin: "0 16px",
              backgroundImage: "linear-gradient(to right, #DCC9B6 50%, transparent 50%)",
              backgroundSize: "6px 1px",
              backgroundRepeat: "repeat-x",
            }}
          />

          {/* 二维码区 · 删 boxSizing·让 Canvas 200x200 有完整渲染空间 */}
          <View style={{ padding: "20px 0 18px", textAlign: "center" }}>
            <View
              className="mx-auto"
              style={{
                background: "#FBF7F1",
                border: "1px solid #DCC9B6",
                borderRadius: "12px",
                padding: "16px",
                width: "232px",
                height: "232px",
                visibility: isUsable ? "visible" : "hidden",
                position: isUsable ? "relative" : "absolute",
              }}
            >
              <Canvas type="2d" id="coupon-qr-canvas" style={{ width: "200px", height: "200px" }} />
            </View>
            {isUsable && (
              <Text className="mt-3 block" style={{ fontSize: "11px", color: "#864D39" }}>
                请向前台出示
              </Text>
            )}
            {!isUsable && (
              <View
                className="mx-auto flex-center"
                style={{
                  width: "200px",
                  height: "60px",
                  border: "1px solid #DCC9B6",
                  borderRadius: "12px",
                }}
              >
                <Text style={{ fontFamily: "var(--kd-font-display)", fontSize: "16px", color: "#937761", letterSpacing: "0.18em" }}>
                  {coupon.status === "used" ? "已 核 销" : "已 过 期"}
                </Text>
              </View>
            )}
          </View>

          {/* 券号尾 */}
          <View
            style={{
              background: "#F5EDE3",
              padding: "10px 14px",
              fontSize: "11px",
              color: "#864D39",
              fontFamily: "monospace",
              letterSpacing: "0.12em",
              textAlign: "center",
            }}
          >
            NO.
            {" "}
            {coupon.couponNo}
          </View>
        </View>

        {/* 使用须知 */}
        <View className="mt-5 px-1">
          <Text style={{ fontSize: "10px", letterSpacing: "0.24em", color: "#864D39", fontWeight: 500 }}>
            U  S  A  G  E
          </Text>
          <Text className="mt-2 block" style={{ fontSize: "11px", color: "#5E3425", lineHeight: "1.85" }}>
            · 仅限本人使用 · 不可转赠他人
            {"\n"}
            · 到店时向前台出示二维码 · 由咨询师扫码核销
            {"\n"}
            · 一次核销 · 不可重复使用
            {"\n"}
            · 过期作废 · 请在有效期内使用
            {"\n"}
            · 如有疑问 · 请致电门店 0516-83900001
          </Text>
        </View>
      </View>
    </PageWrapper>
  );
}
