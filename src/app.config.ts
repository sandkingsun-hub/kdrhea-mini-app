import { ADAPTED_PAGES, RouteNames } from "~/constants/routes";

export default defineAppConfig({
  pages: [
    ADAPTED_PAGES[RouteNames.HOME],
    ADAPTED_PAGES[RouteNames.PROFILE],
    ADAPTED_PAGES[RouteNames.PRIVACY_POLICY],
    ADAPTED_PAGES[RouteNames.USER_AGREEMENT],
    ADAPTED_PAGES[RouteNames.DEVTOOLS],
  ],
  window: {
    // KDRHEA 自定义导航栏 · 米白底 + 棕色文字
    navigationStyle: "custom",
    backgroundTextStyle: "light",
    backgroundColor: "#FBF7F1",
    navigationBarBackgroundColor: "#FBF7F1",
    navigationBarTitleText: "KDRHEA",
    navigationBarTextStyle: "black",
  },
  tabBar: {
    custom: true,
    list: [
      {
        pagePath: ADAPTED_PAGES[RouteNames.HOME],
        text: "首页",
      },
      {
        pagePath: ADAPTED_PAGES[RouteNames.PROFILE],
        text: "我的",
      },
    ],
  },
});
