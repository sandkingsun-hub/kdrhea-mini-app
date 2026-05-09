// 员工扫码工具 · 仅 user.role in [staff, admin] 可访问
// 扫客户码 → 选操作（消费返利 / 积分抵扣 / 到店打卡）→ 提交
import { Input, Text, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useState } from "react";
import PageWrapper from "~/components/PageWrapper";

const ACTIONS = [
  {
    code: "log_offline_consume",
    label: "线下消费返利",
    desc: "客户支付后录入金额·按 2% 返积分",
    inputType: "amount" as const,
    placeholder: "消费金额（元）",
  },
  {
    code: "spend_for_consume",
    label: "积分抵扣消费",
    desc: "用客户积分顶现金（1 积分 = ¥0.01）",
    inputType: "points" as const,
    placeholder: "抵扣积分数",
  },
  {
    code: "reward_in_store_qr",
    label: "到店打卡",
    desc: "客户进店扫码 +500 积分",
    inputType: "fixed" as const,
    placeholder: "",
  },
];

export default function StaffScanner() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [customerOpenid, setCustomerOpenid] = useState("");
  const [activeAction, setActiveAction] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<string>("");

  const callCloud = async (name: string, data?: any): Promise<any> => {
    try {
      // @ts-expect-error wx 由微信运行时注入
      if (typeof wx === "undefined" || !wx.cloud) {
        return null;
      }
      // @ts-expect-error wx.cloud.callFunction 由微信注入
      const r = await wx.cloud.callFunction({ name, data });
      return r.result;
    } catch {
      return null;
    }
  };

  useLoad(async () => {
    const lg = await callCloud("login");
    const role = lg?.user?.role || "customer";
    if (role === "staff" || role === "admin") {
      setAuthorized(true);
    } else {
      setAuthorized(false);
    }
  });

  // 调微信扫码
  const handleScan = async () => {
    try {
      const r = await Taro.scanCode({ scanType: ["qrCode"] });
      // 这里假设客户码 result 直接是 openid（MVP）
      setCustomerOpenid(r.result || "");
      setLastResult("");
    } catch {
      Taro.showToast({ title: "扫码取消", icon: "none" });
    }
  };

  const handleSubmit = async () => {
    if (!customerOpenid) {
      Taro.showToast({ title: "请先扫码", icon: "none" });
      return;
    }
    const action = ACTIONS[activeAction];
    setSubmitting(true);

    const data: any = { customerOpenid, action: action.code };
    if (action.inputType === "amount") {
      const yuan = Number.parseFloat(inputValue);
      if (!yuan || yuan <= 0) {
        Taro.showToast({ title: "金额必填", icon: "none" });
        setSubmitting(false);
        return;
      }
      data.amountFen = Math.round(yuan * 100);
    } else if (action.inputType === "points") {
      const pts = Number.parseInt(inputValue);
      if (!pts || pts <= 0) {
        Taro.showToast({ title: "积分数必填", icon: "none" });
        setSubmitting(false);
        return;
      }
      data.points = pts;
    } else {
      data.points = 500;
    }

    const r = await callCloud("staffScanCustomer", data);
    setSubmitting(false);
    if (r?.ok) {
      const info = r.pointsEarned
        ? `+${r.pointsEarned} 积分`
        : r.pointsSpent
          ? `-${r.pointsSpent} 积分`
          : "";
      setLastResult(`✅ ${action.label} 成功 ${info}·客户余额 ${r.balanceAfter || "?"}`);
      Taro.showToast({ title: "完成", icon: "success" });
      setInputValue("");
    } else {
      setLastResult(`❌ 失败：${r?.code || "unknown"}`);
      Taro.showToast({ title: r?.code || "失败", icon: "none" });
    }
  };

  if (authorized === null) {
    return (
      <PageWrapper navTitle="员工工具" className="h-full bg-kd-paper" shouldShowBottomActions={false} shouldShowNavigationMenu={false}>
        <View className="h-screen flex-center">
          <Text style={{ fontSize: "12px", color: "#937761" }}>校验中…</Text>
        </View>
      </PageWrapper>
    );
  }

  if (!authorized) {
    return (
      <PageWrapper navTitle="员工工具" className="h-full bg-kd-paper" shouldShowBottomActions={false} shouldShowNavigationMenu={false}>
        <View className="flex flex-col items-center px-6 pt-20">
          <Text style={{ fontSize: "13px", color: "#3C2218" }}>权限不足</Text>
          <Text className="mt-2 block" style={{ fontSize: "11px", color: "#937761" }}>
            该页仅限员工/管理员访问
          </Text>
        </View>
      </PageWrapper>
    );
  }

  const action = ACTIONS[activeAction];

  return (
    <PageWrapper navTitle="员工工具" className="h-full bg-kd-paper" shouldShowBottomActions={false} shouldShowNavigationMenu={false}>
      <View className="min-h-screen bg-kd-paper px-6 pb-32 pt-6">
        {/* 顶部 */}
        <Text style={{ fontSize: "11px", letterSpacing: "0.32em", color: "#937761" }}>
          S  T  A  F  F    T  O  O  L
        </Text>

        {/* 扫码 + openid 显示 */}
        <View className="mt-6">
          <Text style={{ fontSize: "11px", letterSpacing: "0.16em", color: "#864D39", fontWeight: 500 }}>
            STEP 1  ·  扫客户码
          </Text>
          <View className="mt-2 flex items-center justify-between">
            <Text
              style={{
                fontSize: "11px",
                color: customerOpenid ? "#3C2218" : "#A98D78",
                fontFamily: "monospace",
                flex: 1,
              }}
            >
              {customerOpenid ? `${customerOpenid.slice(0, 24)}...` : "未扫码"}
            </Text>
            <View
              onClick={handleScan}
              className="ml-3 px-4 py-2"
              style={{
                background: "#3C2218",
                color: "#FBF7F1",
                fontSize: "12px",
                letterSpacing: "0.16em",
              }}
            >
              扫码
            </View>
          </View>
        </View>

        {/* 操作选择 · 紧凑横排 chip */}
        <View className="mt-6">
          <Text style={{ fontSize: "11px", letterSpacing: "0.16em", color: "#864D39", fontWeight: 500 }}>
            STEP 2  ·  选择操作
          </Text>
          <View className="mt-2 flex flex-wrap">
            {ACTIONS.map((a, i) => (
              <View
                key={a.code}
                onClick={() => {
                  setActiveAction(i);
                  setInputValue("");
                }}
                className="mb-2 mr-2 px-3 py-2"
                style={{
                  background: activeAction === i ? "#3C2218" : "transparent",
                  color: activeAction === i ? "#FBF7F1" : "#5E3425",
                  border: activeAction === i ? "1px solid #3C2218" : "1px solid #DCC9B6",
                  fontSize: "12px",
                  letterSpacing: "0.06em",
                }}
              >
                {a.label}
              </View>
            ))}
          </View>
          <Text className="mt-2 block" style={{ fontSize: "11px", color: "#A98D78", lineHeight: "1.5" }}>
            {action.desc}
          </Text>
        </View>

        {/* 输入金额/积分 · 加 cursorSpacing 防键盘挡 */}
        {action.inputType !== "fixed" && (
          <View className="mt-6">
            <Text style={{ fontSize: "11px", letterSpacing: "0.16em", color: "#864D39", fontWeight: 500 }}>
              STEP 3  ·
              {" "}
              {action.placeholder}
            </Text>
            <Input
              type="digit"
              value={inputValue}
              onInput={e => setInputValue(e.detail.value)}
              onConfirm={handleSubmit}
              placeholder={action.placeholder}
              confirmType="done"
              cursorSpacing={180}
              adjustPosition
              className="mt-2"
              style={{
                borderBottom: "1px solid #DCC9B6",
                padding: "10px 0",
                fontSize: "22px",
                color: "#3C2218",
                fontFamily: "var(--kd-font-display)",
              }}
            />
            <Text className="mt-2 block" style={{ fontSize: "10px", color: "#A98D78" }}>
              提示：键盘按"完成"也可直接提交
            </Text>
          </View>
        )}

        {/* 结果 */}
        {lastResult && (
          <View className="mt-4 p-3" style={{ background: "#F5EDE3" }}>
            <Text style={{ fontSize: "12px", color: "#3C2218" }}>{lastResult}</Text>
          </View>
        )}
      </View>

      {/* 提交按钮 · 浮动底部条 · 不被键盘挡 */}
      <View
        onClick={handleSubmit}
        className="py-4 text-center"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: submitting ? "#A98D78" : "#3C2218",
          color: "#FBF7F1",
          fontSize: "14px",
          letterSpacing: "0.24em",
          zIndex: 50,
        }}
      >
        {submitting ? "处理中…" : "确认执行"}
      </View>
    </PageWrapper>
  );
}
