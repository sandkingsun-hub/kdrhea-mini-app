// KDRHEA 自定义 tabBar · 纯文字 letter-spacing 风
import { CoverView } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useState } from "react";

const TABS = [
  { pagePath: "/pages/index/index", text: "首页", code: "HOME" },
  { pagePath: "/pages/mall/index", text: "商城", code: "CARE" },
  { pagePath: "/pages/profile/index", text: "我的", code: "ME" },
];

export default function CustomTabBar() {
  const [selected, setSelected] = useState(0);

  useDidShow(() => {
    const pages = Taro.getCurrentPages();
    const cur = pages.at(-1);
    if (!cur) {
      return;
    }
    const route = `/${cur.route}`;
    const idx = TABS.findIndex(t => t.pagePath === route);
    if (idx >= 0) {
      setSelected(idx);
    }
  });

  const handle = (i: number) => {
    setSelected(i);
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
          <CoverView
            style={{
              fontSize: "22rpx",
              letterSpacing: "0.32em",
              color: selected === i ? "#3C2218" : "#A98D78",
              fontWeight: selected === i ? 500 : 300,
            }}
          >
            {t.code.split("").join(" ")}
          </CoverView>
          <CoverView
            style={{
              fontSize: "20rpx",
              marginTop: "6rpx",
              letterSpacing: "0.12em",
              color: selected === i ? "#3C2218" : "#937761",
            }}
          >
            {t.text}
          </CoverView>
        </CoverView>
      ))}
    </CoverView>
  );
}
