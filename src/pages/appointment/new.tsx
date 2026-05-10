// 预约申请 · 客户提交
import { Button, Input, Picker, Text, Textarea, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useState } from "react";
import PageWrapper from "~/components/PageWrapper";

// 营业时间 10:00 – 19:00
const SLOTS = [
  { key: "morning", label: "上午", time: "10–13" },
  { key: "afternoon", label: "下午", time: "13–17" },
  { key: "evening", label: "晚间", time: "17–19" },
];

// 项目大类 · 2 选项
const CATEGORIES = [
  { key: "medical", label: "医疗美容", desc: "注射 · 抗衰 · 光电" },
  { key: "lifestyle", label: "生活美容", desc: "皮肤护理 · 身体管理" },
];

// 前台咨询电话
const RECEPTION_PHONE = "0516-83900001";

function todayPlus(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function maskPhone(p: string) {
  if (!p || p.length < 7) {
    return p;
  }
  return `${p.slice(0, 3)} **** ${p.slice(-4)}`;
}

const inputStyle = {
  background: "#FBF7F1",
  border: "1px solid #DCC9B6",
  paddingLeft: "12px",
  paddingRight: "12px",
  height: "44px",
  lineHeight: "44px",
  fontSize: "14px",
  color: "#3C2218",
  marginTop: "8px",
} as const;

export default function AppointmentNew() {
  const [categoryIdx, setCategoryIdx] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(""); // 微信验证后的真号
  const [phoneBound, setPhoneBound] = useState(false);
  const [phoneBinding, setPhoneBinding] = useState(false);
  const [date, setDate] = useState(todayPlus(1));
  const [slotIdx, setSlotIdx] = useState(0);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    // 拉用户已绑定的真实手机号（来自 users.phone · 之前授权过就有）
    const lg = await callCloud("login");
    if (lg?.user?.phone) {
      setPhone(lg.user.phone);
      setPhoneBound(true);
    }
  });

  const callPhone = () => {
    Taro.makePhoneCall({ phoneNumber: RECEPTION_PHONE }).catch(() => {});
  };

  // 微信原生授权手机号
  const handleGetPhoneNumber = async (e: any) => {
    if (phoneBinding) {
      return;
    }
    const code = e?.detail?.code;
    if (!code) {
      // 用户拒绝授权
      Taro.showToast({ title: "需授权才能预约", icon: "none" });
      return;
    }
    setPhoneBinding(true);
    const r = await callCloud("bindPhone", { phoneCode: code });
    setPhoneBinding(false);
    if (r?.ok && r.phone) {
      setPhone(r.phone);
      setPhoneBound(true);
      Taro.showToast({ title: "已绑定", icon: "success" });
    } else {
      Taro.showToast({ title: r?.code || "绑定失败", icon: "none" });
    }
  };

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }
    if (!name || name.length < 2) {
      Taro.showToast({ title: "请填称呼", icon: "none" });
      return;
    }
    if (!phoneBound || !phone) {
      Taro.showToast({ title: "请先授权手机号", icon: "none" });
      return;
    }
    setSubmitting(true);
    const cat = CATEGORIES[categoryIdx];
    const r = await callCloud("createAppointment", {
      customerName: name,
      customerPhone: phone,
      preferredDate: date,
      preferredSlot: SLOTS[slotIdx].key,
      skuId: null,
      skuName: "",
      skuCategory: cat.label,
      customerNotes: notes,
    });
    setSubmitting(false);
    if (r?.ok) {
      Taro.showToast({ title: "申请已提交", icon: "success" });
      setTimeout(() => {
        const pages = Taro.getCurrentPages();
        if (pages.length > 1) {
          Taro.navigateBack();
        } else {
          Taro.redirectTo({ url: "/pages/appointment/list" });
        }
      }, 1000);
    } else {
      const map: Record<string, string> = {
        DUPLICATE_RECENT: "近 24 小时已提交相同申请",
        INVALID_NAME: "姓名格式不对",
        INVALID_PHONE: "手机号格式不对",
        INVALID_DATE: "日期格式不对",
        INVALID_SLOT: "时段不对",
      };
      Taro.showToast({ title: map[r?.code] || `提交失败 ${r?.code}`, icon: "none" });
    }
  };

  return (
    <PageWrapper navTitle="预约申请" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
      <View className="min-h-screen bg-kd-paper px-5 pb-32 pt-2">
        {/* 顶部 */}
        <View className="text-center" style={{ paddingTop: "12px" }}>
          <Text style={{ fontSize: "11px", letterSpacing: "0.36em", color: "#3C2218", fontWeight: 500 }}>
            B  O  O  K
          </Text>
          <Text className="mt-2 block" style={{ fontSize: "11px", letterSpacing: "0.08em", color: "#937761" }}>
            两种方式皆可 · 1 小时内回复
          </Text>
        </View>

        {/* 电话预约卡 · 单列居中 · 整卡可点 */}
        <View
          className="mt-6"
          onClick={callPhone}
          style={{
            background: "#FAF7F3",
            border: "1px solid #DCC9B6",
            borderRadius: "16px",
            padding: "20px 16px",
            textAlign: "center",
          }}
        >
          <View className="mx-auto" style={{ width: "48px", height: "48px", border: "1px solid #864D39", borderRadius: "999px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <View className="i-mdi-phone-outline" style={{ fontSize: "22px", color: "#3C2218" }} />
          </View>
          <Text className="mt-3 block" style={{ fontSize: "10px", letterSpacing: "0.32em", color: "#937761" }}>
            C  A  L  L
          </Text>
          <Text
            className="mt-1 block"
            style={{
              fontFamily: "var(--kd-font-display)",
              fontSize: "20px",
              color: "#3C2218",
              letterSpacing: "0.08em",
            }}
          >
            {RECEPTION_PHONE}
          </Text>
          <Text className="mt-2 block" style={{ fontSize: "10px", letterSpacing: "0.04em", color: "#864D39" }}>
            营业时间 10:00 – 19:00
          </Text>
        </View>

        {/* OR 分隔 */}
        <View className="mt-6 flex items-center">
          <View style={{ flex: 1, height: "1px", background: "#E8DFD4" }} />
          <Text className="px-3" style={{ fontSize: "10px", letterSpacing: "0.28em", color: "#A98D78" }}>
            O  R
          </Text>
          <View style={{ flex: 1, height: "1px", background: "#E8DFD4" }} />
        </View>

        {/* 表单卡 */}
        <View
          className="mt-5"
          style={{ background: "#FAF7F3", border: "1px solid #E8DFD4", borderRadius: "16px", padding: "20px 18px" }}
        >
          {/* 项目类型 · 2 tab */}
          <SectionLabel text="项目类型" />
          <View
            className="mt-2 flex"
            style={{ border: "1px solid #DCC9B6", background: "#FBF7F1", borderRadius: "999px", overflow: "hidden" }}
          >
            {CATEGORIES.map((c, i) => {
              const active = i === categoryIdx;
              return (
                <View
                  key={c.key}
                  onClick={() => setCategoryIdx(i)}
                  style={{
                    flex: 1,
                    background: active ? "#3C2218" : "transparent",
                    color: active ? "#FBF7F1" : "#5E3425",
                    padding: "12px 0",
                    textAlign: "center",
                    transition: "background 0.2s",
                  }}
                >
                  <Text
                    className="block"
                    style={{
                      fontFamily: "var(--kd-font-display)",
                      fontSize: "15px",
                      letterSpacing: "0.08em",
                      color: active ? "#FBF7F1" : "#3C2218",
                    }}
                  >
                    {c.label}
                  </Text>
                  <Text
                    className="mt-1 block"
                    style={{
                      fontSize: "10px",
                      color: active ? "#DCC9B6" : "#937761",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {c.desc}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* 称呼 */}
          <View className="mt-5">
            <SectionLabel text="您的称呼" />
            <Input
              value={name}
              onInput={e => setName(e.detail.value)}
              placeholder="如：李女士"
              placeholderStyle="color:#C4AD98;font-size:14px"
              cursorSpacing={120}
              adjustPosition
              style={inputStyle}
            />
          </View>

          {/* 手机号 · 微信原生授权 */}
          <View className="mt-5">
            <SectionLabel text="手机号" />
            {phoneBound ? (
              <View
                className="mt-2 flex items-center justify-between"
                style={{
                  background: "#FBF7F1",
                  border: "1px solid #DCC9B6",
                  paddingLeft: "12px",
                  paddingRight: "12px",
                  height: "44px",
                }}
              >
                <View className="flex items-center" style={{ flex: 1 }}>
                  <View className="i-mdi-shield-check-outline" style={{ fontSize: "16px", color: "#5E3425", marginRight: "8px" }} />
                  <Text style={{ fontSize: "14px", color: "#3C2218", letterSpacing: "0.04em" }}>{maskPhone(phone)}</Text>
                </View>
                <Button
                  openType="getPhoneNumber"
                  onGetPhoneNumber={handleGetPhoneNumber}
                  hoverClass="none"
                  style={{
                    background: "transparent",
                    color: "#864D39",
                    fontSize: "11px",
                    letterSpacing: "0.08em",
                    padding: "0 6px",
                    height: "26px",
                    lineHeight: "26px",
                    border: "1px solid #DCC9B6",
                    borderRadius: 0,
                  }}
                >
                  更换
                </Button>
              </View>
            ) : (
              <Button
                openType="getPhoneNumber"
                onGetPhoneNumber={handleGetPhoneNumber}
                hoverClass="none"
                disabled={phoneBinding}
                style={{
                  marginTop: "8px",
                  background: phoneBinding ? "#A98D78" : "#FBF7F1",
                  color: phoneBinding ? "#FBF7F1" : "#3C2218",
                  border: "1px solid #864D39",
                  fontSize: "13px",
                  letterSpacing: "0.06em",
                  height: "44px",
                  lineHeight: "44px",
                  borderRadius: 0,
                  textAlign: "center",
                  padding: 0,
                }}
              >
                {phoneBinding ? "绑定中…" : "使用微信绑定手机号"}
              </Button>
            )}
            <Text className="mt-1 block" style={{ fontSize: "10px", color: "#937761" }}>
              微信验证 · 我们不会收到您手填的号
            </Text>
          </View>

          {/* 期望日期 */}
          <View className="mt-5">
            <SectionLabel text="期望日期" />
            <Picker
              mode="date"
              value={date}
              start={todayPlus(0)}
              end={todayPlus(60)}
              onChange={e => setDate(e.detail.value)}
            >
              <View
                style={{
                  ...inputStyle,
                  marginTop: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: "14px", color: "#3C2218" }}>{date}</Text>
                <View className="i-mdi-calendar-blank-outline" style={{ fontSize: "16px", color: "#937761" }} />
              </View>
            </Picker>
          </View>

          {/* 期望时段 · chip 横排 · 等宽 */}
          <View className="mt-5">
            <SectionLabel text="期望时段" />
            <View
              className="mt-2 flex"
              style={{ border: "1px solid #DCC9B6", background: "#FBF7F1", borderRadius: "12px", overflow: "hidden" }}
            >
              {SLOTS.map((s, i) => {
                const active = i === slotIdx;
                return (
                  <View
                    key={s.key}
                    onClick={() => setSlotIdx(i)}
                    style={{
                      flex: 1,
                      background: active ? "#3C2218" : "transparent",
                      padding: "10px 0",
                      textAlign: "center",
                      borderLeft: i === 0 ? "none" : "1px solid #DCC9B6",
                    }}
                  >
                    <Text className="block" style={{ fontSize: "13px", color: active ? "#FBF7F1" : "#3C2218", letterSpacing: "0.06em" }}>
                      {s.label}
                    </Text>
                    <Text className="mt-1 block" style={{ fontSize: "10px", color: active ? "#DCC9B6" : "#937761" }}>
                      {s.time}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* 留言 */}
          <View className="mt-5">
            <SectionLabel text="留言（可选）" />
            <Textarea
              value={notes}
              onInput={e => setNotes(e.detail.value)}
              placeholder="如：想了解某项具体项目 / 希望某位医生 / 有其他疑虑..."
              placeholderStyle="color:#C4AD98;font-size:13px"
              cursorSpacing={120}
              adjustPosition
              maxlength={200}
              style={{
                marginTop: "8px",
                background: "#FBF7F1",
                border: "1px solid #DCC9B6",
                padding: "10px 12px",
                fontSize: "13px",
                color: "#3C2218",
                minHeight: "80px",
                lineHeight: "1.6",
                width: "100%",
                boxSizing: "border-box",
              }}
            />
          </View>
        </View>

        {/* 流程提示 */}
        <View className="mt-4 px-2 text-center">
          <Text style={{ fontSize: "10px", color: "#937761", lineHeight: "1.7" }}>
            提交后 · 咨询师 1 小时内致电您确认时间和具体方案
          </Text>
        </View>
      </View>

      {/* 底部提交栏 */}
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
        {submitting ? "提交中…" : "提交预约申请"}
      </View>
    </PageWrapper>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <Text className="block" style={{ fontSize: "11px", letterSpacing: "0.18em", color: "#864D39", fontWeight: 500 }}>
      {text}
    </Text>
  );
}
