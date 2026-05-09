// 我的预约 · 客户视角
import { Text, View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { useState } from "react";
import PageWrapper from "~/components/PageWrapper";

interface Appointment {
  _id: string;
  preferredDate: string;
  preferredSlot: string;
  finalDate: string | null;
  finalSlot: string | null;
  skuName: string;
  skuCategory: string;
  customerName: string;
  customerNotes: string;
  staffNotes: string;
  status: string;
  createdAt: string;
  confirmedAt: string | null;
}

const STATUS_LABEL: Record<string, { text: string; color: string; bg: string }> = {
  pending: { text: "申请中", color: "#864D39", bg: "#F5EDE3" },
  confirmed: { text: "已确认", color: "#3C2218", bg: "#EBDFD1" },
  rescheduled: { text: "已改约", color: "#864D39", bg: "#F5EDE3" },
  rejected: { text: "未能安排", color: "#A98D78", bg: "#F0EAE0" },
  cancelled: { text: "已取消", color: "#A98D78", bg: "#F0EAE0" },
  completed: { text: "已完成", color: "#5E3425", bg: "#DCC9B6" },
};

const SLOT_LABEL: Record<string, string> = {
  morning: "上午",
  afternoon: "下午",
  evening: "晚间",
};

export default function AppointmentList() {
  const [items, setItems] = useState<Appointment[]>([]);

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

  const load = async () => {
    const r = await callCloud("listMyAppointments", { limit: 30 });
    if (r?.ok) {
      setItems(r.items);
    }
  };

  useLoad(load);
  useDidShow(load);

  return (
    <PageWrapper navTitle="我的预约" className="h-full bg-kd-paper" shouldShowBottomActions={false} shouldShowNavigationMenu={false}>
      <View className="min-h-screen bg-kd-paper px-5 pb-12 pt-5">
        <View className="text-center">
          <Text style={{ fontSize: "11px", letterSpacing: "0.32em", color: "#3C2218", fontWeight: 500 }}>
            M  Y    B  O  O  K  I  N  G  S
          </Text>
        </View>

        <View className="mt-6">
          {items.length === 0 && (
            <View className="text-center" style={{ paddingTop: "60px" }}>
              <Text style={{ fontSize: "13px", color: "#937761" }}>暂无预约</Text>
              <View
                onClick={() => Taro.navigateTo({ url: "/pages/appointment/new" })}
                className="mx-auto mt-4 inline-block px-6 py-2"
                style={{
                  background: "#3C2218",
                  color: "#FBF7F1",
                  fontSize: "12px",
                  letterSpacing: "0.16em",
                }}
              >
                立即预约
              </View>
            </View>
          )}

          {items.map((a) => {
            const s = STATUS_LABEL[a.status] || STATUS_LABEL.pending;
            const showFinal = a.finalDate && (a.finalDate !== a.preferredDate || a.finalSlot !== a.preferredSlot);
            return (
              <View
                key={a._id}
                className="mb-4 p-4"
                style={{ background: "#FAF7F3", border: "1px solid #E8DFD4" }}
              >
                <View className="flex items-baseline justify-between">
                  <Text
                    style={{
                      fontFamily: "var(--kd-font-display)",
                      fontSize: "16px",
                      color: "#3C2218",
                      fontWeight: 400,
                    }}
                  >
                    {a.skuName}
                  </Text>
                  <View
                    className="px-2"
                    style={{
                      background: s.bg,
                      color: s.color,
                      fontSize: "11px",
                      letterSpacing: "0.08em",
                      lineHeight: "20px",
                    }}
                  >
                    {s.text}
                  </View>
                </View>
                <Text className="mt-1 block" style={{ fontSize: "11px", color: "#937761", letterSpacing: "0.06em" }}>
                  {a.skuCategory}
                </Text>

                {/* 时间 */}
                <View className="mt-3" style={{ borderTop: "1px solid #E8DFD4", paddingTop: "10px" }}>
                  <Text className="block" style={{ fontSize: "11px", color: "#864D39" }}>
                    期望
                    {" "}
                    {a.preferredDate}
                    {" · "}
                    {SLOT_LABEL[a.preferredSlot]}
                  </Text>
                  {showFinal && (
                    <Text
                      className="mt-1 block"
                      style={{
                        fontFamily: "var(--kd-font-display)",
                        fontSize: "14px",
                        color: "#3C2218",
                        fontWeight: 500,
                      }}
                    >
                      ✓ 确认
                      {" "}
                      {a.finalDate}
                      {" · "}
                      {a.finalSlot ? SLOT_LABEL[a.finalSlot] : ""}
                    </Text>
                  )}
                </View>

                {/* 留言 */}
                {a.customerNotes && (
                  <Text
                    className="mt-2 block"
                    style={{ fontSize: "11px", color: "#5E3425", lineHeight: "1.6" }}
                  >
                    您的留言：
                    {a.customerNotes}
                  </Text>
                )}
                {a.staffNotes && (
                  <Text
                    className="mt-1 block"
                    style={{ fontSize: "11px", color: "#864D39", lineHeight: "1.6" }}
                  >
                    咨询师备注：
                    {a.staffNotes}
                  </Text>
                )}

                <Text
                  className="mt-2 block"
                  style={{ fontSize: "10px", color: "#A98D78" }}
                >
                  申请于
                  {" "}
                  {a.createdAt.slice(0, 16).replace("T", " ")}
                </Text>
              </View>
            );
          })}
        </View>

        {items.length > 0 && (
          <View className="text-center" style={{ marginTop: "20px" }}>
            <View
              onClick={() => Taro.navigateTo({ url: "/pages/appointment/new" })}
              className="mx-auto inline-block px-6 py-2"
              style={{
                background: "#3C2218",
                color: "#FBF7F1",
                fontSize: "12px",
                letterSpacing: "0.16em",
              }}
            >
              新建预约
            </View>
          </View>
        )}
      </View>
    </PageWrapper>
  );
}
