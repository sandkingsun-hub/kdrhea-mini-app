// KDRHEA 自定义 tabBar · 4 tab · 纯文字 letter-spacing 风
import { CoverView } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useRef, useState } from "react";

const TABS = [
  { pagePath: "/pages/index/index", text: "首页", code: "HOME" },
  { pagePath: "/pages/care/index", text: "诊疗", code: "CARE" },
  { pagePath: "/pages/gifts/index", text: "礼遇", code: "GIFTS" },
  { pagePath: "/pages/profile/index", text: "我的", code: "ME" },
];

function getCurrentTabIdx(): number {
  try {
    const pages = Taro.getCurrentPages();
    const cur = pages.at(-1);
    if (!cur) {
      return 0;
    }
    const route = `/${cur.route}`;
    const idx = TABS.findIndex(t => t.pagePath === route);
    return idx >= 0 ? idx : 0;
  } catch {
    return 0;
  }
}

export default function CustomTabBar() {
  const [selected, setSelected] = useState(getCurrentTabIdx);
  // 用户最近一次点击意图·-1 表示无意图（如外部 navigateBack 切回）
  const intentRef = useRef<number>(-1);

  useDidShow(() => {
    const idx = getCurrentTabIdx();
    if (intentRef.current === -1) {
      // 无点击意图（外部触发的切换 · 比如 navigateBack 回 tab）
      setSelected(idx);
      return;
    }
    if (idx === intentRef.current) {
      // 路由跟上意图了·清意图
      setSelected(idx);
      intentRef.current = -1;
    }
    // 否则路由还在同步中·保留 selected · 等下一次 useDidShow
  });

  const handle = (i: number) => {
    if (i === selected) {
      return;
    }
    intentRef.current = i;
    setSelected(i); // 立即变色
    Taro.switchTab({ url: TABS[i].pagePath });
  };

  return (
    <CoverView
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "112rpx",
        background: "#FBF7F1",
        borderTop: "1px solid #E8DFD4",
        display: "flex",
        zIndex: 1000,
      }}
    >
      {TABS.map((t, i) => (
        <CoverView
          key={t.code}
          onClick={() => handle(i)}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            paddingTop: "20rpx",
            paddingBottom: "20rpx",
          }}
        >
          {/* 英文 letter-spacing 末端余量·用 paddingLeft 抵消保证视觉居中 */}
          <CoverView
            style={{
              fontSize: "20rpx",
              letterSpacing: "0.28em",
              paddingLeft: "0.28em",
              color: selected === i ? "#3C2218" : "#A98D78",
              fontWeight: selected === i ? 500 : 300,
              textAlign: "center",
            }}
          >
            {t.code.split("").join(" ")}
          </CoverView>
          <CoverView
            style={{
              fontSize: "20rpx",
              marginTop: "6rpx",
              letterSpacing: "0.12em",
              paddingLeft: "0.12em",
              color: selected === i ? "#3C2218" : "#937761",
              textAlign: "center",
            }}
          >
            {t.text}
          </CoverView>
        </CoverView>
      ))}
    </CoverView>
  );
}
