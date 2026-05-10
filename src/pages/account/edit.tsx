// 编辑个人资料 · 头像 + 昵称 + 手机号
import { Button, Image, Input, Text, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useState } from "react";
import PageWrapper from "~/components/PageWrapper";

interface UserPartial {
  nickname: string | null;
  phone: string | null;
  avatarUrl: string | null;
  avatarKind: string | null;
}

// 12 个虚拟形象 · 使用 unocss icon
const AVATAR_KINDS = [
  { key: "default", icon: "i-mdi-account-circle-outline", label: "默认" },
  { key: "flower", icon: "i-mdi-flower-outline", label: "繁花" },
  { key: "leaf", icon: "i-mdi-leaf", label: "新叶" },
  { key: "feather", icon: "i-mdi-feather", label: "羽" },
  { key: "spa", icon: "i-mdi-spa-outline", label: "莲" },
  { key: "rose", icon: "i-mdi-rose", label: "玫瑰" },
  { key: "cup", icon: "i-mdi-cup-outline", label: "茶" },
  { key: "music", icon: "i-mdi-music-note-outline", label: "音律" },
  { key: "paw", icon: "i-mdi-paw", label: "毛球" },
  { key: "coffee", icon: "i-mdi-coffee-outline", label: "咖啡" },
  { key: "airplane", icon: "i-mdi-airplane", label: "云游" },
  { key: "fire", icon: "i-mdi-fire", label: "炽热" },
];

function maskPhone(p: string | null) {
  if (!p || p.length < 7) {
    return p || "";
  }
  return `${p.slice(0, 3)} **** ${p.slice(-4)}`;
}

function findKindIcon(kind: string | null) {
  return AVATAR_KINDS.find(a => a.key === kind)?.icon || "i-mdi-account-circle-outline";
}

export default function AccountEdit() {
  const [user, setUser] = useState<UserPartial>({
    nickname: null,
    phone: null,
    avatarUrl: null,
    avatarKind: "default",
  });
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [savingNickname, setSavingNickname] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [bindingPhone, setBindingPhone] = useState(false);

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

  const refresh = async () => {
    const lg = await callCloud("login");
    if (lg?.user) {
      setUser({
        nickname: lg.user.nickname || null,
        phone: lg.user.phone || null,
        avatarUrl: lg.user.avatarUrl || null,
        avatarKind: lg.user.avatarKind || "default",
      });
      setNicknameDraft(lg.user.nickname || "");
    }
  };

  useLoad(refresh);

  // 选虚拟形象
  const pickKind = async (kind: string) => {
    if (savingAvatar || kind === user.avatarKind) {
      return;
    }
    setSavingAvatar(true);
    const r = await callCloud("updateUserProfile", { avatarKind: kind });
    setSavingAvatar(false);
    if (r?.ok) {
      setUser({ ...user, avatarKind: kind, avatarUrl: null });
      Taro.showToast({ title: "已更换", icon: "success" });
    } else {
      Taro.showToast({ title: r?.code || "保存失败", icon: "none" });
    }
  };

  // 上传照片
  const uploadAvatar = async () => {
    if (savingAvatar) {
      return;
    }
    try {
      const chosen = await Taro.chooseImage({ count: 1, sizeType: ["compressed"] });
      const tempPath = chosen.tempFilePaths?.[0];
      if (!tempPath) {
        return;
      }
      setSavingAvatar(true);
      // @ts-expect-error wx.cloud.uploadFile 由微信注入
      const ext = String(tempPath).split(".").pop() || "jpg";
      // @ts-expect-error wx.cloud.uploadFile 由微信注入
      const up = await wx.cloud.uploadFile({
        cloudPath: `avatars/${Date.now()}.${ext}`,
        filePath: tempPath,
      });
      const fileID = up.fileID;
      const r = await callCloud("updateUserProfile", { avatarUrl: fileID });
      setSavingAvatar(false);
      if (r?.ok) {
        setUser({ ...user, avatarUrl: fileID, avatarKind: null });
        Taro.showToast({ title: "上传成功", icon: "success" });
      } else {
        Taro.showToast({ title: r?.code || "保存失败", icon: "none" });
      }
    } catch {
      setSavingAvatar(false);
    }
  };

  const saveNickname = async () => {
    if (savingNickname) {
      return;
    }
    if (nicknameDraft.length > 20) {
      Taro.showToast({ title: "昵称不超过 20 字", icon: "none" });
      return;
    }
    setSavingNickname(true);
    const r = await callCloud("updateUserProfile", { nickname: nicknameDraft });
    setSavingNickname(false);
    if (r?.ok) {
      setUser({ ...user, nickname: nicknameDraft || null });
      Taro.showToast({ title: "已保存", icon: "success" });
    } else {
      Taro.showToast({ title: r?.code || "保存失败", icon: "none" });
    }
  };

  // 改手机号 · 走微信原生授权
  const handleGetPhoneNumber = async (e: any) => {
    if (bindingPhone) {
      return;
    }
    const code = e?.detail?.code;
    if (!code) {
      Taro.showToast({ title: "需授权才能更换", icon: "none" });
      return;
    }
    setBindingPhone(true);
    const r = await callCloud("bindPhone", { phoneCode: code });
    setBindingPhone(false);
    if (r?.ok && r.phone) {
      setUser({ ...user, phone: r.phone });
      Taro.showToast({ title: "已更新", icon: "success" });
    } else {
      Taro.showToast({ title: r?.code || "更新失败", icon: "none" });
    }
  };

  return (
    <PageWrapper navTitle="编辑资料" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
      <View className="min-h-screen bg-kd-paper px-5 pb-12 pt-3">
        {/* 顶部 letter-spacing 标 */}
        <View className="text-center" style={{ paddingTop: "8px" }}>
          <Text style={{ fontSize: "11px", letterSpacing: "0.32em", color: "#3C2218", fontWeight: 500 }}>
            P  R  O  F  I  L  E
          </Text>
        </View>

        {/* 当前头像预览 */}
        <View className="mt-6 text-center">
          <View
            className="mx-auto"
            style={{
              width: "84px",
              height: "84px",
              border: "1px solid #864D39",
              background: "#FAF7F3",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {user.avatarUrl
              ? (
                  <Image src={user.avatarUrl} style={{ width: "100%", height: "100%" }} mode="aspectFill" />
                )
              : (
                  <View className={findKindIcon(user.avatarKind)} style={{ fontSize: "44px", color: "#3C2218" }} />
                )}
          </View>
          <Text className="mt-3 block" style={{ fontSize: "11px", letterSpacing: "0.16em", color: "#864D39" }}>
            {user.nickname || "未设置昵称"}
          </Text>
        </View>

        {/* 头像选择 · 上传照片 */}
        <View
          className="mt-6"
          style={{ background: "#FAF7F3", border: "1px solid #E8DFD4", padding: "18px 16px" }}
        >
          <SectionLabel text="头像" />

          <View
            onClick={uploadAvatar}
            className="mt-3 flex items-center"
            style={{
              background: "#FBF7F1",
              border: "1px solid #DCC9B6",
              padding: "12px 14px",
            }}
          >
            <View className="i-mdi-camera-outline" style={{ fontSize: "18px", color: "#3C2218", marginRight: "10px" }} />
            <Text style={{ fontSize: "13px", color: "#3C2218", flex: 1 }}>
              {savingAvatar ? "处理中…" : "上传照片"}
            </Text>
            <Text style={{ fontSize: "11px", color: "#937761" }}>→</Text>
          </View>

          <Text className="mt-4 block" style={{ fontSize: "11px", letterSpacing: "0.12em", color: "#937761" }}>
            或选择虚拟形象
          </Text>
          <View className="mt-2 flex flex-wrap" style={{ gap: "8px" }}>
            {AVATAR_KINDS.map((a) => {
              const active = user.avatarKind === a.key && !user.avatarUrl;
              return (
                <View
                  key={a.key}
                  onClick={() => pickKind(a.key)}
                  style={{
                    width: "calc(25% - 6px)",
                    aspectRatio: "1 / 1",
                    background: active ? "#3C2218" : "#FBF7F1",
                    border: active ? "1px solid #3C2218" : "1px solid #DCC9B6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <View
                    className={a.icon}
                    style={{ fontSize: "26px", color: active ? "#FBF7F1" : "#3C2218" }}
                  />
                </View>
              );
            })}
          </View>
        </View>

        {/* 昵称 */}
        <View
          className="mt-5"
          style={{ background: "#FAF7F3", border: "1px solid #E8DFD4", padding: "18px 16px" }}
        >
          <SectionLabel text="昵称" />
          <View className="mt-3 flex items-center">
            <Input
              value={nicknameDraft}
              onInput={e => setNicknameDraft(e.detail.value)}
              placeholder="为自己起个昵称"
              placeholderStyle="color:#C4AD98;font-size:14px"
              maxlength={20}
              cursorSpacing={120}
              adjustPosition
              style={{
                flex: 1,
                background: "#FBF7F1",
                border: "1px solid #DCC9B6",
                paddingLeft: "12px",
                paddingRight: "12px",
                height: "44px",
                lineHeight: "44px",
                fontSize: "14px",
                color: "#3C2218",
              }}
            />
            <View
              onClick={saveNickname}
              className="ml-2"
              style={{
                background: "#3C2218",
                color: "#FBF7F1",
                fontSize: "12px",
                letterSpacing: "0.08em",
                padding: "0 16px",
                height: "44px",
                lineHeight: "44px",
              }}
            >
              {savingNickname ? "保存中" : "保存"}
            </View>
          </View>
        </View>

        {/* 手机号 · 仅微信授权 */}
        <View
          className="mt-5"
          style={{ background: "#FAF7F3", border: "1px solid #E8DFD4", padding: "18px 16px" }}
        >
          <SectionLabel text="手机号" />
          <View
            className="mt-3 flex items-center justify-between"
            style={{
              background: "#FBF7F1",
              border: "1px solid #DCC9B6",
              paddingLeft: "12px",
              paddingRight: "12px",
              height: "44px",
            }}
          >
            <View className="flex items-center" style={{ flex: 1 }}>
              <View className="i-mdi-shield-check-outline" style={{ fontSize: "16px", color: "#5E3425", marginRight: "8px" }} />
              <Text style={{ fontSize: "14px", color: user.phone ? "#3C2218" : "#A98D78", letterSpacing: "0.04em" }}>
                {user.phone ? maskPhone(user.phone) : "未绑定"}
              </Text>
            </View>
            <Button
              openType="getPhoneNumber"
              onGetPhoneNumber={handleGetPhoneNumber}
              hoverClass="none"
              disabled={bindingPhone}
              style={{
                background: "transparent",
                color: "#864D39",
                fontSize: "11px",
                letterSpacing: "0.08em",
                padding: "0 8px",
                height: "26px",
                lineHeight: "26px",
                border: "1px solid #DCC9B6",
                borderRadius: 0,
              }}
            >
              {bindingPhone ? "更新中" : (user.phone ? "更换" : "绑定")}
            </Button>
          </View>
          <Text className="mt-2 block" style={{ fontSize: "10px", color: "#937761" }}>
            微信验证 · 不支持手填
          </Text>
        </View>
      </View>
    </PageWrapper>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <Text className="block" style={{ fontSize: "11px", letterSpacing: "0.18em", color: "#864D39", fontWeight: 500 }}>
      {text}
    </Text>
  );
}
