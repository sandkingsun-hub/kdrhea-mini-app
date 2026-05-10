// 给 4 个 tab 页用：useDidShow 时主动告诉 tabBar 当前 selected
// 解决「自定义 tabBar 在各 tab 页是独立实例·切换时旧实例不会自动更新」
import Taro from "@tarojs/taro";

interface TabBarLike {
  setSelected?: (idx: number) => void;
}

export function syncTabBarSelected(idx: number) {
  const page = Taro.getCurrentInstance().page;
  if (!page) {
    return;
  }
  const tabBar = Taro.getTabBar<TabBarLike>(page);
  tabBar?.setSelected?.(idx);
}
