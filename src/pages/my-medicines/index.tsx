import type { MedicineRecord } from "~/lib/medicineCloud";
// KDRHEA · 我的药品档案
// 顾客扫码记录治疗用过的药品/器械 · GS1 解析 + medicines 主表自动 pending 状态
import { Button, Text, View } from "@tarojs/components";
import Taro, { useDidShow, useLoad } from "@tarojs/taro";
import { useMemo, useState } from "react";
import PageWrapper from "~/components/PageWrapper";
import { medicineCloud } from "~/lib/medicineCloud";

function fmtDateTime(iso: string): string {
  if (!iso) {
    return "—";
  }
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

function fmtExpireBadge(date: string | null | undefined): { text: string; color: string } | null {
  if (!date) {
    return null;
  }
  try {
    const d = new Date(date).getTime();
    const now = Date.now();
    const days = Math.floor((d - now) / 86400000);
    if (days < 0) {
      return { text: `已过期 (${date})`, color: "#A84830" };
    }
    if (days < 90) {
      return { text: `${days}天后过期`, color: "#864D39" };
    }
    return { text: `有效期至 ${date}`, color: "var(--kd-brown-600)" };
  } catch {
    return null;
  }
}

interface TreatmentGroup {
  key: string;
  checkInId: string | null;
  checkIn: MedicineRecord["checkInSnapshot"] | null;
  items: MedicineRecord[];
}

export default function MyMedicinesPage() {
  const [items, setItems] = useState<MedicineRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  // 按 checkInId 聚合 · 一次到店 = 一张治疗卡 · 没打卡 = 散单
  const groupedTreatments = useMemo<TreatmentGroup[]>(() => {
    const map = new Map<string, TreatmentGroup>();
    items.forEach((r) => {
      const key = r.checkInId || "__other__";
      if (!map.has(key)) {
        map.set(key, {
          key,
          checkInId: r.checkInId || null,
          checkIn: r.checkInSnapshot || null,
          items: [],
        });
      }
      map.get(key)!.items.push(r);
    });
    return Array.from(map.values()).sort((a, b) => {
      const aTime = a.items[0]?.scannedAt || "";
      const bTime = b.items[0]?.scannedAt || "";
      return bTime.localeCompare(aTime);
    });
  }, [items]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await medicineCloud.listMyRecords({ limit: 50 });
      if (r) {
        setItems(r.items);
        setTotal(r.total);
      }
    } catch (e) {
      console.warn("[my-medicines] load failed", e);
    }
    setLoading(false);
  };

  useLoad(() => {
    void load();
  });
  useDidShow(() => {
    void load();
  });

  const handleScan = async () => {
    if (scanning) {
      return;
    }
    setScanning(true);
    try {
      const r = await Taro.scanCode({
        scanType: ["barCode", "qrCode", "datamatrix", "pdf417"],
        onlyFromCamera: false,
      });
      const gsString = r.result;
      if (!gsString) {
        Taro.showToast({ title: "未识别到二维码", icon: "none" });
        setScanning(false);
        return;
      }
      console.log("[my-medicines] scanned raw:", gsString);
      const res = await medicineCloud.scan(gsString);
      if (!res || !res.ok) {
        const code = res?.code;
        if (code === "PARSE_FAILED") {
          Taro.showModal({
            title: "扫到内容 · 但不是 GS1",
            content: `原始码:\n${gsString.slice(0, 120)}\n\n长度: ${gsString.length}\n\n截图发给开发者扩展支持`,
            showCancel: false,
            confirmText: "知道了",
          });
          setScanning(false);
          return;
        }
        Taro.showToast({ title: `扫码失败 ${code || ""}`, icon: "none" });
        setScanning(false);
        return;
      }
      const name = res.medicine?.name || (res.isPending ? "待补充信息" : "未知");
      Taro.showToast({
        title: res.isPending ? `${name} 已记录 · 等管理员补全` : `${name} 已记录`,
        icon: "success",
        duration: 2000,
      });
      await load();
    } catch (e: any) {
      if (e?.errMsg?.includes("cancel")) {
        // 用户取消 · 静默
      } else {
        console.warn("[my-medicines] scan failed", e);
        Taro.showToast({ title: "扫码失败 · 检查权限", icon: "none" });
      }
    }
    setScanning(false);
  };

  return (
    <PageWrapper navTitle="药品档案" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
      <View className="min-h-screen bg-kd-paper pb-32">
        {/* eyebrow + 大标题 */}
        <View className="px-6 pb-4 pt-6">
          <Text
            className="block"
            style={{
              fontSize: "10px",
              letterSpacing: "0.34em",
              textTransform: "uppercase",
              color: "#864D39",
              fontWeight: 600,
              marginBottom: "10px",
            }}
          >
            MEDICINE · 药品档案
          </Text>
          <Text
            className="kd-display block"
            style={{
              fontSize: "26px",
              lineHeight: 1.2,
              fontWeight: 500,
              color: "var(--kd-brown-900)",
              letterSpacing: "-0.01em",
            }}
          >
            你的每一次治疗 · 都被记下
          </Text>
          <Text
            className="block"
            style={{
              marginTop: "8px",
              fontSize: "11.5px",
              color: "var(--kd-brown-600)",
              letterSpacing: "0.04em",
              lineHeight: 1.6,
            }}
          >
            扫一扫医疗器械/药品包装上的二维码 · 自动归档到当次治疗
          </Text>
        </View>

        {/* 扫一扫主按钮 · 上方 */}
        <View className="mt-3 px-6">
          <Button
            onClick={handleScan}
            disabled={scanning}
            style={{
              width: "100%",
              height: "56px",
              borderRadius: "999px",
              background: "var(--kd-brown-900)",
              color: "var(--kd-paper)",
              fontFamily: "var(--kd-font-sans)",
              fontSize: "15px",
              fontWeight: 600,
              letterSpacing: "0.04em",
              border: "none",
              lineHeight: "56px",
              padding: 0,
              boxShadow: "0 6px 20px rgba(61,36,24,0.16)",
              opacity: scanning ? 0.6 : 1,
            }}
          >
            {scanning ? "扫码中…" : "📷 扫一扫记录"}
          </Button>
        </View>

        {/* 总数 stats */}
        <View
          className="mx-6 mt-5"
          style={{
            padding: "12px 14px",
            background: "#F5EDE3",
            borderRadius: "4px",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ fontSize: "11px", letterSpacing: "0.18em", color: "var(--kd-brown-600)" }}>
            已记录
          </Text>
          <Text style={{ fontFamily: "var(--kd-font-display)", fontSize: "15px", fontWeight: 500, color: "var(--kd-brown-900)" }}>
            {total.toLocaleString("zh-CN")}
            {" "}
            条
          </Text>
        </View>

        {/* 按到店打卡聚合的治疗档案 */}
        <View className="mt-6">
          {loading ? (
            <View className="text-center" style={{ padding: "40px 0", color: "var(--kd-brown-600)" }}>
              <Text style={{ fontSize: "13px" }}>加载中…</Text>
            </View>
          ) : items.length === 0 ? (
            <View className="mx-6 text-center" style={{ padding: "40px 0" }}>
              <Text className="block" style={{ fontSize: "13px", color: "var(--kd-brown-600)" }}>
                还没有扫码记录
              </Text>
              <Text className="mt-2 block" style={{ fontSize: "11px", color: "var(--kd-brown-500)" }}>
                点上方「扫一扫记录」开始
              </Text>
            </View>
          ) : (
            groupedTreatments.map(group => (
              <View
                key={group.key}
                className="mx-6 mb-5"
                style={{
                  background: "var(--white)",
                  borderRadius: "14px",
                  padding: "16px 16px 14px",
                  border: "1px solid rgba(61,36,24,0.06)",
                }}
              >
                {/* 卡片头 · 到店打卡信息 */}
                <View style={{ paddingBottom: "12px", borderBottom: "1px solid var(--kd-hairline)" }}>
                  {group.checkInId ? (
                    <>
                      <Text
                        className="block"
                        style={{
                          fontSize: "9.5px",
                          letterSpacing: "0.24em",
                          color: "#864D39",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          marginBottom: "4px",
                        }}
                      >
                        VISIT · 到店治疗
                      </Text>
                      <View style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <Text
                          className="kd-display"
                          style={{ fontSize: "15px", color: "var(--kd-brown-900)", fontWeight: 500 }}
                        >
                          {group.checkIn?.dateStr || "到店治疗"}
                        </Text>
                        <Text style={{ fontSize: "10.5px", color: "var(--kd-brown-600)" }}>
                          {group.checkIn?.checkedInAt ? fmtDateTime(group.checkIn.checkedInAt) : "—"}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text
                        className="block"
                        style={{
                          fontSize: "9.5px",
                          letterSpacing: "0.24em",
                          color: "#937761",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          marginBottom: "4px",
                        }}
                      >
                        OTHER · 散单
                      </Text>
                      <Text
                        className="kd-display"
                        style={{ fontSize: "15px", color: "var(--kd-brown-900)", fontWeight: 500 }}
                      >
                        未关联到店打卡
                      </Text>
                    </>
                  )}
                  <Text
                    className="mt-2 block"
                    style={{ fontSize: "10.5px", color: "var(--kd-brown-600)", letterSpacing: "0.04em" }}
                  >
                    共
                    {" "}
                    {group.items.length}
                    {" "}
                    支
                  </Text>
                </View>

                {/* 药品清单 · 紧凑版 */}
                {group.items.map((r) => {
                  const expire = fmtExpireBadge(r.expireDate);
                  return (
                    <View
                      key={r._id}
                      style={{ paddingTop: "12px", paddingBottom: "8px", borderBottom: "1px dashed var(--kd-hairline)" }}
                    >
                      <View style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <Text
                          style={{
                            fontSize: "13.5px",
                            color: "var(--kd-brown-900)",
                            fontWeight: 500,
                          }}
                        >
                          💉
                          {" "}
                          {r.name || "待补充信息"}
                        </Text>
                        {r.pending && (
                          <Text style={{
                            fontSize: "9.5px",
                            padding: "1px 5px",
                            background: "#F5EDE3",
                            color: "#864D39",
                            borderRadius: "3px",
                          }}
                          >
                            待补充
                          </Text>
                        )}
                      </View>

                      {(r.spec || r.registrantName) && (
                        <Text
                          className="mt-1 block"
                          style={{ fontSize: "10.5px", color: "var(--kd-brown-600)" }}
                        >
                          {[r.spec, r.registrantName].filter(Boolean).join(" · ")}
                        </Text>
                      )}

                      <View style={{ marginTop: "5px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        {r.batchNo && (
                          <Text style={{ fontSize: "10px", color: "var(--kd-brown-700)", fontFamily: "Menlo, monospace" }}>
                            批号
                            {" "}
                            {r.batchNo}
                          </Text>
                        )}
                        {r.sn && (
                          <Text style={{ fontSize: "10px", color: "var(--kd-brown-700)", fontFamily: "Menlo, monospace" }}>
                            SN
                            {" "}
                            {r.sn}
                          </Text>
                        )}
                        {expire && (
                          <Text style={{ fontSize: "10px", color: expire.color }}>
                            {expire.text}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}

                <View style={{ paddingTop: "8px" }}>
                  <Text style={{ fontSize: "9.5px", color: "var(--kd-brown-500)", letterSpacing: "0.04em" }}>
                    最近扫码
                    {" "}
                    {fmtDateTime(group.items[0]?.scannedAt || "")}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </View>
    </PageWrapper>
  );
}
