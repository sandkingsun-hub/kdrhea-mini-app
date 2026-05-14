import type { CharityCard } from "~/lib/charityCloud";
// KDRHEA · 公益认领卡 · 详情页
// 设计来源: open-design board.jsx · CharityCardDetail
// 大头图 + 故事 + 「你的心意」cell + italic hint + 立即认领 CTA
import { Button, Text, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useState } from "react";
import PageWrapper from "~/components/PageWrapper";
import { charityCloud } from "~/lib/charityCloud";

const C = {
  l2: "#C07860",
  l3: "#D89078",
  l4: "#F0C0A8",
  accent: "#A84830",
};

export default function CharityDetail() {
  const [card, setCard] = useState<CharityCard | null>(null);
  const [claiming, setClaiming] = useState(false);

  const loadById = async (id: string) => {
    try {
      const list = await charityCloud.listCards();
      if (!list) {
        return;
      }
      const target = list.items.find(c => c._id === id);
      if (target) {
        setCard(target);
      } else {
        Taro.showToast({ title: "卡片不存在", icon: "none" });
      }
    } catch (e) {
      console.warn("[charity-detail] load failed", e);
    }
  };

  useLoad((opts: any) => {
    const id = opts?.id;
    if (id && typeof id === "string") {
      void loadById(id);
    }
  });

  const handleClaim = async () => {
    if (!card || claiming) {
      return;
    }
    setClaiming(true);
    try {
      const r = await charityCloud.claimCard(card._id);
      if (!r || !r.ok) {
        const msg = r?.code === "INSUFFICIENT" ? "积分不足" : "认领失败 · 稍后再试";
        Taro.showToast({ title: msg, icon: "none" });
        setClaiming(false);
        return;
      }
      // 成功 · 跳凭证页
      Taro.redirectTo({ url: `/pages/charity-cert/index?claimId=${r.claimId}` });
    } catch (e) {
      console.warn("[charity-detail] claim failed", e);
      Taro.showToast({ title: "认领失败 · 稍后再试", icon: "none" });
      setClaiming(false);
    }
  };

  if (!card) {
    return (
      <PageWrapper navTitle="认领详情" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
        <View className="min-h-screen bg-kd-paper" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "var(--kd-brown-600)", fontSize: "13px" }}>加载中…</Text>
        </View>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper navTitle="认领详情" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
      <View className="min-h-screen bg-kd-paper pb-32" style={{ display: "flex", flexDirection: "column" }}>
        {/* hero · 横向头图（aspect 1.35:1 解决拥挤） */}
        <View className="px-6 pt-4">
          <View
            style={{
              width: "100%",
              aspectRatio: "1.35 / 1",
              borderRadius: "20px",
              background: C.l4,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* concentric circles 占位 · Midjourney 出图后换 imageUrl */}
            <View style={{
              position: "absolute",
              top: "54%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "64%",
              height: "64%",
              borderRadius: "50%",
              background: C.l2,
            }}
            />
            <View style={{
              position: "absolute",
              top: "46%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "40%",
              height: "40%",
              borderRadius: "50%",
              background: C.l3,
            }}
            />
            {/* 等你回应 chip */}
            <View style={{
              position: "absolute",
              top: "14px",
              left: "14px",
              padding: "5px 10px 5px 9px",
              background: "var(--white)",
              borderRadius: "999px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 2px 12px rgba(61,36,24,0.06)",
            }}
            >
              <Text style={{ fontSize: "10px", color: C.accent }}>♥</Text>
              <Text style={{ fontSize: "11px", color: C.accent, fontWeight: 600, letterSpacing: "0.08em" }}>
                等你回应
              </Text>
            </View>
          </View>
        </View>

        {/* name + tagline */}
        <View className="px-6 pt-5">
          <View style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "10px" }}>
            <Text
              className="kd-display"
              style={{
                fontSize: "28px",
                fontWeight: 500,
                color: "var(--kd-brown-900)",
              }}
            >
              {card.name}
            </Text>
            <Text style={{
              fontSize: "11px",
              color: "var(--kd-brown-600)",
              letterSpacing: "0.08em",
            }}
            >
              {card.tagline}
            </Text>
          </View>
          <Text
            className="kd-body block"
            style={{
              fontSize: "14px",
              lineHeight: 1.72,
              color: "var(--kd-brown-900)",
              opacity: 0.78,
            }}
          >
            {card.story}
          </Text>
        </View>

        {/* 主 cell · 你的心意 + 配捐 chip */}
        <View
          className="mx-6 mt-5"
          style={{
            background: "var(--white)",
            borderRadius: "20px",
            border: "1px solid rgba(61,36,24,0.06)",
            padding: "18px 20px 16px",
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Text
              className="block"
              style={{
                fontSize: "10px",
                letterSpacing: "0.18em",
                color: "var(--kd-brown-600)",
                textTransform: "uppercase",
                marginBottom: "8px",
                fontWeight: 500,
              }}
            >
              你的心意
            </Text>
            <View style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <Text style={{
                fontFamily: "var(--kd-font-display)",
                fontSize: "32px",
                fontWeight: 500,
                color: "var(--kd-brown-900)",
                letterSpacing: "-0.02em",
              }}
              >
                {card.pointsPrice}
              </Text>
              <Text style={{
                fontSize: "11px",
                color: "var(--kd-brown-600)",
                letterSpacing: "0.06em",
              }}
              >
                积分
              </Text>
            </View>
          </View>
          <View style={{ textAlign: "right" }}>
            <Text
              className="block"
              style={{
                fontSize: "10px",
                color: "var(--kd-brown-600)",
                letterSpacing: "0.06em",
                marginBottom: "4px",
              }}
            >
              我们 · 同步
            </Text>
            <Text style={{
              fontFamily: "var(--kd-font-display)",
              fontSize: "16px",
              color: C.accent,
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
            >
              ¥
              {(card.donatedFen / 100).toFixed(0)}
            </Text>
          </View>
        </View>

        {/* italic hint */}
        <View className="mx-6 mt-3" style={{ textAlign: "center" }}>
          <Text style={{
            fontStyle: "italic",
            fontFamily: "var(--kd-font-display)",
            fontSize: "12px",
            color: "var(--kd-brown-600)",
            letterSpacing: "0.04em",
            lineHeight: 1.6,
          }}
          >
            1 比 1 同等的善意 · 与你一同送达
          </Text>
        </View>

        {/* CTA · marginTop auto 自然推到底 */}
        <View style={{ marginTop: "auto", padding: "22px 24px 36px" }}>
          <Button
            onClick={handleClaim}
            disabled={claiming}
            style={{
              width: "100%",
              height: "52px",
              borderRadius: "999px",
              background: "var(--kd-brown-900)",
              color: "var(--kd-paper)",
              fontFamily: "var(--kd-font-sans)",
              fontSize: "15px",
              fontWeight: 600,
              letterSpacing: "0.04em",
              border: "none",
              lineHeight: "52px",
              padding: 0,
              boxShadow: "0 6px 20px rgba(61,36,24,0.16)",
              opacity: claiming ? 0.6 : 1,
            }}
          >
            {claiming ? "认领中…" : `立即认领 · ${card.pointsPrice} 积分`}
          </Button>
        </View>
      </View>
    </PageWrapper>
  );
}
