import { Button, Text, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useMemo, useState } from "react";
import PageWrapper from "~/components/PageWrapper";

type InviteChannel = "direct_share" | "wechat_group" | "wechat_moments";
type PageMode = "ready" | "no_inviter" | "self_invite" | "already_member";

interface WelcomeGiftConfig {
  enabled: boolean;
  couponName: string;
  couponType: string;
  valueFen: number;
  value: string;
  description: string;
  validDays: number;
}

const DEFAULT_WELCOME_GIFT: WelcomeGiftConfig = {
  enabled: true,
  couponName: "新人首礼 · 100 元体验券",
  couponType: "experience",
  valueFen: 10000,
  value: "门店任意体验项目抵 100 元",
  description: "新会员注册首次专享·到店核销",
  validDays: 90,
};

const CHANNEL_LABEL: Record<InviteChannel, string> = {
  direct_share: "好友分享",
  wechat_group: "微信群",
  wechat_moments: "朋友圈",
};

export default function InviteWelcome() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bindingPhone, setBindingPhone] = useState(false);

  const [inviter, setInviter] = useState("");
  const [channel, setChannel] = useState<InviteChannel>("direct_share");
  const [showInviter, setShowInviter] = useState(false);

  const [mode, setMode] = useState<PageMode>("no_inviter");
  const [phoneBound, setPhoneBound] = useState(false);
  const [gift, setGift] = useState<WelcomeGiftConfig>(DEFAULT_WELCOME_GIFT);

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

  const goCoupons = () => Taro.navigateTo({ url: "/pages/coupons/index" });
  const goHome = () => Taro.reLaunch({ url: "/pages/index/index" });

  useLoad(async (options) => {
    const inviterFromQuery = typeof options?.inviter === "string" ? options.inviter : "";
    const channelFromQuery = options?.channel;
    const showInviterFromQuery = options?.showInviter === "1";
    const safeChannel: InviteChannel = channelFromQuery === "wechat_group" || channelFromQuery === "wechat_moments"
      ? channelFromQuery
      : "direct_share";

    setInviter(inviterFromQuery);
    setChannel(safeChannel);
    setShowInviter(showInviterFromQuery);

    const [lg, cfg] = await Promise.all([
      callCloud("login"),
      callCloud("getSystemConfig"),
    ]);

    const currentOpenid = lg?.openid || lg?.user?._openid || "";
    const hasFirstPaid = !!lg?.user?.firstPaidAt;
    setPhoneBound(!!lg?.user?.phone);

    if (cfg?.ok && cfg?.welcomeGift) {
      setGift({ ...DEFAULT_WELCOME_GIFT, ...cfg.welcomeGift });
    }

    if (!inviterFromQuery) {
      setMode("no_inviter");
    } else if (inviterFromQuery === currentOpenid) {
      setMode("self_invite");
    } else if (hasFirstPaid) {
      setMode("already_member");
    } else {
      setMode("ready");
    }

    setLoading(false);
  });

  const claimWelcomeGiftFlow = async () => {
    if (submitting || bindingPhone) {
      return;
    }
    if (mode !== "ready" || !inviter) {
      return;
    }
    if (!phoneBound) {
      Taro.showToast({ title: "请先授权手机号", icon: "none" });
      return;
    }

    setSubmitting(true);

    const inviterResult = await callCloud("claimInviter", { inviter, channel });
    if (!(inviterResult?.ok || inviterResult?.code === "ALREADY_HAS_FIRST_TRANSACTION")) {
      setSubmitting(false);
      Taro.showToast({ title: inviterResult?.code || "绑定邀请关系失败", icon: "none" });
      return;
    }

    // TODO(R3): 这里先沿用 claimWelcomeGift 的 fallback 发券模式，后续再切 couponTemplateId 优先流程
    const giftResult = await callCloud("claimWelcomeGift");
    setSubmitting(false);

    if (giftResult?.ok) {
      Taro.showToast({ title: "领取成功", icon: "success" });
      setTimeout(goCoupons, 500);
      return;
    }
    if (giftResult?.code === "ALREADY_CLAIMED") {
      goCoupons();
      return;
    }
    if (giftResult?.code === "WELCOME_GIFT_DISABLED") {
      Taro.showToast({ title: "新人礼暂停·欢迎使用小程序", icon: "none" });
      return;
    }
    Taro.showToast({ title: giftResult?.code || "领取失败", icon: "none" });
  };

  const handleGetPhoneNumber = async (e: any) => {
    if (bindingPhone || submitting) {
      return;
    }
    const code = e?.detail?.code;
    if (!code) {
      Taro.showToast({ title: "需授权手机号后领取", icon: "none" });
      return;
    }

    setBindingPhone(true);
    const r = await callCloud("bindPhone", { phoneCode: code });
    setBindingPhone(false);

    if (r?.ok && r?.phone) {
      setPhoneBound(true);
      Taro.showToast({ title: "手机号已绑定", icon: "success" });
      await claimWelcomeGiftFlow();
      return;
    }
    Taro.showToast({ title: r?.code || "手机号绑定失败", icon: "none" });
  };

  const handlePrimaryClick = async () => {
    if (mode === "ready") {
      await claimWelcomeGiftFlow();
      return;
    }
    if (mode === "already_member") {
      goCoupons();
      return;
    }
    goHome();
  };

  const ctaText = useMemo(() => {
    if (mode === "ready") {
      return "同意协议 · 领取体验券";
    }
    if (mode === "already_member") {
      return "查看我的优惠";
    }
    if (mode === "self_invite") {
      return "返回首页";
    }
    return "进入小程序";
  }, [mode]);

  const headTitle = useMemo(() => {
    if (mode === "already_member") {
      return "您已是会员 · 欢迎回来";
    }
    if (mode === "self_invite") {
      return "不能邀请自己";
    }
    if (showInviter && inviter) {
      return "您的朋友邀请您";
    }
    return "欢迎来到 KDRHEA";
  }, [inviter, mode, showInviter]);

  const giftValueLabel = gift.value || `${Math.max(0, Math.floor(gift.valueFen / 100))} 元体验券`;

  return (
    <PageWrapper className="h-full bg-kd-paper" shouldShowBottomActions={false} shouldShowNavigation={false}>
      <View className="min-h-screen bg-kd-paper px-6 pb-12 pt-12">
        <View className="text-center">
          <Text style={{ fontSize: "12px", letterSpacing: "0.34em", color: "#3C2218", fontWeight: 500 }}>
            K  D  R  H  E  A
          </Text>
          <Text className="mt-2 block" style={{ fontSize: "11px", letterSpacing: "0.26em", color: "#864D39" }}>
            科  迪  芮  雅
          </Text>
        </View>

        <View
          className="mt-8"
          style={{
            background: "#FAF7F3",
            border: "1px solid #DCC9B6",
            borderRadius: "16px",
            padding: "22px 18px",
          }}
        >
          <Text className="block text-center" style={{ fontSize: "16px", color: "#3C2218", letterSpacing: "0.06em" }}>
            {headTitle}
          </Text>

          <Text className="mt-4 block text-center" style={{ fontSize: "11px", color: "#937761", letterSpacing: "0.14em" }}>
            注 册 即 得
          </Text>

          <View
            className="mt-3"
            style={{
              background: "#F5EDE3",
              border: "1px solid #DCC9B6",
              borderRadius: "12px",
              padding: "16px 14px",
              textAlign: "center",
            }}
          >
            <Text style={{ fontFamily: "var(--kd-font-display)", fontSize: "18px", color: "#3C2218", letterSpacing: "0.04em" }}>
              {gift.couponName}
            </Text>
            <Text className="mt-2 block" style={{ fontSize: "12px", color: "#864D39", lineHeight: "1.7" }}>
              {giftValueLabel}
            </Text>
            <Text className="mt-1 block" style={{ fontSize: "11px", color: "#937761" }}>
              有效期
              {" "}
              {gift.validDays}
              {" "}
              天
            </Text>
          </View>

          <Text className="mt-4 block text-center" style={{ fontSize: "11px", color: "#937761", lineHeight: "1.7" }}>
            {gift.description || "与肌肤相处，要慢一点，稳一点，久一点。"}
          </Text>

          <Text className="mt-2 block text-center" style={{ fontSize: "10px", color: "#A98D78" }}>
            当前来源：
            {CHANNEL_LABEL[channel]}
          </Text>

          {mode === "ready" && !phoneBound ? (
            <Button
              className="mt-6"
              openType="getPhoneNumber"
              onGetPhoneNumber={handleGetPhoneNumber}
              loading={bindingPhone || submitting}
              style={{
                height: "46px",
                lineHeight: "46px",
                background: "#3C2218",
                color: "#FBF7F1",
                borderRadius: "999px",
                fontSize: "13px",
                letterSpacing: "0.1em",
              }}
            >
              {ctaText}
            </Button>
          ) : (
            <Button
              className="mt-6"
              onClick={handlePrimaryClick}
              loading={submitting}
              style={{
                height: "46px",
                lineHeight: "46px",
                background: "#3C2218",
                color: "#FBF7F1",
                borderRadius: "999px",
                fontSize: "13px",
                letterSpacing: "0.1em",
              }}
            >
              {ctaText}
            </Button>
          )}

          <Text className="mt-3 block text-center" style={{ fontSize: "10px", color: "#A98D78" }}>
            点击按钮即表示同意《用户协议》《隐私政策》
          </Text>
        </View>

        {loading && (
          <View className="mt-6 text-center">
            <Text style={{ fontSize: "11px", color: "#937761" }}>载入中…</Text>
          </View>
        )}
      </View>
    </PageWrapper>
  );
}
