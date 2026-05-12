import type { PetFoodSku, PetPanel, PetSkin, PetSpecies } from "~/types/pet";

// 与项目其他页面一致 · 用 wx.cloud（不是 Taro.cloud · Taro 无 cloud namespace 包装）
async function call<T>(name: string, data?: Record<string, unknown>): Promise<T> {
  // @ts-expect-error wx 由微信运行时注入·TS 不识别
  if (typeof wx === "undefined" || !wx.cloud) {
    return { ok: false, code: "NO_WX_CLOUD" } as unknown as T;
  }
  // @ts-expect-error wx.cloud.callFunction 由微信注入
  const r = await wx.cloud.callFunction({ name, data: data || {} });
  return (r as { result: T }).result;
}

export const petCloud = {
  getPanel: () => call<{ ok: boolean } & PetPanel>("getPetPanel"),
  listSpecies: () => call<{ ok: boolean; items: PetSpecies[] }>("listPetSpecies"),
  listSkins: (speciesId?: string) => call<{ ok: boolean; items: PetSkin[] }>("listPetSkins", { speciesId }),
  listFoodSku: () => call<{ ok: boolean; items: PetFoodSku[] }>("listPetFoodSku"),
  feed: (skuId: string) =>
    call<{
      ok: boolean;
      code?: string;
      newLevel: number;
      levelUps: number[];
      newBadges: string[];
      charityAddedFen: number;
      pointsAfter: number;
    }>("feedPet", { skuId }),
  switchPet: (speciesId: string) => call<{ ok: boolean; code?: string }>("switchPet", { speciesId }),
  switchSkin: (skinId: string | null) => call<{ ok: boolean; code?: string }>("switchSkin", { skinId }),
  generateShareLog: (snapshot: Record<string, unknown>) =>
    call<{ ok: boolean; logId: string }>("generateShareCardLog", { snapshot }),
};
