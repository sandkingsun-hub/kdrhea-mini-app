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

const SLOTS = [
  { key: "morning", label: "上午（09:30 – 12:00）" },
  { key: "afternoon", label: "下午（13:30 – 17:30）" },
  { key: "evening", label: "晚间（17:30 – 20:00）" },
];

function todayPlus(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function AppointmentNew() {
  const [skus, setSkus] = useState<Sku[]>([]);
  const [skuIdx, setSkuIdx] = useState(-1); // -1 = 未选
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
    // SKU 列表（医美治疗 service 类型·非纯积分）
    const r = await callCloud("listSku", { type: "service", pointsOnly: false, limit: 20 });
    if (r?.ok) {
      setSkus(r.items);
    }

    // 如果路由带 skuId·自动选中
    if (options?.skuId && r?.ok) {
      const idx = (r.items as Sku[]).findIndex(s => s._id === options.skuId);
      if (idx >= 0) {
        setSkuIdx(idx);
      }
    }

    // 拉用户已有的 phone 自动填
    const lg = await callCloud("login");
    if (lg?.user?.phone) {
      setPhone(lg.user.phone);
    }
  });

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }
    if (skuIdx < 0) {
      Taro.showToast({ title: "请选择项目", icon: "none" });
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
    const sku = skus[skuIdx];
    const r = await callCloud("createAppointment", {
      customerName: name,
      customerPhone: phone,
      preferredDate: date,
      preferredSlot: SLOTS[slotIdx].key,
      skuId: sku._id,
      skuName: sku.name,
      skuCategory: sku.category,
      customerNotes: notes,
    });
    setSubmitting(false);
    if (r?.ok) {
      Taro.showToast({ title: "申请已提交", icon: "success" });
      setTimeout(() => Taro.redirectTo({ url: "/pages/appointment/list" }), 1200);
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
    <PageWrapper navTitle="预约申请" className="h-full bg-kd-paper" shouldShowBottomActions={false} shouldShowNavigationMenu={false}>
      <View className="min-h-screen bg-kd-paper px-5 pb-32 pt-5">
        <View className="text-center">
          <Text style={{ fontSize: "11px", letterSpacing: "0.32em", color: "#3C2218", fontWeight: 500 }}>
            B  O  O  K
          </Text>
          <Text className="mt-1 block text-center" style={{ fontSize: "10px", letterSpacing: "0.12em", color: "#937761" }}>
            提交后咨询师将致电与您确认
          </Text>
        </View>

        {/* SKU 选择 */}
        <FormRow label="项目">
          <Picker
            mode="selector"
            range={skus.map(s => `${s.name}（${s.category}）`)}
            value={skuIdx < 0 ? 0 : skuIdx}
            onChange={e => setSkuIdx(Number(e.detail.value))}
          >
            <View className="py-2" style={{ borderBottom: "1px solid #DCC9B6" }}>
              <Text style={{ fontSize: "14px", color: skuIdx < 0 ? "#A98D78" : "#3C2218" }}>
                {skuIdx < 0 ? "请选择" : skus[skuIdx]?.name}
              </Text>
            </View>
          </Picker>
        </FormRow>

        {/* 姓名 */}
        <FormRow label="您的称呼">
          <Input
            value={name}
            onInput={e => setName(e.detail.value)}
            placeholder="如：李女士"
            placeholderStyle="color:#C4AD98;font-size:14px"
            cursorSpacing={120}
            adjustPosition
            style={{
              borderBottom: "1px solid #DCC9B6",
              height: "40px",
              lineHeight: "40px",
              fontSize: "14px",
              color: "#3C2218",
            }}
          />
        </FormRow>

        {/* 手机号 */}
        <FormRow label="手机号">
          <Input
            type="number"
            value={phone}
            onInput={e => setPhone(e.detail.value)}
            placeholder="11 位手机号"
            placeholderStyle="color:#C4AD98;font-size:14px"
            cursorSpacing={120}
            adjustPosition
            style={{
              borderBottom: "1px solid #DCC9B6",
              height: "40px",
              lineHeight: "40px",
              fontSize: "14px",
              color: "#3C2218",
            }}
          />
        </FormRow>

        {/* 日期 */}
        <FormRow label="期望日期">
          <Picker
            mode="date"
            value={date}
            start={todayPlus(0)}
            end={todayPlus(60)}
            onChange={e => setDate(e.detail.value)}
          >
            <View className="py-2" style={{ borderBottom: "1px solid #DCC9B6" }}>
              <Text style={{ fontSize: "14px", color: "#3C2218" }}>{date}</Text>
            </View>
          </Picker>
        </FormRow>

        {/* 时段 */}
        <FormRow label="期望时段">
          <Picker
            mode="selector"
            range={SLOTS.map(s => s.label)}
            value={slotIdx}
            onChange={e => setSlotIdx(Number(e.detail.value))}
          >
            <View className="py-2" style={{ borderBottom: "1px solid #DCC9B6" }}>
              <Text style={{ fontSize: "14px", color: "#3C2218" }}>
                {SLOTS[slotIdx].label}
              </Text>
            </View>
          </Picker>
        </FormRow>

        {/* 留言 */}
        <FormRow label="留言（可选）">
          <Textarea
            value={notes}
            onInput={e => setNotes(e.detail.value)}
            placeholder="如：有疑虑想先咨询 / 希望某位医生..."
            placeholderStyle="color:#C4AD98;font-size:13px"
            cursorSpacing={120}
            adjustPosition
            maxlength={200}
            style={{
              border: "1px solid #DCC9B6",
              padding: "10px",
              fontSize: "13px",
              color: "#3C2218",
              minHeight: "80px",
              lineHeight: "1.5",
            }}
          />
        </FormRow>

        {/* 流程提示 */}
        <View className="mt-6 p-3" style={{ background: "#F5EDE3" }}>
          <Text style={{ fontSize: "11px", color: "#5E3425", lineHeight: "1.7" }}>
            提交后流程：
            {"\n"}
            1.  咨询师 1 小时内致电您 · 确认时间和具体方案
            {"\n"}
            2.  确认后状态会自动同步到这里
            {"\n"}
            3.  您可在「我的预约」查看实时状态
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

function FormRow({ label, children }: { label: string; children: any }) {
  return (
    <View className="mt-5">
      <Text className="block" style={{ fontSize: "11px", letterSpacing: "0.16em", color: "#864D39", fontWeight: 500 }}>
        {label}
      </Text>
      <View className="mt-1">{children}</View>
    </View>
  );
}
