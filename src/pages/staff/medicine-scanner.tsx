import type { CustomerCandidate } from "~/lib/medicineCloud";
// 员工扫药工具 · 仅 staff/admin 可用
// 流程:
//   Step 1 · 绑定顾客（三选一: 扫会员码 / 搜姓名 / 搜手机号）
//   Step 2 · 连续扫药 · 一支接一支全归到该顾客同一次预约
//   Step 3 · 完成收尾 · 「换顾客」回 Step 1
import { Button, Input, Text, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useState } from "react";
import PageWrapper from "~/components/PageWrapper";
import { medicineCloud } from "~/lib/medicineCloud";

interface ScannedItem {
  treatmentMedicineId: string;
  medicineName: string;
  isPending: boolean;
  batchNo?: string | null;
  expireDate?: string | null;
  sn?: string | null;
}

type BindMethod = "scan" | "name" | "phone";

function callCloud<T = any>(name: string, data?: any): Promise<T | null> {
  try {
    // @ts-expect-error wx 由微信运行时注入
    if (typeof wx === "undefined" || !wx.cloud) {
      return Promise.resolve(null);
    }
    // @ts-expect-error wx.cloud.callFunction 由微信注入
    return wx.cloud.callFunction({ name, data }).then((r: any) => r.result).catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
}

export default function StaffMedicineScanner() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [bindMethod, setBindMethod] = useState<BindMethod>("scan");
  const [searchInput, setSearchInput] = useState("");
  const [candidates, setCandidates] = useState<CustomerCandidate[]>([]);
  const [searching, setSearching] = useState(false);

  const [boundCustomer, setBoundCustomer] = useState<CustomerCandidate | null>(null);
  const [scanned, setScanned] = useState<ScannedItem[]>([]);
  const [scanning, setScanning] = useState(false);

  useLoad(async () => {
    const lg = await callCloud<{ user?: { role?: string } }>("login");
    const role = lg?.user?.role || "customer";
    setAuthorized(role === "staff" || role === "admin");
  });

  // ===== Step 1: 绑定顾客 =====

  const handleScanCustomerCode = async () => {
    try {
      const r = await Taro.scanCode({ scanType: ["qrCode"] });
      const result = r.result || "";
      if (!result) {
        Taro.showToast({ title: "未识别", icon: "none" });
        return;
      }
      // 扫到的是顾客 openid · 直接构造一个 candidate
      // 或者后端有解码逻辑·我们简单做：openid 直接拿
      setBoundCustomer({
        openid: result,
        nickname: "（扫码绑定）",
        phoneMasked: null,
        latestAppointment: null,
      });
      setScanned([]);
    } catch {
      Taro.showToast({ title: "扫码取消", icon: "none" });
    }
  };

  const handleSearch = async () => {
    const trimmed = searchInput.trim();
    if (!trimmed) {
      Taro.showToast({ title: "请输入搜索词", icon: "none" });
      return;
    }
    setSearching(true);
    const query = bindMethod === "phone" ? { phone: trimmed } : { name: trimmed };
    const r = await medicineCloud.searchCustomers(query);
    setSearching(false);
    if (!r || !r.ok) {
      Taro.showToast({ title: `搜索失败 ${r?.code || ""}`, icon: "none" });
      return;
    }
    setCandidates(r.items || []);
    if ((r.items || []).length === 0) {
      Taro.showToast({ title: "没找到", icon: "none" });
    }
  };

  const handlePickCustomer = (c: CustomerCandidate) => {
    setBoundCustomer(c);
    setCandidates([]);
    setSearchInput("");
    setScanned([]);
  };

  const handleSwitchCustomer = () => {
    setBoundCustomer(null);
    setCandidates([]);
    setSearchInput("");
    setScanned([]);
  };

  // ===== Step 2: 扫药 =====

  const handleScanMedicine = async () => {
    if (!boundCustomer || scanning) {
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
        Taro.showToast({ title: "未识别二维码", icon: "none" });
        return;
      }
      console.log("[staff-medicine-scanner] scanned raw:", gsString);
      const res = await medicineCloud.scan(gsString, { customerOpenid: boundCustomer.openid });
      if (!res || !res.ok) {
        const code = res?.code;
        if (code === "PARSE_FAILED") {
          // 显示扫到的实际内容 · 用于诊断码格式
          Taro.showModal({
            title: "扫到内容 · 但不是 GS1",
            content: `原始码:\n${gsString.slice(0, 120)}\n\n长度: ${gsString.length}\n\n截图发给开发者扩展支持`,
            showCancel: false,
            confirmText: "知道了",
          });
          return;
        }
        let msg = `失败 ${code || ""}`;
        if (code === "FORBIDDEN") {
          msg = "无权限 · 仅员工可代扫";
        } else if (code === "MISSING_GS_STRING") {
          msg = "码为空";
        }
        Taro.showToast({ title: msg, icon: "none" });
        return;
      }
      const name = res.medicine?.name || (res.isPending ? "待补充信息" : "未知");
      setScanned(prev => [{
        treatmentMedicineId: res.treatmentMedicineId || "",
        medicineName: name,
        isPending: !!res.isPending,
        batchNo: res.batchInfo?.batchNo,
        expireDate: res.batchInfo?.expireDate,
        sn: res.batchInfo?.sn,
      }, ...prev]);
      Taro.showToast({
        title: res.isPending ? `${name} 已记录 · 待补全` : `${name} 已记录`,
        icon: "success",
        duration: 1500,
      });
    } catch (e: any) {
      if (!String(e?.errMsg || "").includes("cancel")) {
        Taro.showToast({ title: "扫码失败", icon: "none" });
      }
    } finally {
      setScanning(false);
    }
  };

  const handleFinish = () => {
    Taro.showModal({
      title: `本次共扫 ${scanned.length} 支`,
      content: `已全部归到「${boundCustomer?.nickname || "该顾客"}」名下 · 是否结束并清空？`,
      confirmText: "结束",
      cancelText: "继续",
    }).then((m) => {
      if (m.confirm) {
        setBoundCustomer(null);
        setScanned([]);
        setCandidates([]);
        Taro.showToast({ title: "已结束", icon: "success" });
      }
    });
  };

  // ===== 渲染 =====

  if (authorized === null) {
    return (
      <PageWrapper navTitle="员工扫药" className="h-full" shouldShowBottomActions={false}>
        <View className="p-8 text-center" style={{ color: "#937761" }}>验证身份…</View>
      </PageWrapper>
    );
  }
  if (authorized === false) {
    return (
      <PageWrapper navTitle="员工扫药" className="h-full" shouldShowBottomActions={false}>
        <View className="p-8 text-center" style={{ color: "#937761" }}>
          <Text style={{ fontSize: "13px" }}>本工具仅限员工使用</Text>
        </View>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper navTitle="员工扫药" className="h-full bg-kd-paper" shouldShowBottomActions={false}>
      <View className="min-h-screen bg-kd-paper pb-32">
        {/* 顶部 eyebrow + 标题 */}
        <View className="px-6 pb-3 pt-6">
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
            STAFF · 员工扫药
          </Text>
          <Text
            className="kd-display block"
            style={{
              fontSize: "22px",
              lineHeight: 1.25,
              fontWeight: 500,
              color: "var(--kd-brown-900)",
              letterSpacing: "-0.01em",
            }}
          >
            {boundCustomer ? "扫码记录治疗用药" : "先绑定顾客"}
          </Text>
        </View>

        {/* Step 1: 顾客绑定 */}
        {!boundCustomer && (
          <View className="mt-3 px-6">
            {/* 三选一 tab */}
            <View style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
              {([
                { key: "scan", label: "扫会员码" },
                { key: "name", label: "搜姓名" },
                { key: "phone", label: "搜手机" },
              ] as { key: BindMethod; label: string }[]).map(t => (
                <View
                  key={t.key}
                  onClick={() => {
                    setBindMethod(t.key);
                    setCandidates([]);
                    setSearchInput("");
                  }}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    textAlign: "center",
                    fontSize: "12px",
                    letterSpacing: "0.06em",
                    background: bindMethod === t.key ? "#3D2418" : "transparent",
                    color: bindMethod === t.key ? "#FBF7F1" : "#5A4A3A",
                    border: "1px solid #D9CCBC",
                    borderRadius: "999px",
                  }}
                >
                  {t.label}
                </View>
              ))}
            </View>

            {/* 扫会员码 */}
            {bindMethod === "scan" && (
              <Button
                onClick={handleScanCustomerCode}
                style={{
                  width: "100%",
                  height: "52px",
                  borderRadius: "999px",
                  background: "var(--kd-brown-900)",
                  color: "var(--kd-paper)",
                  fontSize: "14px",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  border: "none",
                  lineHeight: "52px",
                  padding: 0,
                }}
              >
                📷 扫顾客会员码
              </Button>
            )}

            {/* 搜姓名 / 搜手机 */}
            {(bindMethod === "name" || bindMethod === "phone") && (
              <View>
                <View style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <Input
                    type={bindMethod === "phone" ? "number" : "text"}
                    value={searchInput}
                    onInput={e => setSearchInput((e.detail as any).value || "")}
                    placeholder={bindMethod === "phone" ? "手机号（部分即可）" : "姓名（部分即可）"}
                    maxlength={bindMethod === "phone" ? 11 : 20}
                    style={{
                      flex: 1,
                      height: "44px",
                      padding: "0 14px",
                      background: "#FFFFFF",
                      border: "1px solid #D9CCBC",
                      borderRadius: "10px",
                      fontSize: "13px",
                    }}
                  />
                  <Button
                    onClick={handleSearch}
                    disabled={searching}
                    style={{
                      width: "80px",
                      height: "44px",
                      padding: 0,
                      background: "#3D2418",
                      color: "#FBF7F1",
                      borderRadius: "10px",
                      fontSize: "13px",
                      lineHeight: "44px",
                      border: "none",
                      opacity: searching ? 0.6 : 1,
                    }}
                  >
                    {searching ? "…" : "搜索"}
                  </Button>
                </View>

                {/* 搜索结果 */}
                {candidates.length > 0 && (
                  <View className="mt-4">
                    {candidates.map(c => (
                      <View
                        key={c.openid}
                        onClick={() => handlePickCustomer(c)}
                        style={{
                          padding: "14px 16px",
                          marginBottom: "8px",
                          background: "#FFFFFF",
                          border: "1px solid #E8DFD4",
                          borderRadius: "10px",
                        }}
                      >
                        <View style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={{ fontSize: "14px", color: "#3C2218", fontWeight: 500 }}>
                            {c.nickname || "未知姓名"}
                          </Text>
                          <Text style={{ fontSize: "11px", color: "#937761", fontFamily: "Menlo, monospace" }}>
                            {c.phoneMasked || "—"}
                          </Text>
                        </View>
                        {c.latestAppointment && (
                          <Text className="mt-2 block" style={{ fontSize: "11px", color: "#864D39" }}>
                            📋 最近预约 ·
                            {" "}
                            {c.latestAppointment.serviceName || "未命名"}
                            {" "}
                            ·
                            {" "}
                            {c.latestAppointment.status}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Step 2: 已绑定 · 显示当前顾客 + 扫药 */}
        {boundCustomer && (
          <>
            {/* sticky 顾客信息条 */}
            <View
              className="mx-6"
              style={{
                padding: "14px 16px",
                background: "#F5EDE3",
                borderRadius: "10px",
                marginTop: "8px",
              }}
            >
              <View style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text className="block" style={{ fontSize: "10px", letterSpacing: "0.18em", color: "#864D39" }}>
                    BOUND · 当前顾客
                  </Text>
                  <Text className="mt-1 block" style={{ fontSize: "15px", color: "#3C2218", fontWeight: 500 }}>
                    {boundCustomer.nickname || "未知"}
                    {boundCustomer.phoneMasked && (
                      <Text style={{ fontSize: "11px", color: "#864D39", marginLeft: "8px", fontFamily: "Menlo, monospace" }}>
                        {boundCustomer.phoneMasked}
                      </Text>
                    )}
                  </Text>
                  {boundCustomer.latestAppointment && (
                    <Text className="mt-1 block" style={{ fontSize: "10.5px", color: "#864D39" }}>
                      📋
                      {" "}
                      {boundCustomer.latestAppointment.serviceName || "—"}
                      {" "}
                      ·
                      {" "}
                      {boundCustomer.latestAppointment.status}
                    </Text>
                  )}
                </View>
                <View
                  onClick={handleSwitchCustomer}
                  style={{
                    padding: "6px 10px",
                    border: "1px solid #864D39",
                    borderRadius: "999px",
                    fontSize: "11px",
                    color: "#864D39",
                  }}
                >
                  换顾客
                </View>
              </View>
            </View>

            {/* 扫药主按钮 */}
            <View className="mt-5 px-6">
              <Button
                onClick={handleScanMedicine}
                disabled={scanning}
                style={{
                  width: "100%",
                  height: "56px",
                  borderRadius: "999px",
                  background: "#3D2418",
                  color: "#FBF7F1",
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
                {scanning ? "扫码中…" : "📷 扫药品包装码"}
              </Button>
            </View>

            {/* 本次扫码记录 */}
            <View className="mt-6 px-6">
              <Text
                className="block"
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.24em",
                  color: "#864D39",
                  marginBottom: "12px",
                }}
              >
                THIS  SESSION  ·  本次已扫
                {" "}
                {scanned.length}
                {" "}
                支
              </Text>

              {scanned.length === 0 ? (
                <Text className="block" style={{ fontSize: "12px", color: "#937761", padding: "20px 0", textAlign: "center" }}>
                  点上方按钮开始扫第一支
                </Text>
              ) : (
                scanned.map((s, idx) => (
                  <View
                    key={s.treatmentMedicineId || idx}
                    style={{
                      padding: "12px 14px",
                      marginBottom: "8px",
                      background: "#FFFFFF",
                      border: "1px solid #E8DFD4",
                      borderRadius: "10px",
                    }}
                  >
                    <View style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Text style={{ fontSize: "14px", color: "#3C2218", fontWeight: 500 }}>
                        {s.medicineName}
                      </Text>
                      {s.isPending && (
                        <Text style={{
                          fontSize: "10px",
                          padding: "2px 6px",
                          background: "#F5EDE3",
                          color: "#864D39",
                          borderRadius: "4px",
                        }}
                        >
                          待补全
                        </Text>
                      )}
                    </View>
                    <View style={{ marginTop: "4px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                      {s.batchNo && (
                        <Text style={{ fontSize: "10.5px", color: "#5A4A3A", fontFamily: "Menlo, monospace" }}>
                          批号
                          {s.batchNo}
                        </Text>
                      )}
                      {s.sn && (
                        <Text style={{ fontSize: "10.5px", color: "#5A4A3A", fontFamily: "Menlo, monospace" }}>
                          SN
                          {s.sn}
                        </Text>
                      )}
                      {s.expireDate && (
                        <Text style={{ fontSize: "10.5px", color: "#864D39" }}>
                          有效期
                          {s.expireDate}
                        </Text>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* 完成按钮 */}
            {scanned.length > 0 && (
              <View className="mt-6 px-6">
                <Button
                  onClick={handleFinish}
                  style={{
                    width: "100%",
                    height: "44px",
                    borderRadius: "999px",
                    background: "#FBF7F1",
                    color: "#3D2418",
                    border: "1px solid #864D39",
                    fontSize: "13px",
                    fontWeight: 500,
                    letterSpacing: "0.04em",
                    lineHeight: "44px",
                    padding: 0,
                  }}
                >
                  完成本次治疗 · 共
                  {" "}
                  {scanned.length}
                  {" "}
                  支
                </Button>
              </View>
            )}
          </>
        )}
      </View>
    </PageWrapper>
  );
}
