import type { PetFoodSku, PetPanel, PetState } from "~/types/pet";
import { Button, Text, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useEffect, useRef, useState } from "react";
import { PetSprite } from "~/components/Pet/PetSprite";
import { petCloud } from "~/lib/petCloud";

const SLEEP_AFTER_MS = 10_000;
const EXP_THRESHOLDS = [80, 320, 800, 1800, 3000, 4000, 6000, 9000, 15000];

export default function CharityPage() {
  const [panel, setPanel] = useState<PetPanel | null>(null);
  const [foods, setFoods] = useState<PetFoodSku[]>([]);
  const [petState, setPetState] = useState<PetState>("idle");
  const [feeding, setFeeding] = useState(false);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async () => {
    const r = await petCloud.getPanel();
    if (r.ok) {
      setPanel(r as PetPanel);
    }
    const sf = await petCloud.listFoodSku();
    if (sf.ok) {
      setFoods(sf.items.sort((a, b) => a.sortOrder - b.sortOrder));
    }
  };

  const resetSleepTimer = () => {
    if (petState === "sleeping") {
      setPetState("idle");
    }
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
    }
    sleepTimerRef.current = setTimeout(setPetState, SLEEP_AFTER_MS, "sleeping");
  };

  useLoad(() => {
    void load();
  });

  useEffect(() => {
    const timer = setTimeout(setPetState, SLEEP_AFTER_MS, "sleeping");
    sleepTimerRef.current = timer;
    return () => clearTimeout(timer);
  }, []);

  const handlePetClick = () => {
    resetSleepTimer();
    setPetState("happy");
    setTimeout(setPetState, 500, "idle");
  };

  const handleFeed = async (sku: PetFoodSku) => {
    if (feeding) {
      return;
    }
    resetSleepTimer();
    setFeeding(true);
    setPetState("happy");
    const r = await petCloud.feed(sku._id);
    if (!r.ok) {
      Taro.showToast({
        title: r.code === "SPEND_FAILED" ? "积分不足" : `失败 ${r.code || ""}`,
        icon: "none",
      });
      setFeeding(false);
      setPetState("idle");
      return;
    }
    Taro.showToast({ title: `已助 ¥${(r.charityAddedFen / 100).toFixed(2)}`, icon: "success" });
    if (r.levelUps.length > 0) {
      void Taro.showModal({
        title: "宠物升级 🎉",
        content: `升到 Lv${r.newLevel}!`,
        showCancel: false,
      });
    }
    if (r.newBadges.length > 0) {
      void Taro.showModal({
        title: "解锁徽章 🥉",
        content: `获得 ${r.newBadges.join(", ")}`,
        showCancel: false,
      });
    }
    await load();
    setTimeout(() => {
      setFeeding(false);
      setPetState("idle");
    }, 500);
  };

  const handleShare = () => {
    void Taro.navigateTo({ url: "/pages/share-card/index" });
  };

  if (!panel) {
    return <View className="p-6 text-[#937761]">载入中…</View>;
  }

  const expForNextLevel = EXP_THRESHOLDS[panel.pet.level - 1] || 0;
  const expProgress = expForNextLevel > 0
    ? Math.min(100, Math.round((panel.pet.experience / expForNextLevel) * 100))
    : 100;

  return (
    <View className="min-h-screen bg-[#FBF7F1] px-5 pb-8 pt-4">
      <Text className="block text-[18px] text-[#3C2218] font-serif">公益与陪伴</Text>

      {/* 宠物舞台 */}
      <View
        className="relative mt-4 overflow-hidden rounded-[16rpx]"
        style={{
          background: "linear-gradient(180deg, #FFE4B5 0%, #F4A460 60%, #D2691E 100%)",
          height: "360rpx",
        }}
        onClick={handlePetClick}
      >
        <View
          className="absolute bottom-0 w-full"
          style={{ height: "40rpx", background: "linear-gradient(to top, #8B4513, transparent)" }}
        />
        <View
          className="absolute bottom-[40rpx] left-1/2"
          style={{ transform: "translateX(-50%)" }}
        >
          <PetSprite species={panel.species} skin={panel.skin} state={petState} />
        </View>
        <View
          className="absolute left-[16rpx] top-[16rpx] rounded-[16rpx] px-[12rpx] py-[4rpx] text-[20rpx] tracking-wider"
          style={{ background: "rgba(60,34,24,0.85)", color: "#FBF7F1" }}
        >
          {petState === "sleeping" ? "💤" : petState === "happy" ? "✨" : "🌟"}
          {" "}
          {panel.species.name_cn}
          {" "}
          · Lv
          {panel.pet.level}
        </View>
      </View>

      {/* 经验进度 */}
      <View className="mt-3">
        <View className="flex justify-between text-[20rpx] text-[#937761] tracking-wider">
          <Text>经验</Text>
          <Text>
            {panel.pet.experience}
            {" "}
            /
            {" "}
            {expForNextLevel}
            {" "}
            → Lv
            {Math.min(panel.pet.level + 1, 10)}
          </Text>
        </View>
        <View className="mt-1 h-[6rpx] overflow-hidden rounded-[3rpx]" style={{ background: "rgba(60,34,24,0.08)" }}>
          <View className="h-full" style={{ width: `${expProgress}%`, background: "#864D39" }} />
        </View>
      </View>

      {/* 喂食选项 */}
      <View className="mt-4">
        <Text className="mb-2 block text-[20rpx] text-[#937761] tracking-widest">F E E D</Text>
        <View className="flex gap-2">
          {foods.map(sku => (
            <View
              key={sku._id}
              onClick={() => void handleFeed(sku)}
              className={`flex-1 border rounded-[12rpx] p-[16rpx] text-center ${feeding ? "opacity-50" : ""}`}
              style={{
                borderColor: sku._id === "sku_pet_food_medium" ? "#3C2218" : "rgba(60,34,24,0.2)",
                borderWidth: "1rpx",
                background: "#FBF7F1",
              }}
            >
              <Text className="block text-[28rpx]">🍱</Text>
              <Text className="mt-1 block text-[20rpx] text-[#3C2218]">{sku.name}</Text>
              <Text className="mt-1 block text-[18rpx] text-[#937761]">
                {sku.pointsPrice}
                {" "}
                积分 · +
                {sku.experience}
                {" "}
                经验
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* 个人公益累计 */}
      <View className="mt-4 rounded-[12rpx] p-[24rpx]" style={{ background: "#F5EDE3" }}>
        <Text className="block text-[20rpx] text-[#864D39] tracking-widest">
          M Y    C O N T R I B U T I O N
        </Text>
        <Text className="mt-1 block text-[40rpx] text-[#3C2218] font-serif">
          ¥
          {" "}
          {(panel.charity.totalContributionFen / 100).toFixed(2)}
        </Text>
        <Text className="mt-1 block text-[20rpx] text-[#937761]">
          累计助 KDRHEA 捐至
          {" "}
          {panel.charity.currentOrg?.name_cn || "公益机构"}
        </Text>
      </View>

      {/* 透明度链接 */}
      <Text className="mt-3 block text-center text-[20rpx] text-[#864D39] tracking-wider">
        → 查看 KDRHEA 月度公益透明度报告
      </Text>

      {/* 分享按钮 */}
      <Button
        onClick={handleShare}
        className="mt-3 py-3 tracking-widest"
        style={{ background: "#3C2218", color: "#FBF7F1" }}
      >
        📤 生成我的爱心海报
      </Button>
    </View>
  );
}
