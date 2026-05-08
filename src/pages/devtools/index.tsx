// 开发者调试页 · 上线前删除
// 路径：/pages/devtools/index
import { Text, View } from "@tarojs/components";
import { useState } from "react";
import PageWrapper from "~/components/PageWrapper";

export default function Devtools() {
  const [result, setResult] = useState<string>("");

  const callCloud = async (name: string, data?: any) => {
    setResult(`调用 ${name}…`);
    try {
      // @ts-expect-error wx 由微信运行时注入·TS 不识别
      if (typeof wx === "undefined" || !wx.cloud) {
        setResult("错误：非小程序环境");
        return;
      }
      // @ts-expect-error wx.cloud.callFunction 由微信注入
      const r = await wx.cloud.callFunction({ name, data });
      setResult(`[${name}]\n${JSON.stringify(r.result, null, 2)}`);
    } catch (e: any) {
      setResult(`异常 ${name}: ${e?.message || String(e)}`);
    }
  };

  const buttons: { label: string; bg: string; onClick: () => void }[] = [
    { label: "login", bg: "bg-blue-500", onClick: () => callCloud("login") },
    {
      label: "getMyAccount",
      bg: "bg-purple-500",
      onClick: () => callCloud("getMyAccount", { logsLimit: 5 }),
    },
    {
      label: "+500 (earn)",
      bg: "bg-green-500",
      onClick: () =>
        callCloud("earnPoints", {
          delta: 500,
          type: "earn_self_consume",
          description: "[devtools] +500",
        }),
    },
    {
      label: "-200 (spend)",
      bg: "bg-orange-500",
      onClick: () =>
        callCloud("spendPoints", {
          delta: 200,
          type: "spend_deduct",
          description: "[devtools] -200",
        }),
    },
    {
      label: "listSku",
      bg: "bg-teal-500",
      onClick: () => callCloud("listSku", { limit: 10 }),
    },
    {
      label: "listMyOrders",
      bg: "bg-pink-500",
      onClick: () => callCloud("listMyOrders", { limit: 5 }),
    },
    {
      label: "generateRefLink",
      bg: "bg-indigo-500",
      onClick: () => callCloud("generateReferralLink", { channel: "direct_share" }),
    },
    {
      label: "settlePending",
      bg: "bg-yellow-600",
      onClick: () => callCloud("settlePendingPoints", { dryRun: true }),
    },
  ];

  return (
    <PageWrapper navTitle="开发者工具" className="h-full" shouldShowBottomActions={false}>
      <View className="p-4">
        <View className="mb-3 text-xs text-gray-500">⚠️ 仅 dev 阶段 · 上线前删除</View>

        <View className="grid grid-cols-2 mb-4 gap-2">
          {buttons.map(b => (
            <View
              key={b.label}
              className={`rounded-lg ${b.bg} p-3 text-center text-xs text-white`}
              onClick={b.onClick}
            >
              {b.label}
            </View>
          ))}
        </View>

        {result && (
          <View className="overflow-auto rounded-lg bg-gray-50 p-3" style={{ maxHeight: "60vh" }}>
            <Text className="whitespace-pre text-xs font-mono">{result}</Text>
          </View>
        )}
      </View>
    </PageWrapper>
  );
}
