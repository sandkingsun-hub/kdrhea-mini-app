import type { PetPanel } from "~/types/pet";
import { Button, Canvas, View } from "@tarojs/components";
import Taro, { useShareAppMessage, useShareTimeline } from "@tarojs/taro";
import { useEffect, useState } from "react";
import PageWrapper from "~/components/PageWrapper";
import { petCloud } from "~/lib/petCloud";

const CANVAS_W = 640;
const CANVAS_H = 1138;

const MONTH_LABELS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

export default function ShareCardPage() {
  const [panel, setPanel] = useState<PetPanel | null>(null);
  const [imgUrl, setImgUrl] = useState<string>("");
  const [drawing, setDrawing] = useState(false);

  const draw = (currentPanel: PetPanel) => {
    setDrawing(true);

    const query = Taro.createSelectorQuery();
    query.select("#share-canvas").fields({ node: true, size: true }).exec((res) => {
      try {
        // @ts-expect-error wx Canvas 2D node
        const canvas = res[0]?.node;
        if (!canvas) {
          setDrawing(false);
          return;
        }
        const ctx = canvas.getContext("2d");
        // 用新 API · getSystemInfoSync 已废弃
        let dpr = 2;
        try {
          // @ts-expect-error wx.getWindowInfo · 新 API
          if (typeof wx !== "undefined" && wx.getWindowInfo) {
            dpr = wx.getWindowInfo().pixelRatio || 2;
          }
        } catch { /* keep dpr=2 */ }
        canvas.width = CANVAS_W * dpr;
        canvas.height = CANVAS_H * dpr;
        ctx.scale(dpr, dpr);

        // 背景米白
        ctx.fillStyle = "#FBF7F1";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // 顶部 KDRHEA 品牌
        ctx.fillStyle = "#3C2218";
        ctx.font = "300 48px Georgia,serif";
        ctx.textAlign = "center";
        ctx.fillText("KDRHEA", CANVAS_W / 2, 80);
        ctx.fillStyle = "#937761";
        ctx.font = "18px sans-serif";
        ctx.fillText("科 迪 芮 雅  ·  美 学 与 善 意", CANVAS_W / 2, 110);

        // 月份戳
        const now = new Date();
        const monthStr = `${now.getFullYear()}  ·  ${MONTH_LABELS[now.getMonth()]}`;
        ctx.strokeStyle = "rgba(60,34,24,0.3)";
        ctx.lineWidth = 1;
        ctx.strokeRect(CANVAS_W / 2 - 90, 150, 180, 40);
        ctx.fillStyle = "#864D39";
        ctx.font = "16px sans-serif";
        ctx.fillText(monthStr, CANVAS_W / 2, 175);

        // 中部 · 温暖文案（不展示金额）
        ctx.fillStyle = "#864D39";
        ctx.font = "20px sans-serif";
        ctx.fillText("和 KDRHEA 一起", CANVAS_W / 2, 280);
        ctx.fillText("把善意养成习惯", CANVAS_W / 2, 320);

        // 受助方
        ctx.fillStyle = "#937761";
        ctx.font = "14px sans-serif";
        ctx.fillText(`月度合捐 · ${currentPanel.charity.currentOrg?.name_cn || "徐州小动物救助协会"}`, CANVAS_W / 2, 370);

        // 宠物舞台占位框（中央视觉锚点，sprite 异步绘制·这里画背景框）
        ctx.fillStyle = "#F5EDE3";
        ctx.fillRect(CANVAS_W / 2 - 120, 430, 240, 240);
        ctx.strokeStyle = "rgba(60,34,24,0.12)";
        ctx.lineWidth = 1;
        ctx.strokeRect(CANVAS_W / 2 - 120, 430, 240, 240);
        // 占位 emoji（真 sprite ready 后替换为 drawImage）
        ctx.fillStyle = "#3C2218";
        ctx.font = "120px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(currentPanel.species._id.startsWith("dog") ? "🐕" : "🐱", CANVAS_W / 2, 595);

        // 宠物名 + 等级
        ctx.fillStyle = "#3C2218";
        ctx.font = "18px sans-serif";
        ctx.fillText(`${currentPanel.species.name_cn}  ·  Lv ${currentPanel.pet.level}`, CANVAS_W / 2, 720);

        // 徽章带（如有）
        if (currentPanel.badges.length > 0) {
          const startX = CANVAS_W / 2 - (currentPanel.badges.length * 30) / 2 + 15;
          currentPanel.badges.forEach((b, i) => {
            const tier = b.badgeId.endsWith("gold")
              ? "#FFD700"
              : b.badgeId.endsWith("silver") ? "#D8D8D8" : "#CD7F32";
            ctx.fillStyle = tier;
            ctx.beginPath();
            ctx.arc(startX + i * 30, 790, 18, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#FBF7F1";
            ctx.font = "16px sans-serif";
            ctx.fillText("♥", startX + i * 30, 796);
          });
        }

        // 底部 Slogan
        ctx.fillStyle = "#937761";
        ctx.font = "14px sans-serif";
        ctx.fillText("是 医 疗  ·  更 是 美 学 的 深 耕", CANVAS_W / 2, 1010);
        ctx.fillText("是 定 制  ·  更 是 安 全 的 承 诺", CANVAS_W / 2, 1045);
        ctx.fillStyle = "#A98D78";
        ctx.font = "12px sans-serif";
        ctx.fillText("扫 码 加 入 KDRHEA  ·  一起做一件温暖的事", CANVAS_W / 2, 1090);

        // 记录分享日志（异步，不阻塞）
        void petCloud.generateShareLog({
          contributionFen: currentPanel.charity.currentMonthFen,
          petLevel: currentPanel.pet.level,
          petSpecies: currentPanel.species._id,
          badges: currentPanel.badges.map(b => b.badgeId),
          yyyymm: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
        });

        // 导出为本地图
        setTimeout(() => {
          // @ts-expect-error wx.canvasToTempFilePath
          wx.canvasToTempFilePath({
            canvas,
            success: (r: { tempFilePath: string }) => {
              setImgUrl(r.tempFilePath);
              setDrawing(false);
            },
            fail: () => setDrawing(false),
          });
        }, 100);
      } catch (e) {
        console.warn("[share-card] draw failed:", e);
        setDrawing(false);
      }
    });
  };

  useEffect(() => {
    void (async () => {
      try {
        const r = await petCloud.getPanel();
        if (r.ok && r.pet && r.species) {
          setPanel(r as PetPanel);
        }
      } catch (e) {
        console.warn("[share-card] getPanel failed:", e);
      }
    })();
  }, []);

  useEffect(() => {
    if (panel && !drawing) {
      draw(panel);
    }
  }, [panel]);

  const handleSave = async () => {
    if (!imgUrl) {
      return;
    }
    try {
      await Taro.saveImageToPhotosAlbum({ filePath: imgUrl });
      Taro.showToast({ title: "已保存到相册", icon: "success" });
    } catch {
      Taro.showToast({ title: "保存失败", icon: "none" });
    }
  };

  // 分享到朋友圈：先保存图 + 引导用户去朋友圈手动发（小程序 API 限制）
  const handleShareTimeline = async () => {
    if (!imgUrl) {
      return;
    }
    try {
      await Taro.saveImageToPhotosAlbum({ filePath: imgUrl });
      void Taro.showModal({
        title: "已保存到相册",
        content: "打开微信朋友圈 · 选「+」从相册选这张图发布即可",
        confirmText: "知道了",
        showCancel: false,
      });
    } catch {
      Taro.showToast({ title: "保存失败·请允许相册权限", icon: "none" });
    }
  };

  // 转发好友 / 群聊
  useShareAppMessage(() => ({
    title: "和 KDRHEA 一起·把善意养成习惯",
    path: "/pages/index/index",
    imageUrl: imgUrl || undefined,
  }));

  // 右上角 → 朋友圈（小程序原生菜单）
  useShareTimeline(() => ({
    title: "和 KDRHEA 一起·把善意养成习惯",
    query: "",
    imageUrl: imgUrl || undefined,
  }));

  return (
    <PageWrapper navTitle="爱心海报" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
      <View className="min-h-screen flex flex-col items-center pb-8 pt-4" style={{ background: "#FBF7F1" }}>
        <Canvas
          id="share-canvas"
          canvasId="share-canvas"
          type="2d"
          style={{ width: "320px", height: "569px", border: "1px solid rgba(60,34,24,0.1)" }}
        />
        <Button
          onClick={handleSave}
          className="mt-4 tracking-widest"
          style={{ background: "#3C2218", color: "#FBF7F1" }}
          disabled={!imgUrl}
        >
          💾 保存到相册
        </Button>
        <Button
          openType="share"
          className="mt-2 tracking-widest"
          style={{ background: "#864D39", color: "#FBF7F1" }}
        >
          📤 转发好友
        </Button>
        <Button
          onClick={handleShareTimeline}
          className="mt-2 tracking-widest"
          style={{ background: "#A98D78", color: "#FBF7F1" }}
          disabled={!imgUrl}
        >
          🌿 分享到朋友圈
        </Button>
        <View
          className="mt-3 px-6 text-center text-[20rpx]"
          style={{ color: "#937761", letterSpacing: "0.08em" }}
        >
          海报为静态图 · 仅作温暖叙事 · 不展示具体金额
        </View>
      </View>
    </PageWrapper>
  );
}
