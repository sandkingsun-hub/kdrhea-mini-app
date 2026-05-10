// 页面路由名称枚举
export enum RouteNames {
  HOME = "HOME",
  CARE = "CARE", // 诊疗 · 现金 SKU
  GIFTS = "GIFTS", // 礼遇 · 纯积分 SKU
  PROFILE = "PROFILE",
  SKU_DETAIL = "SKU_DETAIL",
  CHECKOUT = "CHECKOUT",
  QRCODE = "QRCODE",
  APPOINTMENT_NEW = "APPOINTMENT_NEW",
  APPOINTMENT_LIST = "APPOINTMENT_LIST",
  STAFF_SCANNER = "STAFF_SCANNER",
  STAFF_APPOINTMENTS = "STAFF_APPOINTMENTS",
  ACCOUNT_EDIT = "ACCOUNT_EDIT",
  ACCOUNT_RECORDS = "ACCOUNT_RECORDS",
  PRIVACY_POLICY = "PRIVACY_POLICY",
  USER_AGREEMENT = "USER_AGREEMENT",
  DEVTOOLS = "DEVTOOLS",
}

// 页面路径常量
export const PAGES = {
  [RouteNames.HOME]: "/pages/index/index",
  [RouteNames.CARE]: "/pages/care/index",
  [RouteNames.GIFTS]: "/pages/gifts/index",
  [RouteNames.PROFILE]: "/pages/profile/index",
  [RouteNames.SKU_DETAIL]: "/pages/sku-detail/index",
  [RouteNames.CHECKOUT]: "/pages/checkout/index",
  [RouteNames.QRCODE]: "/pages/qrcode/index",
  [RouteNames.APPOINTMENT_NEW]: "/pages/appointment/new",
  [RouteNames.APPOINTMENT_LIST]: "/pages/appointment/list",
  [RouteNames.STAFF_SCANNER]: "/pages/staff/scanner",
  [RouteNames.STAFF_APPOINTMENTS]: "/pages/staff/appointments",
  [RouteNames.ACCOUNT_EDIT]: "/pages/account/edit",
  [RouteNames.ACCOUNT_RECORDS]: "/pages/account/records",
  [RouteNames.PRIVACY_POLICY]: "/pages/agreements/privacy-policy",
  [RouteNames.USER_AGREEMENT]: "/pages/agreements/user-agreement",
  [RouteNames.DEVTOOLS]: "/pages/devtools/index",
} as const;

/**
 * 适配路径，移除开头的斜杠
 * @param path 原始路径
 * @returns 适配后的路径
 */
export function adaptPath(path: string): string {
  return path.replace(/^\//, "");
}

// 适配taro后的页面路径
export const ADAPTED_PAGES = Object.entries(PAGES).reduce(
  (acc, [key, path]) => ({
    ...acc,
    [key]: adaptPath(path),
  }),
  {} as { [K in RouteNames]: string },
);
