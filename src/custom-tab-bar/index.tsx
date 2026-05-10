// KDRHEA 自定义 tabBar · 4 tab · 纯文字 letter-spacing 风
//
// 双向同步模型（参考 Taro 官方 custom-tabbar-react demo）：
// - 点击：tabBar 内 setState 立即变色 + Taro.switchTab
// - 切页后：目标 tab 页 useDidShow 调 syncTabBarSelected(idx) 兜底
// - 用 class 组件而非函数组件·因为 Taro.getTabBar(page) 返回的是组件实例·
//   class 实例上才能挂 setSelected 方法被 page 端调用
import { CoverView } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Component } from "react";

const TABS = [
  { pagePath: "/pages/index/index", text: "首页", code: "HOME" },
  { pagePath: "/pages/care/index", text: "诊疗", code: "CARE" },
  { pagePath: "/pages/gifts/index", text: "礼遇", code: "GIFTS" },
  { pagePath: "/pages/profile/index", text: "我的", code: "ME" },
] as const;

interface State { selected: number }

export default class CustomTabBar extends Component<unknown, State> {
  state: State = { selected: 0 };

  // 点击锁·防快速连点重复 switchTab
  switching = false;

  // 给 page 端 Taro.getTabBar(page).setSelected(idx) 调用
  setSelected = (idx: number) => {
    const clamped = Math.max(0, Math.min(TABS.length - 1, idx));
    if (this.state.selected !== clamped) {
      this.setState({ selected: clamped });
    }
  };

  handleTabClick = (idx: number) => {
    if (idx === this.state.selected || this.switching) {
      return;
    }
    // 1) 即时变色
    this.setState({ selected: idx });
    this.switching = true;

    // 2) 路由切换·complete 后释放锁·最终值由目标页 useDidShow 兜底收敛
    Taro.switchTab({
      url: TABS[idx].pagePath,
      complete: () => {
        this.switching = false;
      },
    });
  };

  render() {
    const { selected } = this.state;

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
        {TABS.map((t, i) => {
          const active = selected === i;
          return (
            <CoverView
              key={t.code}
              onClick={() => this.handleTabClick(i)}
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
                  color: active ? "#3C2218" : "#A98D78",
                  fontWeight: active ? 500 : 300,
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
                  color: active ? "#3C2218" : "#937761",
                  textAlign: "center",
                }}
              >
                {t.text}
              </CoverView>
            </CoverView>
          );
        })}
      </CoverView>
    );
  }
}
