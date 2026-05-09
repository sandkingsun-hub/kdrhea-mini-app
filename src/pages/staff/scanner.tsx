// 员工扫码工具 · 仅 user.role in [staff, admin] 可访问
// 扫客户码 → 选操作（消费返利 / 积分抵扣 / 到店打卡）→ 提交
import type { ReactNode } from "react";
import { Input, Text, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useState } from "react";
import PageWrapper from "~/components/PageWrapper";

// === StepCard · 步骤卡片 · 编号 + 标题 + 副标题 + 内容 ===
function StepCard({
  number,
  title,
  subtitle,
  done,
  active,
  children,
}: {
  number: string;
  title: string;
  subtitle?: string;
  done: boolean;
  active: boolean;
  children: ReactNode;
}) {
  const opacity = !active && !done ? 0.45 : 1;
  return (
    <View
      className="mt-3 p-4"
      style={{
        background: active ? "#FAF7F3" : "#FBF7F1",
        border: `1px solid ${active ? "#DCC9B6" : "#E8DFD4"}`,
        opacity,
      }}
    >
      <View className="flex items-baseline">
        <Text
          style={{
            fontFamily: "var(--kd-font-display)",
            fontSize: "18px",
            color: done ? "#864D39" : "#3C2218",
            fontWeight: 400,
            letterSpacing: "0.04em",
          }}
        >
          {number}
        </Text>
        <Text
          className="ml-2"
          style={{
            fontSize: "13px",
            color: "#3C2218",
            fontWeight: 500,
            letterSpacing: "0.04em",
          }}
        >
          {title}
        </Text>
        {done && (
          <Text className="ml-auto" style={{ fontSize: "12px", color: "#864D39" }}>
            ✓
          </Text>
        )}
      </View>
      {subtitle && (
        <Text
          className="mt-1 block"
          style={{
            fontSize: "11px",
            color: "#937761",
            lineHeight: "1.6",
            letterSpacing: "0.02em",
          }}
        >
          {subtitle}
        </Text>
      )}
      <View className="mt-3">{children}</View>
    </View>
  );
}

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
      <View className="min-h-screen bg-kd-paper px-5 pb-32 pt-5">
        {/* 顶部 · 标题 + 副标题 */}
        <View className="pb-4 text-center">
          <Text style={{ fontSize: "11px", letterSpacing: "0.32em", color: "#3C2218", fontWeight: 500 }}>
            S  T  A  F  F    T  O  O  L
          </Text>
          <Text className="mt-1 block text-center" style={{ fontSize: "10px", letterSpacing: "0.12em", color: "#937761" }}>
            扫码 · 选操作 · 提交
          </Text>
        </View>

        {/* === STEP 01 · 扫码 === */}
        <StepCard
          number="01"
          title="扫客户码"
          subtitle="让客户在小程序展示二维码后扫描"
          done={!!customerOpenid}
          active={!customerOpenid}
        >
          <View className="flex items-center justify-between">
            <Text
              style={{
                fontSize: "12px",
                color: customerOpenid ? "#3C2218" : "#A98D78",
                fontFamily: "monospace",
                flex: 1,
              }}
            >
              {customerOpenid ? `${customerOpenid.slice(0, 18)}…` : "未扫码"}
            </Text>
            <View
              onClick={handleScan}
              className="ml-3 px-4"
              style={{
                background: "#3C2218",
                color: "#FBF7F1",
                fontSize: "12px",
                letterSpacing: "0.16em",
                height: "32px",
                lineHeight: "32px",
                textAlign: "center",
              }}
            >
              {customerOpenid ? "重扫" : "扫码"}
            </View>
          </View>
        </StepCard>

        {/* === STEP 02 · 选操作 === */}
        <StepCard
          number="02"
          title="选择操作"
          subtitle={action.desc}
          done={!!customerOpenid}
          active={!!customerOpenid}
        >
          <View className="flex flex-wrap">
            {ACTIONS.map((a, i) => (
              <View
                key={a.code}
                onClick={() => {
                  setActiveAction(i);
                  setInputValue("");
                }}
                className="mb-2 mr-2 px-3"
                style={{
                  background: activeAction === i ? "#3C2218" : "transparent",
                  color: activeAction === i ? "#FBF7F1" : "#5E3425",
                  border: activeAction === i ? "1px solid #3C2218" : "1px solid #DCC9B6",
                  fontSize: "12px",
                  letterSpacing: "0.06em",
                  height: "30px",
                  lineHeight: "28px",
                  textAlign: "center",
                }}
              >
                {a.label}
              </View>
            ))}
          </View>
        </StepCard>

        {/* === STEP 03 · 输入（仅 amount/points 显示） === */}
        {action.inputType !== "fixed" && (
          <StepCard
            number="03"
            title={action.inputType === "amount" ? "输入金额" : "输入积分数"}
            subtitle={
              action.inputType === "amount"
                ? "客户支付的现金（元）· 系统自动按 2% 折算返利"
                : "用客户积分顶现金 · 1 积分 = ¥0.01"
            }
            done={inputValue.length > 0}
            active={!!customerOpenid}
          >
            <Input
              type="digit"
              value={inputValue}
              onInput={e => setInputValue(e.detail.value)}
              onConfirm={handleSubmit}
              placeholder={action.placeholder}
              confirmType="done"
              cursorSpacing={180}
              adjustPosition
              style={{
                borderBottom: "1px solid #DCC9B6",
                height: "44px",
                lineHeight: "44px",
                paddingLeft: "0",
                paddingRight: "0",
                fontSize: "16px",
                color: "#3C2218",
              }}
              placeholderStyle="color:#C4AD98;font-size:14px"
            />
            <Text className="mt-2 block" style={{ fontSize: "10px", color: "#A98D78" }}>
              键盘按"完成"键可直接提交
            </Text>
          </StepCard>
        )}

        {/* 结果反馈 */}
        {lastResult && (
          <View
            className="mt-4 p-3"
            style={{ background: lastResult.startsWith("✅") ? "#F5EDE3" : "#FAF0EF", border: "1px solid #E8DFD4" }}
          >
            <Text style={{ fontSize: "12px", color: "#3C2218", lineHeight: "1.6" }}>{lastResult}</Text>
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
