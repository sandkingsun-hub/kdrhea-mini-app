import type { CharityCard, CharityStats } from "~/lib/charityCloud";
// KDRHEA · 公益认领卡 · 卡片墙
// 设计来源: open-design board.jsx · CharityCardWall
// 1 主推（FEATURED） + 3 缩略杂志 layout · 不用刻意 translateY 错位
import { Text, View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { useState } from "react";
import PageWrapper from "~/components/PageWrapper";
import { charityCloud } from "~/lib/charityCloud";

// 局部色阶 token（与 open-design warm-editorial 一致 · KDRHEA 棕色补充层）
const C = {
  l2: "#C07860",
  l3: "#D89078",
  l4: "#F0C0A8",
  accent: "#A84830",
};

const FALLBACK_STATS: CharityStats = {
  totalClaims: 0,
  totalDonatedFen: 0,
  configCharityRatio: "1:1",
};

function colorFor(i: number) {
  const pool = [C.l2, "var(--kd-brown-600)", C.l4, C.l3];
  return pool[i % pool.length];
}
function dotFor(i: number) {
  const pool = [C.l3, C.l2, C.l2, C.l2];
  return pool[i % pool.length];
}

export default function CharityHome() {
  const [stats, setStats] = useState<CharityStats>(FALLBACK_STATS);
  const [cards, setCards] = useState<CharityCard[]>([]);

  const load = async () => {
    try {
      const [s, l] = await Promise.all([charityCloud.getStats(), charityCloud.listCards()]);
      if (s) {
        setStats(s);
      }
      if (l) {
        setCards(l.items);
      }
    } catch (e) {
      console.warn("[charity-home] load failed", e);
    }
  };

  useLoad((opts: any) => {
    // 处理分享入口的 inviter 关联:
    //   - 小程序码扫码进入: opts.scene = "c=<shortCode>"
    //   - 链接卡分享进入:   opts.ref = "<shortCode>"
    let inviterShortCode: string | null = null;
    if (opts?.scene) {
      try {
        const scene = decodeURIComponent(opts.scene);
        const m = scene.match(/c=([A-Z0-9]+)/);
        if (m) {
          inviterShortCode = m[1];
        }
      } catch {}
    }
    if (!inviterShortCode && opts?.ref && typeof opts.ref === "string") {
      inviterShortCode = opts.ref;
    }
    if (inviterShortCode) {
      void (async () => {
        try {
          // @ts-expect-error wx 由微信运行时注入
          if (typeof wx === "undefined" || !wx.cloud) {
            return;
          }
          // @ts-expect-error wx.cloud.callFunction 由微信运行时注入·TS 不识别
          await wx.cloud.callFunction({ name: "claimInviter", data: { shortCode: inviterShortCode } });
        } catch {}
      })();
    }
    void load();
  });
  useDidShow(() => {
    void load();
  });

  const featured = cards.find(c => c.featured) || cards[0];
  const others = cards.filter(c => c._id !== featured?._id);

  const goDetail = (cardId: string) => {
    Taro.navigateTo({ url: `/pages/charity-detail/index?id=${cardId}` });
  };

  return (
    <PageWrapper navTitle="公益认领" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
      <View className="min-h-screen bg-kd-paper pb-32">
        {/* eyebrow + 大标题 */}
        <View className="px-6 pb-4 pt-6">
          <Text
            className="block"
            style={{
              fontSize: "11px",
              letterSpacing: "0.34em",
              textTransform: "uppercase",
              color: C.accent,
              fontWeight: 600,
              marginBottom: "16px",
            }}
          >
            KINDNESS
          </Text>
          <Text
            className="kd-hero block"
            style={{
              fontSize: "32px",
              lineHeight: 1.14,
              fontWeight: 500,
              color: "var(--kd-brown-900)",
            }}
          >
            以积分 · 认领
            {"\n"}
            一份
            <Text style={{ fontStyle: "italic", color: "var(--kd-brown-700)" }}>温柔</Text>
          </Text>
        </View>

        {/* stats 上下细线 */}
        <View
          className="mx-6"
          style={{
            display: "flex",
            borderTop: "1px solid var(--kd-hairline)",
            borderBottom: "1px solid var(--kd-hairline)",
            padding: "12px 0",
          }}
        >
          <View style={{ flex: "0.7" }}>
            <Text className="block" style={{ fontSize: "10px", letterSpacing: "0.18em", color: "var(--kd-brown-600)", textTransform: "uppercase", marginBottom: "4px" }}>
              配捐比
            </Text>
            <Text className="block" style={{ fontFamily: "var(--kd-font-display)", fontSize: "15px", fontWeight: 500, color: "var(--kd-brown-900)" }}>
              {stats.configCharityRatio.replace(":", " : ")}
            </Text>
          </View>
          <View style={{ flex: "1.2" }}>
            <Text className="block" style={{ fontSize: "10px", letterSpacing: "0.18em", color: "var(--kd-brown-600)", textTransform: "uppercase", marginBottom: "4px" }}>
              已经汇聚
            </Text>
            <Text className="block" style={{ fontFamily: "var(--kd-font-display)", fontSize: "15px", fontWeight: 500, color: "var(--kd-brown-900)" }}>
              ¥
              {(stats.totalDonatedFen / 100).toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={{ flex: "0.9" }}>
            <Text className="block" style={{ fontSize: "10px", letterSpacing: "0.18em", color: "var(--kd-brown-600)", textTransform: "uppercase", marginBottom: "4px" }}>
              已被认领
            </Text>
            <Text className="block" style={{ fontFamily: "var(--kd-font-display)", fontSize: "15px", fontWeight: 500, color: "var(--kd-brown-900)" }}>
              {stats.totalClaims.toLocaleString("zh-CN")}
            </Text>
          </View>
        </View>

        {/* 主推大卡 */}
        {featured && (
          <View
            className="mx-6 mt-5"
            style={{
              background: "var(--white)",
              borderRadius: "20px",
              border: "1px solid rgba(61,36,24,0.06)",
              padding: "16px",
              display: "flex",
              gap: "16px",
              alignItems: "center",
              boxShadow: "0 2px 14px rgba(61,36,24,0.04)",
            }}
            onClick={() => goDetail(featured._id)}
          >
            <View
              style={{
                width: "100px",
                height: "100px",
                borderRadius: "50%",
                background: colorFor(0),
                flexShrink: 0,
                position: "relative",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  top: "-4px",
                  right: "-4px",
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background: dotFor(0),
                  border: "3px solid var(--white)",
                }}
              />
            </View>
            <View style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3px" }}>
              <Text
                className="block"
                style={{
                  fontSize: "9px",
                  color: C.accent,
                  letterSpacing: "0.32em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                TODAY · 等你回应
              </Text>
              <Text
                className="block"
                style={{
                  fontFamily: "var(--kd-font-display)",
                  fontSize: "22px",
                  fontWeight: 500,
                  color: "var(--kd-brown-900)",
                  letterSpacing: "-0.01em",
                }}
              >
                {featured.name}
              </Text>
              <Text
                className="block"
                style={{
                  fontSize: "11px",
                  color: "var(--kd-brown-600)",
                  letterSpacing: "0.04em",
                }}
              >
                {featured.tagline}
              </Text>
              <Text
                className="block"
                style={{
                  fontFamily: "var(--kd-font-display)",
                  fontStyle: "italic",
                  fontSize: "11px",
                  color: "var(--kd-brown-700)",
                  opacity: 0.85,
                  lineHeight: 1.55,
                  marginTop: "4px",
                }}
              >
                {featured.story_preview}
              </Text>
              <View style={{
                alignSelf: "flex-start",
                marginTop: "6px",
                padding: "4px 11px",
                borderRadius: "999px",
                background: "var(--kd-paper)",
                border: "1px solid rgba(61,36,24,0.06)",
              }}
              >
                <Text style={{
                  fontFamily: "Menlo, monospace",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--kd-brown-900)",
                  letterSpacing: "0.04em",
                }}
                >
                  {featured.pointsPrice}
                  {" "}
                  分
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* 3 张缩略 */}
        {others.length > 0 && (
          <View className="mx-6 mt-3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
            {others.slice(0, 3).map((c, i) => (
              <View
                key={c._id}
                style={{
                  background: "var(--white)",
                  borderRadius: "16px",
                  border: "1px solid rgba(61,36,24,0.06)",
                  padding: "12px 6px 10px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "5px",
                }}
                onClick={() => goDetail(c._id)}
              >
                <View style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: colorFor(i + 1),
                  position: "relative",
                }}
                >
                  <View style={{
                    position: "absolute",
                    top: "-2px",
                    right: "-2px",
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    background: dotFor(i + 1),
                    border: "2px solid var(--white)",
                  }}
                  />
                </View>
                <Text
                  className="block"
                  style={{
                    fontFamily: "var(--kd-font-display)",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "var(--kd-brown-900)",
                    letterSpacing: "-0.01em",
                    marginTop: "2px",
                  }}
                >
                  {c.name}
                </Text>
                <Text
                  className="block"
                  style={{
                    fontSize: "9px",
                    color: "var(--kd-brown-600)",
                    letterSpacing: "0.04em",
                    textAlign: "center",
                    lineHeight: 1.3,
                  }}
                >
                  {c.tagline}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* 看更多 (占位 · M2 阶段 4 张全部 visible · 后期>4 张才有真"更多") */}
        {cards.length > 4 && (
          <View className="mt-4" style={{ textAlign: "center" }}>
            <Text style={{ fontSize: "11px", color: "var(--kd-brown-600)", letterSpacing: "0.1em" }}>
              其他还在等的小生命 →
            </Text>
          </View>
        )}
      </View>
    </PageWrapper>
  );
}
