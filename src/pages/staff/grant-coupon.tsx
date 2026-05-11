// 员工 · 发券给客户
// 新流程（M2.5 库存制）：
//   01 选客户：扫客户 QR 或输手机号
//   02 选我的批次（admin 分配给我的）
//   03 提交 grantCoupon · 走 issuanceId 扣库存
import { Input, Text, View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { useState } from "react";
import PageWrapper from "~/components/PageWrapper";

interface Allocation {
  _id: string;
  templateId: string;
  templateNo: string;
  templateName: string;
  quantity: number;
  usedQuantity: number;
  remaining: number;
}

interface CustomerInfo {
  openid: string;
  nickname: string | null;
  phone: string;
}

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
  letterSpacing: "-0.04em",
  marginTop: "8px",
} as const;

function maskPhone(p: string) {
  if (!p || p.length < 7) {
    return p;
  }
  return `${p.slice(0, 3)} **** ${p.slice(-4)}`;
}

export default function StaffGrantCoupon() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [allocIdx, setAllocIdx] = useState(-1);

  const [customerMode, setCustomerMode] = useState<"scan" | "phone">("scan");
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

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

  const loadAllocations = async () => {
    const r = await callCloud("staffMyAllocations");
    if (r?.ok && r.items) {
      setAllocations(r.items);
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
    await loadAllocations();
  });
  useDidShow(loadAllocations);

  // 扫客户码
  const handleScan = async () => {
    try {
      const r = await Taro.scanCode({ scanType: ["qrCode"] });
      const result = r.result || "";
      if (result.startsWith("{") && result.includes("\"t\":\"coupon\"")) {
        Taro.showToast({ title: "这是券码·不是客户码", icon: "none" });
        return;
      }
      setCustomer({ openid: result, nickname: null, phone: "" });
      setLastResult("");
    } catch {
      Taro.showToast({ title: "扫码取消", icon: "none" });
    }
  };

  // 手机号查客户
  const handleLookup = async () => {
    if (lookingUp) {
      return;
    }
    if (!/^1\d{10}$/.test(phoneInput)) {
      Taro.showToast({ title: "11 位手机号", icon: "none" });
      return;
    }
    setLookingUp(true);
    const r = await callCloud("lookupCustomerByPhone", { phone: phoneInput });
    setLookingUp(false);
    if (r?.ok && r.customer) {
      setCustomer(r.customer);
      setLastResult("");
    } else {
      const map: Record<string, string> = {
        NOT_REGISTERED: "该客户尚未在小程序注册·让客户先扫「我的二维码」激活",
        INVALID_PHONE: "手机号格式不对",
        PERMISSION_DENIED: "权限不足",
      };
      Taro.showToast({ title: map[r?.code] || `失败 ${r?.code}`, icon: "none" });
    }
  };

  const clearCustomer = () => {
    setCustomer(null);
    setPhoneInput("");
  };

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }
    if (!customer) {
      Taro.showToast({ title: "请先选客户", icon: "none" });
      return;
    }
    if (allocIdx < 0) {
      Taro.showToast({ title: "请选要发的券", icon: "none" });
      return;
    }
    const alloc = allocations[allocIdx];
    setSubmitting(true);
    const r = await callCloud("grantCoupon", {
      targetOpenid: customer.openid,
      issuanceId: alloc._id,
    });
    setSubmitting(false);

    if (r?.ok) {
      setLastResult(`✅ 已发送 ${alloc.templateName} · ${r.couponNo}`);
      Taro.showToast({ title: "已发送", icon: "success" });
      // 清并刷新库存
      clearCustomer();
      setAllocIdx(-1);
      loadAllocations();
    } else {
      const map: Record<string, string> = {
        ALLOCATION_DEPLETED: "该批次已发完·联系管理员补货",
        ALLOCATION_NOT_ACTIVE: "批次已收回·联系管理员",
        NOT_YOUR_ALLOCATION: "不是你的批次",
        TEMPLATE_NOT_FOUND: "模板已删除",
        MISSING_TARGET: "客户未识别",
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
            选客户 · 选你手里的券 · 发出
          </Text>
        </View>

        {/* === STEP 01 · 选客户 · 扫码 OR 手机号 === */}
        <SectionCard number="01" title="选客户" done={!!customer}>
          {customer ? (
            <View
              className="flex items-center justify-between p-3"
              style={{
                background: "#F5EDE3",
                border: "1px solid #DCC9B6",
                borderRadius: "10px",
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: "13px", color: "#3C2218" }}>
                  {customer.nickname || "微信用户"}
                </Text>
                <Text className="mt-1 block" style={{ fontSize: "11px", color: "#864D39", fontFamily: "monospace" }}>
                  {customer.phone ? maskPhone(customer.phone) : `${customer.openid.slice(0, 12)}…`}
                </Text>
              </View>
              <View
                onClick={clearCustomer}
                className="px-3"
                style={{
                  background: "transparent",
                  color: "#864D39",
                  fontSize: "11px",
                  border: "1px solid #DCC9B6",
                  borderRadius: "999px",
                  height: "28px",
                  lineHeight: "28px",
                }}
              >
                重选
              </View>
            </View>
          ) : (
            <>
              {/* 切换 mode chip */}
              <View
                className="mb-3 flex"
                style={{ background: "#FBF7F1", border: "1px solid #DCC9B6", borderRadius: "999px", overflow: "hidden" }}
              >
                <View
                  onClick={() => setCustomerMode("scan")}
                  style={{
                    flex: 1,
                    background: customerMode === "scan" ? "#3C2218" : "transparent",
                    color: customerMode === "scan" ? "#FBF7F1" : "#3C2218",
                    fontSize: "12px",
                    letterSpacing: "0.06em",
                    padding: "8px 0",
                    textAlign: "center",
                  }}
                >
                  扫客户码
                </View>
                <View
                  onClick={() => setCustomerMode("phone")}
                  style={{
                    flex: 1,
                    background: customerMode === "phone" ? "#3C2218" : "transparent",
                    color: customerMode === "phone" ? "#FBF7F1" : "#3C2218",
                    fontSize: "12px",
                    letterSpacing: "0.06em",
                    padding: "8px 0",
                    textAlign: "center",
                  }}
                >
                  手机号
                </View>
              </View>

              {customerMode === "scan" ? (
                <View
                  onClick={handleScan}
                  className="py-3 text-center"
                  style={{
                    background: "#3C2218",
                    color: "#FBF7F1",
                    fontSize: "13px",
                    letterSpacing: "0.16em",
                    borderRadius: "999px",
                  }}
                >
                  打开扫码
                </View>
              ) : (
                <View className="flex">
                  <Input
                    type="number"
                    value={phoneInput}
                    onInput={e => setPhoneInput(e.detail.value)}
                    placeholder="11 位手机号"
                    placeholderStyle="color:#C4AD98;font-size:13px"
                    cursorSpacing={120}
                    adjustPosition
                    maxlength={11}
                    style={{ ...inputStyle, marginTop: 0, flex: 1 }}
                  />
                  <View
                    onClick={handleLookup}
                    className="ml-2 px-4"
                    style={{
                      background: lookingUp ? "#A98D78" : "#3C2218",
                      color: "#FBF7F1",
                      fontSize: "12px",
                      letterSpacing: "0.12em",
                      height: "44px",
                      lineHeight: "44px",
                      borderRadius: "999px",
                    }}
                  >
                    {lookingUp ? "查找…" : "查找"}
                  </View>
                </View>
              )}
            </>
          )}
        </SectionCard>

        {/* === STEP 02 · 选我的券（批次） === */}
        <SectionCard number="02" title="选要发的券" done={allocIdx >= 0}>
          {allocations.length === 0 ? (
            <Text style={{ fontSize: "12px", color: "#A98D78", lineHeight: "1.6" }}>
              暂无可发的券·让管理员去 admin.kdrhea.com 给你分配
            </Text>
          ) : (
            <View>
              {allocations.map((a, i) => {
                const active = i === allocIdx;
                return (
                  <View
                    key={a._id}
                    onClick={() => setAllocIdx(i)}
                    className="mb-2 p-3"
                    style={{
                      background: active ? "#3C2218" : "#FBF7F1",
                      color: active ? "#FBF7F1" : "#3C2218",
                      border: active ? "1px solid #3C2218" : "1px solid #DCC9B6",
                      borderRadius: "12px",
                    }}
                  >
                    <View className="flex items-baseline justify-between">
                      <Text
                        style={{
                          fontFamily: "var(--kd-font-display)",
                          fontSize: "14px",
                          color: active ? "#FBF7F1" : "#3C2218",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {a.templateName}
                      </Text>
                      <Text
                        style={{
                          fontFamily: "var(--kd-font-display)",
                          fontSize: "16px",
                          color: active ? "#FBF7F1" : "#864D39",
                          fontWeight: 500,
                        }}
                      >
                        {a.remaining}
                        <Text style={{ fontSize: "10px", color: active ? "#DCC9B6" : "#937761" }}>
                          {" "}
                          /
                          {a.quantity}
                        </Text>
                      </Text>
                    </View>
                    <Text
                      className="mt-1 block"
                      style={{
                        fontSize: "10px",
                        color: active ? "#DCC9B6" : "#937761",
                        fontFamily: "monospace",
                      }}
                    >
                      {a.templateNo}
                      {" "}
                      · 还剩
                      {a.remaining}
                      {" "}
                      张
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </SectionCard>

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
