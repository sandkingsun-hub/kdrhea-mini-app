// 我的二维码 · 客户展示给前台员工扫
// MVP 简化：码内容 = openid（短期 · 后期换签名 token 防伪）
import { Canvas, Text, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useState } from "react";
import PageWrapper from "~/components/PageWrapper";

interface UserSummary {
  openid: string;
  phone: string | null;
  balance: number;
}

function fenToYuan(n: number) {
  return (n / 100).toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function formatPoints(n: number) {
  return n.toLocaleString("zh-CN");
}

export default function QrCode() {
  const [user, setUser] = useState<UserSummary | null>(null);

  const callCloud = async (name: string, data?: any): Promise<any> => {
    try {
      // @ts-expect-error wx 由微信运行时注入
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

  // 极简 QR 渲染（用 canvas API 画一个文字提示版的伪二维码）
  // MVP 阶段：不引入 qrcode 库·只显示一段编码文字
  // 真实部署时换成 weapp-qrcode 或类似库
  const drawQr = (openid: string) => {
    setTimeout(() => {
      const ctx = Taro.createCanvasContext("qr-canvas");
      const size = 200;
      ctx.setFillStyle("#FBF7F1");
      ctx.fillRect(0, 0, size, size);

      // 简化二维码：根据 openid 哈希画方块矩阵（占位·能识别区分用户即可）
      let hash = 0;
      for (let i = 0; i < openid.length; i++) {
        hash = (hash * 31 + openid.charCodeAt(i)) >>> 0;
      }

      ctx.setFillStyle("#3C2218");
      const cell = 8;
      const grid = size / cell;
      for (let y = 0; y < grid; y++) {
        for (let x = 0; x < grid; x++) {
          // 用 hash + 坐标确定是否填充
          const v = (hash + x * 7919 + y * 6271) & 0xFF;
          if (v > 128) {
            ctx.fillRect(x * cell, y * cell, cell, cell);
          }
        }
      }
      // 角定位框（伪二维码风格）
      ctx.setFillStyle("#3C2218");
      const corner = 24;
      [[0, 0], [size - corner, 0], [0, size - corner]].forEach(([x, y]) => {
        ctx.fillRect(x, y, corner, corner);
        ctx.setFillStyle("#FBF7F1");
        ctx.fillRect(x + 4, y + 4, corner - 8, corner - 8);
        ctx.setFillStyle("#3C2218");
        ctx.fillRect(x + 8, y + 8, corner - 16, corner - 16);
      });
      ctx.draw();
    }, 200);
  };

  useLoad(async () => {
    const lg = await callCloud("login");
    const acc = await callCloud("getMyAccount");
    setUser({
      openid: lg?.openid || "",
      phone: lg?.user?.phone || null,
      balance: acc?.account?.balance || 0,
    });
    if (lg?.openid) {
      drawQr(lg.openid);
    }
  });

  return (
    <PageWrapper navTitle="我的二维码" className="h-full bg-kd-paper" shouldShowBottomActions={false} shouldShowNavigationMenu={false}>
      <View className="min-h-screen flex flex-col items-center bg-kd-paper px-6 pt-6">
        <Text style={{ fontSize: "11px", letterSpacing: "0.32em", color: "#937761" }}>
          M  Y    Q  R    C  O  D  E
        </Text>
        <Text className="mt-2 block" style={{ fontSize: "11px", color: "#A98D78" }}>
          请向门店员工出示此码
        </Text>

        {/* 二维码容器 */}
        <View
          className="mt-8 flex items-center justify-center"
          style={{
            background: "#FBF7F1",
            border: "1px solid #DCC9B6",
            padding: "24px",
            width: "260px",
            height: "260px",
          }}
        >
          <Canvas canvasId="qr-canvas" style={{ width: "200px", height: "200px" }} />
        </View>

        <Text className="mt-4 block" style={{ fontSize: "10px", color: "#A98D78", fontFamily: "monospace" }}>
          {user?.openid?.slice(0, 12)}
          ...
        </Text>

        {/* 当前余额 */}
        <View className="mt-10 text-center">
          <Text style={{ fontSize: "11px", letterSpacing: "0.24em", color: "#937761" }}>
            POINTS  ·  当前余额
          </Text>
          <Text
            className="mt-2 block"
            style={{
              fontFamily: "var(--kd-font-display)",
              fontSize: "32px",
              color: "#3C2218",
              fontWeight: 400,
            }}
          >
            {user ? formatPoints(user.balance) : "—"}
          </Text>
          {user && (
            <Text style={{ fontSize: "11px", color: "#864D39" }}>
              ≈ ¥
              {fenToYuan(user.balance)}
            </Text>
          )}
        </View>

        {/* 使用提示 */}
        <View className="mt-12 px-4 text-center">
          <Text style={{ fontSize: "11px", lineHeight: "1.85", color: "#5E3425", fontWeight: 300 }}>
            扫码可用于：
            {"\n"}
            · 线下消费 · 自动 +2% 积分返利
            {"\n"}
            · 抵扣消费 · 用积分顶现金
            {"\n"}
            · 到店打卡 · +500 积分
          </Text>
        </View>
      </View>
    </PageWrapper>
  );
}
