// 我的二维码 · 客户展示给前台员工扫
// MVP 简化：码内容 = openid（短期 · 后期换签名 token 防伪）
import { Canvas, Text, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import qrcode from "qrcode-generator";
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

  // 真 QR 渲染 · 用 qrcode-generator 计算矩阵·Canvas 画块
  const drawQr = (openid: string) => {
    setTimeout(() => {
      const qr = qrcode(0, "M"); // typeNumber=0 (auto)·errorCorrection=M
      qr.addData(openid);
      qr.make();
      const moduleCount = qr.getModuleCount();

      const ctx = Taro.createCanvasContext("qr-canvas");
      const size = 200;
      const cell = size / moduleCount;

      // 米白底
      ctx.setFillStyle("#FBF7F1");
      ctx.fillRect(0, 0, size, size);

      // 黑模块
      ctx.setFillStyle("#3C2218");
      for (let r = 0; r < moduleCount; r++) {
        for (let c = 0; c < moduleCount; c++) {
          if (qr.isDark(r, c)) {
            ctx.fillRect(c * cell, r * cell, cell + 0.5, cell + 0.5);
          }
        }
      }
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
    <PageWrapper navTitle="我的二维码" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
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
