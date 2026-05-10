import { ADAPTED_PAGES, RouteNames } from "~/constants/routes";

export default defineAppConfig({
  pages: [
    ADAPTED_PAGES[RouteNames.HOME],
    ADAPTED_PAGES[RouteNames.CARE],
    ADAPTED_PAGES[RouteNames.GIFTS],
    ADAPTED_PAGES[RouteNames.PROFILE],
    ADAPTED_PAGES[RouteNames.SKU_DETAIL],
    ADAPTED_PAGES[RouteNames.CHECKOUT],
    ADAPTED_PAGES[RouteNames.QRCODE],
    ADAPTED_PAGES[RouteNames.APPOINTMENT_NEW],
    ADAPTED_PAGES[RouteNames.APPOINTMENT_LIST],
    ADAPTED_PAGES[RouteNames.STAFF_SCANNER],
    ADAPTED_PAGES[RouteNames.STAFF_APPOINTMENTS],
    ADAPTED_PAGES[RouteNames.STAFF_GRANT_COUPON],
    ADAPTED_PAGES[RouteNames.ACCOUNT_EDIT],
    ADAPTED_PAGES[RouteNames.ACCOUNT_RECORDS],
    ADAPTED_PAGES[RouteNames.COUPONS_LIST],
    ADAPTED_PAGES[RouteNames.COUPON_DETAIL],
    ADAPTED_PAGES[RouteNames.PRIVACY_POLICY],
    ADAPTED_PAGES[RouteNames.USER_AGREEMENT],
    ADAPTED_PAGES[RouteNames.DEVTOOLS],
  ],
  window: {
    navigationStyle: "custom",
    backgroundTextStyle: "light",
    backgroundColor: "#FBF7F1",
    navigationBarBackgroundColor: "#FBF7F1",
    navigationBarTitleText: "KDRHEA",
    navigationBarTextStyle: "black",
  },
  // KDRHEA 自定义 tabBar · 用 custom 实现纯文字 letter-spacing 风格
  tabBar: {
    custom: true,
    color: "#937761",
    selectedColor: "#3C2218",
    backgroundColor: "#FBF7F1",
    borderStyle: "white",
    list: [
      {
        pagePath: ADAPTED_PAGES[RouteNames.HOME],
        text: "首页",
      },
      {
        pagePath: ADAPTED_PAGES[RouteNames.CARE],
        text: "诊疗",
      },
      {
        pagePath: ADAPTED_PAGES[RouteNames.GIFTS],
        text: "礼遇",
      },
      {
        pagePath: ADAPTED_PAGES[RouteNames.PROFILE],
        text: "我的",
      },
    ],
  },
});
