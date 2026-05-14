// KDRHEA 隐私保护指引弹窗 · 微信 2.32.3+ 合规版
// 关键合规点：
//   1. 同意按钮必须用原生 <Button open-type="agreePrivacyAuthorization">
//   2. 通过 bindagreeprivacyauthorization 事件接收微信回执
//   3. 普通 onClick 不被认定为"用户已同意" · 后续涉及隐私的 API（如 wx.scanCode）拿不到许可
import { Button, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useCallback } from "react";
import { cache } from "~/cache";
import { RouteNames } from "~/constants/routes";
import { navigateTo } from "~/utils/route";

interface PrivacyPolicyPopupProps {
  open: boolean;
  onClose: () => void;
}

export default function PrivacyPolicyPopup({ open, onClose }: PrivacyPolicyPopupProps) {
  const handleAgree = useCallback(() => {
    cache.setSync("privacyAgreed", true);
    onClose();
  }, [onClose]);

  const handleDisagree = useCallback(() => {
    Taro.exitMiniProgram({ success: () => {}, fail: () => {} });
  }, []);

  const handleViewAgreement = useCallback((type: "privacy" | "user") => {
    navigateTo(type === "privacy" ? RouteNames.PRIVACY_POLICY : RouteNames.USER_AGREEMENT);
  }, []);

  if (!open) {
    return null;
  }

  return (
    <View
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        zIndex: 9999,
      }}
    >
      <View
        style={{
          background: "#FFFFFF",
          borderTopLeftRadius: "16px",
          borderTopRightRadius: "16px",
          padding: "24px 20px 32px",
          maxHeight: "80vh",
          overflow: "auto",
        }}
      >
        <Text
          style={{
            display: "block",
            fontSize: "16px",
            fontWeight: 600,
            color: "#3D2418",
            textAlign: "center",
            marginBottom: "16px",
          }}
        >
          KDRHEA 隐私保护指引
        </Text>

        <View style={{ fontSize: "12px", color: "#5A4A3A", lineHeight: 1.7 }}>
          <Text style={{ display: "block", marginBottom: "10px" }}>
            点击「同意并继续」表示你已阅读并理解
            <Text
              style={{ color: "#864D39", textDecoration: "underline" }}
              onClick={() => handleViewAgreement("user")}
            >
              《用户协议》
            </Text>
            和
            <Text
              style={{ color: "#864D39", textDecoration: "underline" }}
              onClick={() => handleViewAgreement("privacy")}
            >
              《隐私政策》
            </Text>
            · 同意我们开启基本业务功能（账户、积分、预约、扫码等）。
          </Text>
          <Text style={{ display: "block", marginBottom: "10px" }}>
            涉及摄像头、相册、位置等敏感权限时 · 我们会单独征得你的同意。你可以随时撤回授权 · 也可以查询、更正、删除你的个人信息或注销账号。
          </Text>
          <Text style={{ display: "block", marginBottom: "20px" }}>
            若点击「不同意并退出」· 你将无法使用 KDRHEA 小程序 · 程序会自动退出。
          </Text>
        </View>

        {/* 关键：原生 Button + open-type="agreePrivacyAuthorization" · 微信认定为「用户已同意」事件 */}
        <Button
          openType="agreePrivacyAuthorization"
          onAgreePrivacyAuthorization={handleAgree}
          style={{
            background: "#3D2418",
            color: "#FBF7F1",
            border: "none",
            borderRadius: "999px",
            height: "44px",
            lineHeight: "44px",
            fontSize: "14px",
            fontWeight: 600,
            marginBottom: "10px",
            padding: 0,
          }}
        >
          同意并继续
        </Button>

        <Button
          onClick={handleDisagree}
          style={{
            background: "#FBF7F1",
            color: "#5A4A3A",
            border: "1px solid #D9CCBC",
            borderRadius: "999px",
            height: "44px",
            lineHeight: "44px",
            fontSize: "14px",
            padding: 0,
          }}
        >
          不同意并退出
        </Button>
      </View>
    </View>
  );
}
