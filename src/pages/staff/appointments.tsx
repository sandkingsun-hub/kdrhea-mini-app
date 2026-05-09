// 员工预约管理 · 看待处理 + 已确认 + 改状态
import { Picker, ScrollView, Text, Textarea, View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { useState } from "react";
import PageWrapper from "~/components/PageWrapper";

interface Appointment {
  _id: string;
  _openid: string;
  preferredDate: string;
  preferredSlot: string;
  finalDate: string | null;
  finalSlot: string | null;
  skuName: string;
  skuCategory: string;
  customerName: string;
  customerPhone: string;
  customerNotes: string;
  staffNotes: string;
  status: string;
  createdAt: string;
}

const STATUS_FILTERS = [
  { key: "pending", label: "待处理" },
  { key: "confirmed", label: "已确认" },
  { key: "completed", label: "已完成" },
  { key: "cancelled", label: "已取消" },
  { key: "rejected", label: "未安排" },
];

const SLOT_LABEL: Record<string, string> = {
  morning: "上午 10–13",
  afternoon: "下午 13–17",
  evening: "晚间 17–19",
};
const SLOT_OPTIONS = [
  { key: "morning", label: "上午 10–13" },
  { key: "afternoon", label: "下午 13–17" },
  { key: "evening", label: "晚间 17–19" },
];

export default function StaffAppointments() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [filter, setFilter] = useState(0);
  const [items, setItems] = useState<Appointment[]>([]);
  const [editing, setEditing] = useState<string | null>(null); // 当前编辑的预约 id
  const [editFinalDate, setEditFinalDate] = useState("");
  const [editFinalSlotIdx, setEditFinalSlotIdx] = useState(0);
  const [editStaffNotes, setEditStaffNotes] = useState("");
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

  const checkAuth = async () => {
    const lg = await callCloud("login");
    const role = lg?.user?.role || "customer";
    setAuthorized(role === "staff" || role === "admin");
  };

  const load = async () => {
    const r = await callCloud("listPendingAppointments", {
      status: STATUS_FILTERS[filter].key,
      limit: 50,
    });
    if (r?.ok) {
      setItems(r.items);
    }
  };

  useLoad(async () => {
    await checkAuth();
    await load();
  });
  useDidShow(load);

  const switchFilter = async (i: number) => {
    setFilter(i);
    setEditing(null);
    const r = await callCloud("listPendingAppointments", {
      status: STATUS_FILTERS[i].key,
      limit: 50,
    });
    if (r?.ok) {
      setItems(r.items);
    }
  };

  const startEdit = (a: Appointment) => {
    setEditing(a._id);
    setEditFinalDate(a.finalDate || a.preferredDate);
    setEditFinalSlotIdx(SLOT_OPTIONS.findIndex(s => s.key === (a.finalSlot || a.preferredSlot)));
    setEditStaffNotes(a.staffNotes || "");
  };

  const submitStatus = async (apptId: string, status: string) => {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    const data: any = {
      appointmentId: apptId,
      status,
      staffNotes: editStaffNotes,
    };
    if (status === "confirmed" || status === "rescheduled") {
      data.finalDate = editFinalDate;
      data.finalSlot = SLOT_OPTIONS[editFinalSlotIdx].key;
    }
    const r = await callCloud("updateAppointmentStatus", data);
    setSubmitting(false);
    if (r?.ok) {
      Taro.showToast({ title: "已更新", icon: "success" });
      setEditing(null);
      load();
    } else {
      Taro.showToast({ title: r?.code || "失败", icon: "none" });
    }
  };

  if (authorized === null) {
    return (
      <PageWrapper navTitle="预约管理" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
        <View className="h-screen flex-center">
          <Text style={{ fontSize: "12px", color: "#937761" }}>校验中…</Text>
        </View>
      </PageWrapper>
    );
  }

  if (!authorized) {
    return (
      <PageWrapper navTitle="预约管理" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
        <View className="flex flex-col items-center px-6 pt-20">
          <Text style={{ fontSize: "13px", color: "#3C2218" }}>权限不足</Text>
          <Text className="mt-2 block" style={{ fontSize: "11px", color: "#937761" }}>该页仅限员工/管理员访问</Text>
        </View>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper navTitle="预约管理" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
      <View className="min-h-screen bg-kd-paper px-5 pb-12 pt-5">
        {/* 顶部 */}
        <View className="text-center">
          <Text style={{ fontSize: "11px", letterSpacing: "0.32em", color: "#937761" }}>
            S  T  A  F  F    B  O  O  K  I  N  G  S
          </Text>
        </View>

        {/* 过滤 chip */}
        <ScrollView scrollX className="mt-4 py-2" style={{ whiteSpace: "nowrap" }}>
          {STATUS_FILTERS.map((f, i) => (
            <View
              key={f.key}
              onClick={() => switchFilter(i)}
              className="mx-1 inline-block px-3"
              style={{
                background: filter === i ? "#3C2218" : "transparent",
                color: filter === i ? "#FBF7F1" : "#5E3425",
                border: filter === i ? "1px solid #3C2218" : "1px solid #DCC9B6",
                fontSize: "12px",
                letterSpacing: "0.06em",
                height: "30px",
                lineHeight: "28px",
              }}
            >
              {f.label}
            </View>
          ))}
        </ScrollView>

        {/* 列表 */}
        <View className="mt-4">
          {items.length === 0 && (
            <Text style={{ fontSize: "12px", color: "#937761" }}>本类目暂无</Text>
          )}
          {items.map(a => (
            <View
              key={a._id}
              className="mb-3 p-4"
              style={{ background: "#FAF7F3", border: "1px solid #E8DFD4" }}
            >
              {/* 客户信息 */}
              <View className="flex items-baseline justify-between">
                <Text
                  style={{
                    fontFamily: "var(--kd-font-display)",
                    fontSize: "16px",
                    color: "#3C2218",
                    fontWeight: 400,
                  }}
                >
                  {a.customerName}
                </Text>
                <Text style={{ fontSize: "12px", color: "#864D39", fontFamily: "monospace" }}>
                  {a.customerPhone}
                </Text>
              </View>

              {/* 项目 + 时间 */}
              <View className="mt-2" style={{ borderTop: "1px solid #E8DFD4", paddingTop: "8px" }}>
                <Text className="block" style={{ fontSize: "13px", color: "#3C2218" }}>
                  {a.skuName}
                  {" "}
                  <Text style={{ fontSize: "11px", color: "#937761" }}>
                    ·
                    {a.skuCategory}
                  </Text>
                </Text>
                <Text className="mt-1 block" style={{ fontSize: "12px", color: "#864D39" }}>
                  期望
                  {" "}
                  {a.preferredDate}
                  {" · "}
                  {SLOT_LABEL[a.preferredSlot]}
                </Text>
                {a.finalDate && (a.finalDate !== a.preferredDate || a.finalSlot !== a.preferredSlot) && (
                  <Text className="mt-1 block" style={{ fontSize: "12px", color: "#3C2218", fontWeight: 500 }}>
                    ✓ 已定
                    {" "}
                    {a.finalDate}
                    {" · "}
                    {a.finalSlot ? SLOT_LABEL[a.finalSlot] : ""}
                  </Text>
                )}
              </View>

              {/* 客户留言 */}
              {a.customerNotes && (
                <Text className="mt-2 block" style={{ fontSize: "11px", color: "#5E3425", lineHeight: "1.6" }}>
                  客户留言：
                  {a.customerNotes}
                </Text>
              )}
              {a.staffNotes && !editing && (
                <Text className="mt-1 block" style={{ fontSize: "11px", color: "#864D39", lineHeight: "1.6" }}>
                  备注：
                  {a.staffNotes}
                </Text>
              )}

              {/* 编辑模式 */}
              {editing === a._id
                ? (
                    <View className="mt-3 p-3" style={{ background: "#F5EDE3", border: "1px solid #DCC9B6" }}>
                      <Text className="block" style={{ fontSize: "11px", letterSpacing: "0.16em", color: "#864D39", fontWeight: 500 }}>
                        最终时间
                      </Text>
                      <View className="mt-1 flex">
                        <Picker mode="date" value={editFinalDate} onChange={e => setEditFinalDate(e.detail.value)}>
                          <View className="mr-2 px-3 py-2" style={{ background: "#FBF7F1", border: "1px solid #DCC9B6", fontSize: "13px", color: "#3C2218" }}>
                            {editFinalDate}
                          </View>
                        </Picker>
                        <Picker mode="selector" range={SLOT_OPTIONS.map(s => s.label)} value={editFinalSlotIdx} onChange={e => setEditFinalSlotIdx(Number(e.detail.value))}>
                          <View className="px-3 py-2" style={{ background: "#FBF7F1", border: "1px solid #DCC9B6", fontSize: "13px", color: "#3C2218" }}>
                            {SLOT_OPTIONS[editFinalSlotIdx].label}
                          </View>
                        </Picker>
                      </View>

                      <Text className="mt-3 block" style={{ fontSize: "11px", letterSpacing: "0.16em", color: "#864D39", fontWeight: 500 }}>
                        员工备注
                      </Text>
                      <Textarea
                        value={editStaffNotes}
                        onInput={e => setEditStaffNotes(e.detail.value)}
                        placeholder="如：已电话沟通确认改约 5/16 下午 2 点"
                        placeholderStyle="color:#C4AD98;font-size:12px"
                        cursorSpacing={150}
                        adjustPosition
                        maxlength={200}
                        className="mt-1 p-2"
                        style={{
                          background: "#FBF7F1",
                          border: "1px solid #DCC9B6",
                          fontSize: "12px",
                          color: "#3C2218",
                          minHeight: "60px",
                          width: "100%",
                          boxSizing: "border-box",
                        }}
                      />

                      {/* 操作按钮 */}
                      <View className="mt-3 flex flex-wrap">
                        {a.status === "pending" && (
                          <>
                            <ActionBtn label="确认" color="#3C2218" onClick={() => submitStatus(a._id, "confirmed")} />
                            <ActionBtn label="改约" color="#864D39" onClick={() => submitStatus(a._id, "rescheduled")} />
                            <ActionBtn label="未安排" color="#A98D78" onClick={() => submitStatus(a._id, "rejected")} />
                          </>
                        )}
                        {a.status === "confirmed" && (
                          <>
                            <ActionBtn label="标记完成" color="#3C2218" onClick={() => submitStatus(a._id, "completed")} />
                            <ActionBtn label="改约" color="#864D39" onClick={() => submitStatus(a._id, "rescheduled")} />
                            <ActionBtn label="取消" color="#A98D78" onClick={() => submitStatus(a._id, "cancelled")} />
                          </>
                        )}
                        <ActionBtn label="收起" color="#937761" outline onClick={() => setEditing(null)} />
                      </View>
                    </View>
                  )
                : (
                    <View
                      onClick={() => startEdit(a)}
                      className="mt-3 inline-block px-3 py-2"
                      style={{
                        background: "#3C2218",
                        color: "#FBF7F1",
                        fontSize: "12px",
                        letterSpacing: "0.12em",
                      }}
                    >
                      处理 →
                    </View>
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
          ))}
        </View>
      </View>
    </PageWrapper>
  );
}

function ActionBtn({ label, color, onClick, outline }: { label: string; color: string; onClick: () => void; outline?: boolean }) {
  return (
    <View
      onClick={onClick}
      className="mb-1 mr-2 px-3 py-1"
      style={{
        background: outline ? "transparent" : color,
        color: outline ? color : "#FBF7F1",
        border: outline ? `1px solid ${color}` : `1px solid ${color}`,
        fontSize: "11px",
        letterSpacing: "0.08em",
      }}
    >
      {label}
    </View>
  );
}
