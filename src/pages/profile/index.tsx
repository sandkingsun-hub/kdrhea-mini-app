// 我的 · Tab 4 · 用户卡 + 入口列表
import { Image, Text, View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { useState } from "react";
import PageWrapper from "~/components/PageWrapper";
import { syncTabBarSelected } from "~/utils/tabbarSync";
import "./index.scss";

interface User {
  _openid: string;
  nickname: string | null;
  phone: string | null;
  avatarUrl: string | null;
  avatarKind: string | null;
  registeredAt: string;
  activatedFromOldCustomer: boolean;
  role: string;
}

const AVATAR_ICON_MAP: Record<string, string> = {
  default: "i-mdi-account-circle-outline",
  flower: "i-mdi-flower-outline",
  leaf: "i-mdi-leaf",
  feather: "i-mdi-feather",
  spa: "i-mdi-spa-outline",
  rose: "i-mdi-rose",
  cup: "i-mdi-cup-outline",
  music: "i-mdi-music-note-outline",
  paw: "i-mdi-paw",
  coffee: "i-mdi-coffee-outline",
  airplane: "i-mdi-airplane",
  fire: "i-mdi-fire",
};

function maskPhone(p: string | null) {
  if (!p || p.length < 7) {
    return "";
  }
  return `${p.slice(0, 3)} **** ${p.slice(-4)}`;
}

export default function Profile() {
  const [user, setUser] = useState<User | null>(null);

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

  const load = async () => {
    const lg = await callCloud("login");
    if (lg?.ok && lg.user) {
      setUser({
        _openid: lg.user._openid,
        nickname: lg.user.nickname || null,
        phone: lg.user.phone || null,
        avatarUrl: lg.user.avatarUrl || null,
        avatarKind: lg.user.avatarKind || "default",
        registeredAt: lg.user.registeredAt,
        activatedFromOldCustomer: lg.user.activatedFromOldCustomer,
        role: lg.user.role || "customer",
      });
    }
  };

  useLoad(load);
  useDidShow(() => {
    syncTabBarSelected(3);
    load();
  });

  const handleInvite = () => Taro.navigateTo({ url: "/pages/share/index" });

  const goEdit = () => Taro.navigateTo({ url: "/pages/account/edit" });
  const goRecords = (tab?: string) =>
    Taro.navigateTo({ url: `/pages/account/records${tab ? `?tab=${tab}` : ""}` });

  const avatarIcon = AVATAR_ICON_MAP[user?.avatarKind || "default"] || "i-mdi-account-circle-outline";
  const displayName = user?.nickname || (user?.phone ? maskPhone(user.phone) : "微信用户");

  return (
    <PageWrapper navTitle="我的" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
      <View className="min-h-screen bg-kd-paper pb-24">
        {/* 顶部 ME */}
        <View className="px-6 pb-2 pt-6">
          <Text style={{ fontSize: "11px", letterSpacing: "0.32em", color: "#937761" }}>
            M  E
          </Text>
        </View>

        {/* 用户卡 · 头像 + 信息 + 编辑入口 */}
        <View
          className="mx-5 mt-2"
          style={{ background: "#FAF7F3", border: "1px solid #E8DFD4", borderRadius: "16px", padding: "20px 18px" }}
          onClick={goEdit}
        >
          <View className="flex items-center">
            {/* 头像 */}
            <View
              style={{
                width: "64px",
                height: "64px",
                border: "1px solid #864D39",
                background: "#FBF7F1",
                borderRadius: "999px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              {user?.avatarUrl
                ? (
                    <Image src={user.avatarUrl} style={{ width: "100%", height: "100%" }} mode="aspectFill" />
                  )
                : (
                    <View className={avatarIcon} style={{ fontSize: "34px", color: "#3C2218" }} />
                  )}
            </View>

            {/* 信息 */}
            <View className="ml-4" style={{ flex: 1 }}>
              <Text
                className="block"
                style={{
                  fontFamily: "var(--kd-font-display)",
                  fontSize: "18px",
                  color: "#3C2218",
                  fontWeight: 400,
                  letterSpacing: "0.04em",
                }}
              >
                {displayName}
              </Text>
              {user?.phone && user.nickname && (
                <Text className="mt-1 block" style={{ fontSize: "11px", color: "#864D39", letterSpacing: "0.04em" }}>
                  {maskPhone(user.phone)}
                </Text>
              )}
              <Text className="mt-1 block" style={{ fontSize: "10px", color: "#937761" }}>
                {user
                  ? `注册于 ${user.registeredAt.slice(0, 10)}`
                  : "未登录"}
              </Text>
              {user?.activatedFromOldCustomer && (
                <View
                  className="mt-2 inline-block"
                  style={{
                    fontSize: "10px",
                    letterSpacing: "0.12em",
                    color: "#864D39",
                    background: "#F5EDE3",
                    border: "1px solid #DCC9B6",
                    borderRadius: "999px",
                    padding: "0 10px",
                    lineHeight: "20px",
                  }}
                >
                  已激活老客
                </View>
              )}
            </View>

            {/* 编辑箭头 */}
            <View className="i-mdi-chevron-right" style={{ fontSize: "18px", color: "#937761", marginLeft: "8px" }} />
          </View>
        </View>

        {/* 操作入口 */}
        <View className="mt-5 px-6">
          <MenuItem
            icon="i-mdi-receipt-text-outline"
            label="订单与积分"
            onClick={() => goRecords()}
          />
          <MenuItem
            icon="i-mdi-calendar-check-outline"
            label="我的预约"
            onClick={() => Taro.navigateTo({ url: "/pages/appointment/list" })}
          />
          <MenuItem
            icon="i-mdi-share-variant-outline"
            label="分享给在意的人"
            onClick={handleInvite}
          />
          <MenuItem
            icon="i-mdi-ticket-percent-outline"
            label="我的优惠"
            onClick={() => Taro.navigateTo({ url: "/pages/coupons/index" })}
          />
          <MenuItem
            icon="i-mdi-headset"
            label="联系客服"
            onClick={() => Taro.showToast({ title: "联系客服 · 待开发", icon: "none" })}
          />

          {/* 员工入口 · 仅 staff/admin 可见 */}
          {(user?.role === "staff" || user?.role === "admin") && (
            <>
              <View className="mb-2 mt-6">
                <Text style={{ fontSize: "10px", letterSpacing: "0.24em", color: "#A98D78" }}>
                  S  T  A  F  F
                </Text>
              </View>
              <MenuItem
                icon="i-mdi-qrcode-scan"
                label="扫码工具"
                staff
                onClick={() => Taro.navigateTo({ url: "/pages/staff/scanner" })}
              />
              <MenuItem
                icon="i-mdi-calendar-text-outline"
                label="预约管理"
                staff
                onClick={() => Taro.navigateTo({ url: "/pages/staff/appointments" })}
              />
              <MenuItem
                icon="i-mdi-ticket-percent-outline"
                label="发券给客户"
                staff
                onClick={() => Taro.navigateTo({ url: "/pages/staff/grant-coupon" })}
              />
              <MenuItem
                icon="i-mdi-pill"
                label="员工扫药"
                staff
                onClick={() => Taro.navigateTo({ url: "/pages/staff/medicine-scanner" })}
              />
            </>
          )}
        </View>

        {/* footer dev */}
        <View className="mt-8 px-6 text-center">
          <Text
            style={{ fontSize: "10px", letterSpacing: "0.12em", color: "#C4AD98" }}
            onClick={() => Taro.navigateTo({ url: "/pages/devtools/index" })}
          >
            ⚙ developer · dev only
          </Text>
        </View>
      </View>
    </PageWrapper>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  staff = false,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  staff?: boolean;
}) {
  return (
    <View
      className="flex items-center justify-between border-b py-4"
      style={{ borderColor: "#E8DFD4" }}
      onClick={onClick}
    >
      <View className="flex items-center">
        <View
          className={icon}
          style={{ fontSize: "18px", color: staff ? "#864D39" : "#3C2218", marginRight: "12px" }}
        />
        <Text
          style={{
            fontSize: "13px",
            color: staff ? "#864D39" : "#3C2218",
            letterSpacing: staff ? "0.06em" : "0.02em",
          }}
        >
          {label}
        </Text>
      </View>
      <View
        className="i-mdi-chevron-right"
        style={{ fontSize: "16px", color: staff ? "#864D39" : "#937761" }}
      />
    </View>
  );
}
