// 预约申请 · 客户提交
import { Input, Picker, Text, Textarea, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useState } from "react";
import PageWrapper from "~/components/PageWrapper";

interface Sku {
  _id: string;
  name: string;
  category: string;
  type: string;
  pointsOnly: boolean;
}

// 营业时间 10:00 – 19:00
const SLOTS = [
  { key: "morning", label: "上午", time: "10:00 – 13:00" },
  { key: "afternoon", label: "下午", time: "13:00 – 17:00" },
  { key: "evening", label: "晚间", time: "17:00 – 19:00" },
];

// 前台咨询电话
const RECEPTION_PHONE = "0516-83900001";

function todayPlus(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// 把 "医美注射" → "注射" 显示更轻
function shortCategory(c: string) {
  return c.replace(/^医美/, "");
}

export default function AppointmentNew() {
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryIdx, setCategoryIdx] = useState(-1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
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

  useLoad(async (options) => {
    const r = await callCloud("listSku", { type: "service", pointsOnly: false, limit: 50 });
    if (r?.ok) {
      const cats = Array.from(new Set((r.items as Sku[]).map(s => s.category))).filter(Boolean);
      setCategories(cats);

      if (options?.skuId) {
        const matched = (r.items as Sku[]).find(s => s._id === options.skuId);
        if (matched) {
          const idx = cats.indexOf(matched.category);
          if (idx >= 0) {
            setCategoryIdx(idx);
          }
        }
      }
    }

    const lg = await callCloud("login");
    if (lg?.user?.phone) {
      setPhone(lg.user.phone);
    }
  });

  const callPhone = () => {
    Taro.makePhoneCall({ phoneNumber: RECEPTION_PHONE }).catch(() => {});
  };

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }
    if (categoryIdx < 0) {
      Taro.showToast({ title: "请选择项目类别", icon: "none" });
      return;
    }
    if (!name || name.length < 2) {
      Taro.showToast({ title: "请填姓名", icon: "none" });
      return;
    }
    if (!/^1\d{10}$/.test(phone)) {
      Taro.showToast({ title: "请填正确手机号", icon: "none" });
      return;
    }
    setSubmitting(true);
    const category = categories[categoryIdx];
    const r = await callCloud("createAppointment", {
      customerName: name,
      customerPhone: phone,
      preferredDate: date,
      preferredSlot: SLOTS[slotIdx].key,
      skuId: null,
      skuName: "",
      skuCategory: category,
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
      <View className="min-h-screen bg-kd-paper px-5 pb-32 pt-4">
        {/* 顶部 */}
        <View className="text-center">
          <Text style={{ fontSize: "11px", letterSpacing: "0.32em", color: "#3C2218", fontWeight: 500 }}>
            B  O  O  K
          </Text>
          <Text className="mt-2 block" style={{ fontSize: "11px", letterSpacing: "0.08em", color: "#937761" }}>
            两种方式皆可 · 我们 1 小时内回复
          </Text>
        </View>

        {/* 电话预约卡 */}
        <View
          className="mt-5 flex items-center justify-between"
          onClick={callPhone}
          style={{
            background: "#FAF7F3",
            border: "1px solid #DCC9B6",
            padding: "14px 16px",
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: "10px", letterSpacing: "0.2em", color: "#937761" }}>
              C  A  L  L
            </Text>
            <Text
              className="mt-1 block"
              style={{
                fontFamily: "var(--kd-font-display)",
                fontSize: "17px",
                color: "#3C2218",
                letterSpacing: "0.04em",
              }}
            >
              电话预约 ·
              {" "}
              {RECEPTION_PHONE}
            </Text>
            <Text className="mt-1 block" style={{ fontSize: "10px", color: "#864D39" }}>
              营业时间 10:00 – 19:00
            </Text>
          </View>
          <View
            style={{
              width: "40px",
              height: "40px",
              background: "#3C2218",
              color: "#FBF7F1",
              fontSize: "20px",
              textAlign: "center",
              lineHeight: "40px",
            }}
          >
            ☎
          </View>
        </View>

        {/* 分隔 */}
        <View className="mt-6 flex items-center">
          <View style={{ flex: 1, height: "1px", background: "#E8DFD4" }} />
          <Text className="px-3" style={{ fontSize: "10px", letterSpacing: "0.24em", color: "#A98D78" }}>
            O  R
          </Text>
          <View style={{ flex: 1, height: "1px", background: "#E8DFD4" }} />
        </View>

        {/* 表单卡 */}
        <View
          className="mt-5"
          style={{ background: "#FAF7F3", border: "1px solid #E8DFD4", padding: "18px 16px" }}
        >
          {/* 项目类别 chip */}
          <SectionLabel text="项目类别" />
          <View className="mt-2 flex flex-wrap">
            {categories.length === 0 && (
              <Text style={{ fontSize: "12px", color: "#A98D78" }}>载入中…</Text>
            )}
            {categories.map((c, i) => {
              const active = i === categoryIdx;
              return (
                <View
                  key={c}
                  onClick={() => setCategoryIdx(i)}
                  className="mb-2 mr-2 px-4"
                  style={{
                    background: active ? "#3C2218" : "#FBF7F1",
                    color: active ? "#FBF7F1" : "#5E3425",
                    border: active ? "1px solid #3C2218" : "1px solid #DCC9B6",
                    fontSize: "13px",
                    letterSpacing: "0.04em",
                    height: "34px",
                    lineHeight: "32px",
                  }}
                >
                  {shortCategory(c)}
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
              style={{
                marginTop: "8px",
                background: "#FBF7F1",
                border: "1px solid #DCC9B6",
                paddingLeft: "12px",
                paddingRight: "12px",
                height: "44px",
                lineHeight: "44px",
                fontSize: "14px",
                color: "#3C2218",
              }}
            />
          </View>

          {/* 手机号 */}
          <View className="mt-4">
            <SectionLabel text="手机号" />
            <Input
              type="number"
              value={phone}
              onInput={e => setPhone(e.detail.value)}
              placeholder="11 位手机号"
              placeholderStyle="color:#C4AD98;font-size:14px"
              cursorSpacing={120}
              adjustPosition
              style={{
                marginTop: "8px",
                background: "#FBF7F1",
                border: "1px solid #DCC9B6",
                paddingLeft: "12px",
                paddingRight: "12px",
                height: "44px",
                lineHeight: "44px",
                fontSize: "14px",
                color: "#3C2218",
              }}
            />
          </View>

          {/* 日期 */}
          <View className="mt-4">
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
                  marginTop: "8px",
                  background: "#FBF7F1",
                  border: "1px solid #DCC9B6",
                  paddingLeft: "12px",
                  paddingRight: "12px",
                  height: "44px",
                  lineHeight: "44px",
                  fontSize: "14px",
                  color: "#3C2218",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: "14px", color: "#3C2218" }}>{date}</Text>
                <Text style={{ fontSize: "11px", color: "#937761" }}>选择 ▾</Text>
              </View>
            </Picker>
          </View>

          {/* 时段 chip */}
          <View className="mt-4">
            <SectionLabel text="期望时段" />
            <View className="mt-2 flex">
              {SLOTS.map((s, i) => {
                const active = i === slotIdx;
                return (
                  <View
                    key={s.key}
                    onClick={() => setSlotIdx(i)}
                    className="mr-2"
                    style={{
                      flex: 1,
                      background: active ? "#3C2218" : "#FBF7F1",
                      color: active ? "#FBF7F1" : "#5E3425",
                      border: active ? "1px solid #3C2218" : "1px solid #DCC9B6",
                      padding: "10px 0",
                      textAlign: "center",
                    }}
                  >
                    <Text className="block" style={{ fontSize: "13px", color: active ? "#FBF7F1" : "#3C2218" }}>
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
          <View className="mt-4">
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
        <View className="mt-4 px-1">
          <Text style={{ fontSize: "10px", color: "#937761", lineHeight: "1.7" }}>
            提交后 · 咨询师 1 小时内致电您确认时间和具体方案 · 状态会同步到「我的预约」
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
          letterSpacing: "0.24em",
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
    <Text className="block" style={{ fontSize: "11px", letterSpacing: "0.16em", color: "#864D39", fontWeight: 500 }}>
      {text}
    </Text>
  );
}
