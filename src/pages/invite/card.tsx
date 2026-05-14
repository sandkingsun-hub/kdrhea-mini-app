// KDRHEA · 邀请软广 · 个人会员名片
// 顾客看到的是自己的专属名片（名字 + 加入天数 + 金句）· 朋友收到时是「她的 KDRHEA」不是广告
import { Button, Text, View } from "@tarojs/components";
import { useLoad, useShareAppMessage, useShareTimeline } from "@tarojs/taro";
import { useMemo, useState } from "react";
import PageWrapper from "~/components/PageWrapper";

// KDRHEA 调性金句库 · 高级 + 不肉麻 · 进入页面随机一句
const QUOTES = [
  "美是细节里的坚持",
  "修护是一种节制",
  "时间值得被温柔对待",
  "让光照进来 · 而非补上去",
  "一日一日 · 自己的样子",
  "皮肤的耐心是镜子里的安宁",
  "美是与时间和解的方式",
  "不与年龄对抗 · 与自己对话",
  "最好的护肤不是堆叠 · 是减法",
  "让生活继续 · 美自会发生",
  "对自己温柔的人 · 终被时光善待",
  "节制是一种风度",
];

function dayDiff(iso: string | null): number {
  if (!iso) {
    return 1;
  }
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}

interface User {
  _openid: string;
  nickname: string | null;
  registeredAt: string | null;
}

export default function InviteCard() {
  const [user, setUser] = useState<User | null>(null);
  const quote = useMemo(() => QUOTES[Math.floor(Math.random() * QUOTES.length)], []);

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

  useLoad(async () => {
    const lg = await callCloud("login");
    if (lg?.ok && lg.user) {
      setUser({
        _openid: lg.user._openid,
        nickname: lg.user.nickname || null,
        registeredAt: lg.user.registeredAt || null,
      });
    }
  });

  // 分享给好友 · 朋友看到是「她」的卡片 · 不是广告
  useShareAppMessage(() => ({
    title: `${user?.nickname || "她"} · 与 KDRHEA 同行`,
    path: `/pages/index/index?inviter=${user?._openid || ""}`,
    imageUrl: "/assets/charity/charity-share-cover.jpg",
  }));

  useShareTimeline(() => ({
    title: `${user?.nickname || "她"} · 与 KDRHEA 同行`,
    query: `inviter=${user?._openid || ""}`,
    imageUrl: "/assets/charity/charity-share-cover.jpg",
  }));

  const daysJoined = user ? dayDiff(user.registeredAt) : 0;
  const displayName = user?.nickname || "—";

  return (
    <PageWrapper navTitle="邀请好友" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
      <View className="min-h-screen bg-kd-paper px-6 pb-32 pt-6">
        {/* eyebrow */}
        <Text
          className="block"
          style={{
            fontSize: "10px",
            letterSpacing: "0.34em",
            color: "#864D39",
            fontWeight: 600,
            textTransform: "uppercase",
            marginBottom: "8px",
          }}
        >
          INVITATION · 邀请
        </Text>

        {/* 大标题 */}
        <Text
          className="kd-display block"
          style={{
            fontSize: "24px",
            color: "var(--kd-brown-900)",
            fontWeight: 500,
            lineHeight: 1.3,
          }}
        >
          分享你的 KDRHEA
        </Text>
        <Text
          className="mt-2 block"
          style={{
            fontSize: "12px",
            color: "#864D39",
            letterSpacing: "0.04em",
          }}
        >
          让在意的人 · 也看见好的护肤的样子
        </Text>

        {/* 名片预览 */}
        <View
          className="mt-8"
          style={{
            background: "#FFFFFF",
            border: "1px solid #E8DFD4",
            borderRadius: "16px",
            padding: "36px 24px 32px",
            boxShadow: "0 8px 24px rgba(61,36,24,0.06)",
          }}
        >
          {/* logo eyebrow */}
          <Text
            className="block text-center"
            style={{
              fontSize: "11px",
              letterSpacing: "0.36em",
              color: "#864D39",
              fontWeight: 500,
              marginBottom: "36px",
            }}
          >
            K D R H E A
          </Text>

          {/* 顾客名 · 大字 */}
          <Text
            className="kd-display block text-center"
            style={{
              fontSize: "28px",
              color: "var(--kd-brown-900)",
              fontWeight: 500,
              letterSpacing: "0.04em",
              lineHeight: 1.2,
            }}
          >
            {displayName}
          </Text>

          {/* 装饰线 */}
          <View
            className="mx-auto my-6"
            style={{
              width: "32px",
              height: "1px",
              background: "#864D39",
            }}
          />

          {/* 金句 · 斜体 */}
          <Text
            className="kd-display block text-center"
            style={{
              fontSize: "16px",
              color: "#3C2218",
              fontWeight: 400,
              lineHeight: 1.6,
              fontStyle: "italic",
              padding: "0 16px",
            }}
          >
            「
            {quote}
            」
          </Text>

          {/* 加入天数 */}
          <Text
            className="block text-center"
            style={{
              fontSize: "11px",
              letterSpacing: "0.16em",
              color: "#937761",
              marginTop: "32px",
            }}
          >
            加入 KDRHEA 第
            {" "}
            {daysJoined}
            {" "}
            天
          </Text>
        </View>

        {/* 操作说明 */}
        <Text
          className="mt-6 block px-2"
          style={{
            fontSize: "11px",
            color: "var(--kd-brown-600)",
            lineHeight: 1.7,
            letterSpacing: "0.04em",
            textAlign: "center",
          }}
        >
          朋友收到的是「你的卡片」· 不是广告
        </Text>

        {/* 直接分享按钮 */}
        <Button
          openType="share"
          style={{
            width: "100%",
            height: "52px",
            borderRadius: "999px",
            background: "var(--kd-brown-900)",
            color: "var(--kd-paper)",
            fontSize: "14px",
            fontWeight: 600,
            letterSpacing: "0.06em",
            border: "none",
            padding: 0,
            lineHeight: "52px",
            marginTop: "24px",
          }}
        >
          分享给朋友
        </Button>

        {/* 朋友圈提示 */}
        <Text
          className="mt-4 block"
          style={{
            fontSize: "10.5px",
            color: "#937761",
            letterSpacing: "0.04em",
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          分享到朋友圈 · 点击右上角「···」→「分享到朋友圈」
        </Text>
      </View>
    </PageWrapper>
  );
}
