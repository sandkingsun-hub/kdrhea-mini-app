import type { CharityClaim } from "~/lib/charityCloud";
// KDRHEA · 公益认领卡 · 凭证页（朋友圈分享素材）
// 设计来源: open-design board.jsx · CharityCertificate
// 博物馆藏品卡风 · K logo 角戳 + NO·0001 + 双 stat + italic serif 引言 + 虚线撕边 SN
import { Button, Image, Text, View } from "@tarojs/components";
import Taro, {
  useLoad,
  useShareAppMessage,
  useShareTimeline,
} from "@tarojs/taro";
import { useState } from "react";
import PageWrapper from "~/components/PageWrapper";
import { charityCloud } from "~/lib/charityCloud";

// 小程序绝对路径 · / 开头 · 与 share-cover 现有模式一致
const LOGO_KDRHEA = "/assets/charity/logo-kdrhea.png";
// 公益认领专属分享卡缩略图 (750x750 · KDRHEA 棕色系)
const CHARITY_SHARE_COVER = "/assets/charity/charity-share-cover.jpg";

const C = {
  l2: "#C07860",
  l3: "#D89078",
  l4: "#F0C0A8",
  accent: "#A84830",
};

export default function CharityCert() {
  const [claim, setClaim] = useState<CharityClaim | null>(null);
  const [shortCode, setShortCode] = useState<string | null>(null);

  const loadById = async (claimId: string) => {
    try {
      const r = await charityCloud.getClaimDetail(claimId);
      if (r) {
        setClaim(r.claim);
      }
    } catch (e) {
      console.warn("[charity-cert] load failed", e);
    }
  };

  useLoad((opts: any) => {
    const id = opts?.claimId;
    if (id && typeof id === "string") {
      void loadById(id);
      void (async () => {
        const r = await charityCloud.genShareLink(id);
        if (r) {
          setShortCode(r.shortCode);
        }
      })();
    }
  });

  // share path 带 ref + claim · 朋友点开自动绑老带新 + 看同张凭证
  const sharePath = claim
    ? `/pages/charity-cert/index?claimId=${claim._id}${shortCode ? `&ref=${shortCode}` : ""}`
    : "/pages/index/index";

  useShareAppMessage(() => ({
    title: claim
      ? `我刚认领了 ${claim.cardSnapshot.name} · 一份温柔已送达`
      : "KDRHEA · 认领一份温柔",
    path: sharePath,
    imageUrl: CHARITY_SHARE_COVER,
  }));

  useShareTimeline(() => ({
    title: claim
      ? "认领一份温柔 · 让世界多一份善意"
      : "KDRHEA · 认领一份温柔",
    query: shortCode ? `ref=${shortCode}` : "",
    imageUrl: CHARITY_SHARE_COVER,
  }));

  const handleShareTimelineTip = () => {
    Taro.showModal({
      title: "分享至朋友圈",
      content: "点右上角「···」→ 选「分享到朋友圈」",
      showCancel: false,
      confirmText: "知道了",
    });
  };

  if (!claim) {
    return (
      <PageWrapper navTitle="我的凭证" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
        <View className="min-h-screen bg-kd-paper" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "var(--kd-brown-600)", fontSize: "13px" }}>加载凭证…</Text>
        </View>
      </PageWrapper>
    );
  }

  const dateStr = (() => {
    const d = new Date(claim.claimedAt);
    return `${d.getFullYear()} · ${String(d.getMonth() + 1).padStart(2, "0")} · ${String(d.getDate()).padStart(2, "0")}`;
  })();

  const nickname = claim.claimerNickname || "TA";

  return (
    <PageWrapper navTitle="我的凭证" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
      <View className="min-h-screen bg-kd-paper pb-32" style={{ display: "flex", flexDirection: "column" }}>
        {/* eyebrow */}
        <View className="px-6 pt-4" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{
            fontSize: "11px",
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: C.accent,
            fontWeight: 600,
          }}
          >
            RECEIPT · 凭证
          </Text>
        </View>

        {/* museum-collection cert card */}
        <View
          className="mx-5 mt-5"
          style={{
            background: "var(--white)",
            borderRadius: "20px",
            border: "1px solid rgba(61,36,24,0.10)",
            padding: "22px 22px 20px",
            position: "relative",
            boxShadow: "0 2px 28px rgba(61,36,24,0.07)",
          }}
        >
          {/* K logo · 真 KDRHEA logo · 横向 */}
          <Image
            src={LOGO_KDRHEA}
            mode="aspectFit"
            style={{
              position: "absolute",
              top: "18px",
              left: "18px",
              width: "60px",
              height: "22px",
            }}
          />

          {/* NO 序号（用 SN 后 4 位） */}
          <Text style={{
            position: "absolute",
            top: "24px",
            right: "22px",
            fontFamily: "Menlo, monospace",
            fontSize: "9.5px",
            color: "rgba(61,36,24,0.32)",
            letterSpacing: "0.2em",
          }}
          >
            NO ·
            {" "}
            {claim.sn.split("-").pop()}
          </Text>

          {/* circular avatar frame */}
          <View style={{ marginTop: "34px", marginBottom: "14px", display: "flex", justifyContent: "center" }}>
            <View style={{
              width: "100px",
              height: "100px",
              borderRadius: "50%",
              background: "var(--kd-paper)",
              border: "1px solid rgba(61,36,24,0.10)",
              padding: "5px",
              position: "relative",
            }}
            >
              <View style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                background: C.l2,
                position: "relative",
                overflow: "hidden",
              }}
              >
                <View style={{
                  position: "absolute",
                  top: "46%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "50px",
                  height: "50px",
                  borderRadius: "50%",
                  background: C.l3,
                }}
                />
              </View>
            </View>
          </View>

          {/* eyebrow tag */}
          <Text
            className="block"
            style={{
              textAlign: "center",
              fontSize: "10px",
              letterSpacing: "0.36em",
              textTransform: "uppercase",
              color: "var(--kd-brown-600)",
              fontWeight: 600,
              marginBottom: "8px",
            }}
          >
            公益认领凭证
          </Text>

          {/* title */}
          <Text
            className="block"
            style={{
              textAlign: "center",
              fontFamily: "var(--kd-font-display)",
              fontSize: "27px",
              lineHeight: 1.1,
              fontWeight: 500,
              color: "var(--kd-brown-900)",
              letterSpacing: "-0.02em",
              marginBottom: "4px",
            }}
          >
            认领 ·
            {" "}
            <Text style={{ fontStyle: "italic" }}>{claim.cardSnapshot.name}</Text>
          </Text>

          <Text
            className="block"
            style={{
              textAlign: "center",
              fontSize: "12px",
              color: "var(--kd-brown-600)",
              marginBottom: "18px",
              letterSpacing: "0.06em",
            }}
          >
            By
            {" "}
            {nickname}
            {" "}
            ·
            {" "}
            {dateStr}
          </Text>

          {/* divider · 全宽 */}
          <View style={{
            height: "1px",
            background: "var(--kd-hairline)",
            margin: "0 -22px 16px",
          }}
          />

          {/* twin stats with 中竖线 */}
          <View style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "18px",
          }}
          >
            <View style={{ flex: 1, textAlign: "center" }}>
              <Text
                className="block"
                style={{
                  fontFamily: "var(--kd-font-display)",
                  fontSize: "22px",
                  fontWeight: 500,
                  color: "var(--kd-brown-900)",
                  letterSpacing: "-0.015em",
                }}
              >
                {claim.pointsSpent}
              </Text>
              <Text
                className="block"
                style={{
                  fontSize: "9.5px",
                  color: "var(--kd-brown-600)",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  marginTop: "4px",
                  fontWeight: 500,
                }}
              >
                积分
              </Text>
            </View>
            <View style={{ width: "1px", height: "26px", background: "var(--kd-hairline)" }} />
            <View style={{ flex: 1, textAlign: "center" }}>
              <Text
                className="block"
                style={{
                  fontFamily: "var(--kd-font-display)",
                  fontSize: "22px",
                  fontWeight: 500,
                  color: C.accent,
                  letterSpacing: "-0.015em",
                }}
              >
                ¥
                {(claim.donatedFen / 100).toFixed(0)}
              </Text>
              <Text
                className="block"
                style={{
                  fontSize: "9.5px",
                  color: "var(--kd-brown-600)",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  marginTop: "4px",
                  fontWeight: 500,
                }}
              >
                已捐
              </Text>
            </View>
          </View>

          {/* italic quote */}
          <Text
            className="block"
            style={{
              fontFamily: "var(--kd-font-display)",
              fontStyle: "italic",
              fontSize: "13px",
              lineHeight: 1.62,
              color: "var(--kd-brown-700)",
              textAlign: "center",
              padding: "0 4px 14px",
            }}
          >
            "每一份温柔，都是世界变好的小小回响。"
          </Text>

          {/* perforated SN bottom */}
          <View style={{
            borderTop: "1px dashed var(--kd-hairline)",
            paddingTop: "10px",
            textAlign: "center",
          }}
          >
            <Text style={{
              fontFamily: "Menlo, monospace",
              fontSize: "10px",
              letterSpacing: "0.24em",
              color: "rgba(61,36,24,0.32)",
            }}
            >
              SN ·
              {" "}
              {claim.sn}
            </Text>
          </View>
        </View>

        {/* 分享 CTA · 双按钮 */}
        <View style={{ marginTop: "auto", padding: "20px 24px 36px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <Button
            openType="share"
            style={{
              width: "100%",
              height: "52px",
              borderRadius: "999px",
              background: C.accent,
              color: "#FFFFFF",
              fontFamily: "var(--kd-font-sans)",
              fontSize: "15px",
              fontWeight: 600,
              letterSpacing: "0.04em",
              border: "none",
              lineHeight: "52px",
              padding: 0,
              boxShadow: "0 6px 20px rgba(168,72,48,0.28)",
            }}
          >
            分享给朋友
          </Button>
          <Button
            onClick={handleShareTimelineTip}
            style={{
              width: "100%",
              height: "48px",
              borderRadius: "999px",
              background: "var(--white)",
              color: "var(--kd-brown-900)",
              fontFamily: "var(--kd-font-sans)",
              fontSize: "14px",
              fontWeight: 600,
              letterSpacing: "0.04em",
              lineHeight: "46px",
              padding: 0,
              border: "1px solid var(--kd-brown-900)",
            }}
          >
            分享到朋友圈
          </Button>
        </View>
      </View>
    </PageWrapper>
  );
}
