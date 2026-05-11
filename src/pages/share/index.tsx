import { Button, Image, Switch, Text, View } from "@tarojs/components";
import Taro, { useLoad, useShareAppMessage, useShareTimeline } from "@tarojs/taro";
import { useMemo, useState } from "react";
import PageWrapper from "~/components/PageWrapper";

type InviteChannel = "direct_share" | "wechat_group" | "wechat_moments";
type ShareSceneFilter = "all" | "general" | "anti_aging" | "repair";

interface UserSummary {
  openid: string;
  nickname: string | null;
  avatarUrl: string | null;
}

interface ShareCopyTemplate {
  id: string;
  scene: string;
  content: string;
}

const SCENE_FILTERS: { key: ShareSceneFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "general", label: "通用" },
  { key: "anti_aging", label: "抗衰" },
  { key: "repair", label: "修护" },
];

const FALLBACK_TEMPLATE: ShareCopyTemplate = {
  id: "fallback",
  scene: "general",
  content: "KDRHEA · 科迪芮雅",
};

const COVER_IMAGES = [
  "/assets/share-cover/01.jpg",
  "/assets/share-cover/02.jpg",
  "/assets/share-cover/03.jpg",
];

function normalizeScene(scene: string): ShareSceneFilter {
  const raw = String(scene || "").toLowerCase();
  if (raw.includes("anti") || raw.includes("age") || raw.includes("抗衰")) {
    return "anti_aging";
  }
  if (raw.includes("repair") || raw.includes("修护")) {
    return "repair";
  }
  if (raw.includes("general") || raw.includes("default") || raw.includes("通用")) {
    return "general";
  }
  return "general";
}

export default function ShareIndex() {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [templates, setTemplates] = useState<ShareCopyTemplate[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showInviter, setShowInviter] = useState(false);
  const [channel, setChannel] = useState<InviteChannel>("direct_share");
  const [sceneFilter, setSceneFilter] = useState<ShareSceneFilter>("all");

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

  const filteredTemplates = useMemo(() => {
    const source = templates.length ? templates : [FALLBACK_TEMPLATE];
    if (sceneFilter === "all") {
      return source;
    }
    const filtered = source.filter(item => normalizeScene(item.scene) === sceneFilter);
    return filtered.length ? filtered : source;
  }, [sceneFilter, templates]);

  const currentTemplate = filteredTemplates.length
    ? filteredTemplates[currentIdx % filteredTemplates.length]
    : FALLBACK_TEMPLATE;

  const currentCover = COVER_IMAGES[currentIdx % COVER_IMAGES.length];

  const buildSharePath = (shareChannel: InviteChannel) => {
    const inviter = user?.openid || "";
    return `/pages/invite/welcome?inviter=${encodeURIComponent(inviter)}&channel=${shareChannel}&showInviter=${showInviter ? "1" : "0"}`;
  };

  useLoad(async () => {
    const [lg, cfg] = await Promise.all([
      callCloud("login"),
      callCloud("getSystemConfig"),
    ]);

    const openid = lg?.openid || lg?.user?._openid || "";
    if (openid) {
      setUser({
        openid,
        nickname: lg?.user?.nickname || null,
        avatarUrl: lg?.user?.avatarUrl || null,
      });
    }

    if (cfg?.ok && Array.isArray(cfg?.shareCopyTemplates) && cfg.shareCopyTemplates.length) {
      setTemplates(
        cfg.shareCopyTemplates
          .filter((item: any) => item && item.content)
          .map((item: any) => ({ id: String(item.id || ""), scene: String(item.scene || "general"), content: String(item.content) })),
      );
    } else {
      setTemplates([FALLBACK_TEMPLATE]);
    }
  });

  useShareAppMessage(() => ({
    title: currentTemplate?.content || "KDRHEA · 科迪芮雅",
    path: buildSharePath(channel),
    imageUrl: currentCover,
  }));

  useShareTimeline(() => ({
    title: currentTemplate?.content || "KDRHEA · 科迪芮雅",
    query: `inviter=${encodeURIComponent(user?.openid || "")}&channel=wechat_moments&showInviter=${showInviter ? "1" : "0"}`,
    imageUrl: currentCover,
  }));

  const handleSwitchCopy = () => {
    if (filteredTemplates.length <= 1) {
      Taro.showToast({ title: "暂无更多文案", icon: "none" });
      return;
    }
    setCurrentIdx(prev => (prev + 1) % filteredTemplates.length);
  };

  const handleSceneChange = (nextScene: ShareSceneFilter) => {
    setSceneFilter(nextScene);
    setCurrentIdx(0);
  };

  const handleShareFriend = () => {
    setChannel("direct_share");
  };

  const handleShareMoments = () => {
    setChannel("wechat_moments");
    Taro.showToast({ title: "请通过右上角分享到朋友圈", icon: "none" });
  };

  return (
    <PageWrapper navTitle="分享设置" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
      <View className="min-h-screen bg-kd-paper px-5 pb-10 pt-3">
        <View className="text-center" style={{ paddingTop: "8px" }}>
          <Text style={{ fontSize: "11px", letterSpacing: "0.32em", color: "#3C2218", fontWeight: 500 }}>
            M  Y   S  H  A  R  I  N  G   C  A  R  D
          </Text>
        </View>

        <View
          className="mt-4"
          style={{
            background: "#FAF7F3",
            border: "1px solid #DCC9B6",
            borderRadius: "16px",
            padding: "18px 16px",
          }}
        >
          <View className="flex items-center">
            <View
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "999px",
                border: "1px solid #DCC9B6",
                background: "#FBF7F1",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {showInviter && user?.avatarUrl
                ? <Image src={user.avatarUrl} style={{ width: "44px", height: "44px" }} mode="aspectFill" />
                : <View className="i-mdi-account-outline" style={{ fontSize: "24px", color: "#937761" }} />}
            </View>
            <View className="ml-3" style={{ flex: 1 }}>
              <Text className="block" style={{ fontSize: "12px", color: "#3C2218", letterSpacing: "0.05em" }}>
                {showInviter ? (user?.nickname || "我的邀请") : "KDRHEA"}
              </Text>
              <Text className="block" style={{ fontSize: "10px", color: "#937761", marginTop: "4px" }}>
                {showInviter ? "将展示昵称" : "不展示个人信息"}
              </Text>
            </View>

            <View
              onClick={handleSwitchCopy}
              style={{
                border: "1px solid #DCC9B6",
                borderRadius: "999px",
                padding: "6px 12px",
                fontSize: "11px",
                color: "#3C2218",
                background: "#FBF7F1",
              }}
            >
              换一条
            </View>
          </View>

          <View
            className="mt-4"
            style={{
              background: "#F5EDE3",
              border: "1px solid #DCC9B6",
              borderRadius: "12px",
              padding: "14px 12px",
            }}
          >
            <Text style={{ fontFamily: "var(--kd-font-display)", fontSize: "16px", color: "#3C2218", lineHeight: "1.8", letterSpacing: "0.08em" }}>
              {currentTemplate?.content || "KDRHEA · 科迪芮雅"}
            </Text>
          </View>
        </View>

        <View
          className="mt-5"
          style={{
            background: "#FAF7F3",
            border: "1px solid #E8DFD4",
            borderRadius: "16px",
            padding: "16px",
          }}
        >
          <View className="flex items-center justify-between">
            <Text style={{ fontSize: "13px", color: "#3C2218" }}>展示我的头像与昵称</Text>
            <Switch
              checked={showInviter}
              color="#3C2218"
              onChange={e => setShowInviter(!!e.detail?.value)}
            />
          </View>

          <Text className="mt-4 block" style={{ fontSize: "11px", color: "#937761", letterSpacing: "0.08em" }}>
            场景筛选
          </Text>
          <View className="mt-2 flex flex-wrap" style={{ gap: "8px" }}>
            {SCENE_FILTERS.map((item) => {
              const active = item.key === sceneFilter;
              return (
                <View
                  key={item.key}
                  onClick={() => handleSceneChange(item.key)}
                  style={{
                    borderRadius: "999px",
                    border: active ? "1px solid #3C2218" : "1px solid #DCC9B6",
                    background: active ? "#3C2218" : "#FBF7F1",
                    color: active ? "#FBF7F1" : "#864D39",
                    fontSize: "11px",
                    padding: "6px 12px",
                  }}
                >
                  {item.label}
                </View>
              );
            })}
          </View>
        </View>

        <View className="mt-6">
          <Button
            openType="share"
            onClick={handleShareFriend}
            style={{
              height: "46px",
              lineHeight: "46px",
              borderRadius: "999px",
              border: "1px solid #3C2218",
              background: "#3C2218",
              color: "#FBF7F1",
              fontSize: "13px",
              letterSpacing: "0.08em",
            }}
          >
            分享给朋友
          </Button>

          <Button
            className="mt-3"
            openType="share"
            onClick={handleShareMoments}
            style={{
              height: "46px",
              lineHeight: "46px",
              borderRadius: "999px",
              border: "1px solid #DCC9B6",
              background: "#FBF7F1",
              color: "#3C2218",
              fontSize: "13px",
              letterSpacing: "0.08em",
            }}
          >
            分享到朋友圈
          </Button>
        </View>
      </View>
    </PageWrapper>
  );
}
