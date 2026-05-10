// 员工 · 发券给客户
// 流程：扫客户 QR → 选模板（云端拉）/ 自定义 → 提交 grantCoupon
import { Input, Picker, Text, Textarea, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useState } from "react";
import PageWrapper from "~/components/PageWrapper";

interface Template {
  _id: string;
  templateNo: string;
  name: string;
  type: "experience" | "discount" | "cash" | "physical_gift" | "custom";
  value: string;
  description: string;
  defaultValidDays: number;
}

const TYPE_OPTIONS = [
  { key: "experience", label: "体验券" },
  { key: "discount", label: "折扣券" },
  { key: "cash", label: "抵用券" },
  { key: "physical_gift", label: "实物礼品" },
  { key: "custom", label: "礼券" },
];

// 自定义虚拟模板·让员工灵活发非标准券
const CUSTOM_TEMPLATE: Template = {
  _id: "__custom__",
  templateNo: "—",
  name: "",
  type: "custom",
  value: "",
  description: "",
  defaultValidDays: 180,
};

const inputStyle = {
  background: "#FBF7F1",
  border: "1px solid #DCC9B6",
  borderRadius: "10px",
  paddingLeft: "12px",
  paddingRight: "12px",
  height: "44px",
  lineHeight: "44px",
  fontSize: "14px",
  color: "#3C2218",
  marginTop: "8px",
} as const;

export default function StaffGrantCoupon() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [customerOpenid, setCustomerOpenid] = useState("");
  const [templates, setTemplates] = useState<Template[]>([CUSTOM_TEMPLATE]);
  const [templateIdx, setTemplateIdx] = useState(-1);
  const [name, setName] = useState("");
  const [typeIdx, setTypeIdx] = useState(0);
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [validDays, setValidDays] = useState("180");
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState("");

  const callCloud = async (n: string, d?: any): Promise<any> => {
    try {
      // @ts-expect-error wx 由微信运行时注入
      if (typeof wx === "undefined" || !wx.cloud) {
        return null;
      }
      // @ts-expect-error wx.cloud.callFunction 由微信注入
      const r = await wx.cloud.callFunction({ name: n, data: d });
      return r.result;
    } catch {
      return null;
    }
  };

  useLoad(async () => {
    const lg = await callCloud("login");
    const role = lg?.user?.role || "customer";
    if (role !== "staff" && role !== "admin") {
      setAuthorized(false);
      return;
    }
    setAuthorized(true);

    // 拉云端模板（管理员在 admin.kdrhea.com 配置的）
    const r = await callCloud("listCouponTemplates");
    if (r?.ok && r.items) {
      setTemplates([...r.items, CUSTOM_TEMPLATE]);
    }
  });

  const handleScan = async () => {
    try {
      const r = await Taro.scanCode({ scanType: ["qrCode"] });
      const result = r.result || "";
      if (result.startsWith("{") && result.includes("\"t\":\"coupon\"")) {
        Taro.showToast({ title: "这是券码·不是客户码", icon: "none" });
        return;
      }
      setCustomerOpenid(result);
      setLastResult("");
    } catch {
      Taro.showToast({ title: "扫码取消", icon: "none" });
    }
  };

  const pickTemplate = (i: number) => {
    setTemplateIdx(i);
    const t = templates[i];
    setName(t.name);
    setValue(t.value);
    setDescription(t.description);
    setTypeIdx(TYPE_OPTIONS.findIndex(o => o.key === t.type));
    setValidDays(String(t.defaultValidDays));
  };

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }
    if (!customerOpenid) {
      Taro.showToast({ title: "请先扫客户码", icon: "none" });
      return;
    }
    if (templateIdx < 0) {
      Taro.showToast({ title: "请选模板", icon: "none" });
      return;
    }
    if (!name || name.length < 2) {
      Taro.showToast({ title: "请填券名称", icon: "none" });
      return;
    }
    const days = Number.parseInt(validDays);
    if (!days || days <= 0 || days > 730) {
      Taro.showToast({ title: "有效天数 1-730", icon: "none" });
      return;
    }

    setSubmitting(true);
    const r = await callCloud("grantCoupon", {
      targetOpenid: customerOpenid,
      couponName: name,
      couponType: TYPE_OPTIONS[typeIdx].key,
      value,
      description,
      validDays: days,
      source: "staff_grant",
    });
    setSubmitting(false);

    if (r?.ok) {
      setLastResult(`✅ 已发送 · ${r.couponNo}`);
      Taro.showToast({ title: "已发送", icon: "success" });
      setCustomerOpenid("");
      setTemplateIdx(-1);
    } else {
      const map: Record<string, string> = {
        PERMISSION_DENIED: "权限不足",
        MISSING_TARGET: "客户未识别",
        MISSING_NAME: "券名未填",
        INVALID_TYPE: "类型不对",
        COUPON_NO_GEN_FAIL: "券号生成失败",
      };
      const msg = map[r?.code] || `失败 ${r?.code || ""}`;
      setLastResult(`❌ ${msg}`);
      Taro.showToast({ title: msg, icon: "none" });
    }
  };

  if (authorized === null) {
    return (
      <PageWrapper navTitle="发券" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
        <View className="h-screen flex-center">
          <Text style={{ fontSize: "12px", color: "#937761" }}>校验中…</Text>
        </View>
      </PageWrapper>
    );
  }

  if (!authorized) {
    return (
      <PageWrapper navTitle="发券" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
        <View className="flex flex-col items-center px-6 pt-20">
          <Text style={{ fontSize: "13px", color: "#3C2218" }}>权限不足</Text>
          <Text className="mt-2 block" style={{ fontSize: "11px", color: "#937761" }}>该页仅限员工/管理员访问</Text>
        </View>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper navTitle="发券" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
      <View className="min-h-screen bg-kd-paper px-5 pb-32 pt-3">
        <View className="text-center" style={{ paddingTop: "8px" }}>
          <Text style={{ fontSize: "11px", letterSpacing: "0.32em", color: "#3C2218", fontWeight: 500 }}>
            G  R  A  N  T    C  O  U  P  O  N
          </Text>
          <Text className="mt-2 block" style={{ fontSize: "10px", letterSpacing: "0.06em", color: "#937761" }}>
            扫客户码 · 选模板 · 发出
          </Text>
        </View>

        {/* === STEP 01 · 扫客户 === */}
        <SectionCard number="01" title="选客户" done={!!customerOpenid}>
          <View className="flex items-center justify-between">
            <Text style={{ fontSize: "12px", color: customerOpenid ? "#3C2218" : "#A98D78", fontFamily: "monospace", flex: 1 }}>
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
                borderRadius: "999px",
              }}
            >
              {customerOpenid ? "重扫" : "扫码"}
            </View>
          </View>
        </SectionCard>

        {/* === STEP 02 · 选模板 === */}
        <SectionCard
          number="02"
          title="选券模板"
          done={templateIdx >= 0 && !!name}
        >
          <View className="flex flex-wrap" style={{ gap: "8px" }}>
            {templates.length === 1 && (
              <Text style={{ fontSize: "11px", color: "#A98D78" }}>
                还没配置模板·让管理员去后台 admin.kdrhea.com 添加
              </Text>
            )}
            {templates.map((t, i) => {
              const active = i === templateIdx;
              const isCustom = t._id === "__custom__";
              return (
                <View
                  key={t._id}
                  onClick={() => pickTemplate(i)}
                  style={{
                    background: active ? "#3C2218" : "#FBF7F1",
                    color: active ? "#FBF7F1" : "#5E3425",
                    border: active ? "1px solid #3C2218" : "1px solid #DCC9B6",
                    fontSize: "12px",
                    letterSpacing: "0.04em",
                    padding: "6px 12px",
                    borderRadius: "999px",
                    fontStyle: isCustom ? "italic" : "normal",
                  }}
                >
                  {isCustom ? "自定义" : t.name}
                </View>
              );
            })}
          </View>
        </SectionCard>

        {/* === STEP 03 · 编辑 === */}
        {templateIdx >= 0 && (
          <SectionCard number="03" title="券内容" done={!!name}>
            <FormRow label="券名称">
              <Input
                value={name}
                onInput={e => setName(e.detail.value)}
                placeholder="例：M22 光子嫩肤 · 体验"
                placeholderStyle="color:#C4AD98;font-size:13px"
                maxlength={30}
                cursorSpacing={120}
                adjustPosition
                style={inputStyle}
              />
            </FormRow>

            <FormRow label="类型">
              <Picker
                mode="selector"
                range={TYPE_OPTIONS.map(o => o.label)}
                value={typeIdx}
                onChange={e => setTypeIdx(Number(e.detail.value))}
              >
                <View style={{ ...inputStyle, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: "13px", color: "#3C2218" }}>{TYPE_OPTIONS[typeIdx].label}</Text>
                  <Text style={{ fontSize: "11px", color: "#937761" }}>选择 ▾</Text>
                </View>
              </Picker>
            </FormRow>

            <FormRow label="面值/规格">
              <Input
                value={value}
                onInput={e => setValue(e.detail.value)}
                placeholder="例：可抵 ¥100 / 1 次单部位"
                placeholderStyle="color:#C4AD98;font-size:13px"
                maxlength={40}
                cursorSpacing={120}
                adjustPosition
                style={inputStyle}
              />
            </FormRow>

            <FormRow label="说明">
              <Textarea
                value={description}
                onInput={e => setDescription(e.detail.value)}
                placeholder="使用场景 · 限制条件 · 等"
                placeholderStyle="color:#C4AD98;font-size:13px"
                maxlength={120}
                cursorSpacing={150}
                adjustPosition
                style={{ ...inputStyle, height: "70px", lineHeight: "1.6", paddingTop: "10px", paddingBottom: "10px", width: "100%", boxSizing: "border-box" }}
              />
            </FormRow>

            <FormRow label="有效天数">
              <Input
                type="number"
                value={validDays}
                onInput={e => setValidDays(e.detail.value)}
                cursorSpacing={120}
                adjustPosition
                style={inputStyle}
              />
            </FormRow>
          </SectionCard>
        )}

        {lastResult && (
          <View
            className="mt-4 p-3"
            style={{
              background: lastResult.startsWith("✅") ? "#F5EDE3" : "#FAF0EF",
              border: "1px solid #E8DFD4",
              borderRadius: "10px",
            }}
          >
            <Text style={{ fontSize: "12px", color: "#3C2218", lineHeight: "1.6" }}>{lastResult}</Text>
          </View>
        )}
      </View>

      <View
        onClick={handleSubmit}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: submitting ? "#A98D78" : "#3C2218",
          color: "#FBF7F1",
          fontSize: "14px",
          letterSpacing: "0.28em",
          textAlign: "center",
          padding: "16px 0",
          zIndex: 50,
        }}
      >
        {submitting ? "发送中…" : "发送给客户"}
      </View>
    </PageWrapper>
  );
}

function SectionCard({ number, title, done, children }: { number: string; title: string; done: boolean; children: any }) {
  return (
    <View
      className="mt-4 p-4"
      style={{
        background: "#FAF7F3",
        border: "1px solid #E8DFD4",
        borderRadius: "16px",
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
        <Text className="ml-2" style={{ fontSize: "13px", color: "#3C2218", fontWeight: 500 }}>
          {title}
        </Text>
        {done && <Text className="ml-auto" style={{ fontSize: "12px", color: "#864D39" }}>✓</Text>}
      </View>
      <View className="mt-3">{children}</View>
    </View>
  );
}

function FormRow({ label, children }: { label: string; children: any }) {
  return (
    <View className="mt-3">
      <Text className="block" style={{ fontSize: "11px", letterSpacing: "0.16em", color: "#864D39", fontWeight: 500 }}>
        {label}
      </Text>
      {children}
    </View>
  );
}
