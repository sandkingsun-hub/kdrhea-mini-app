import type { PetFoodSku, PetPanel, PetSkin, PetSpecies } from "~/types/pet";
import Taro from "@tarojs/taro";

async function call<T>(name: string, data?: Record<string, unknown>): Promise<T> {
  // @ts-expect-error Taro Type · wx.cloud injected at runtime
  const r = await Taro.cloud.callFunction({ name, data: data || {} });
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
