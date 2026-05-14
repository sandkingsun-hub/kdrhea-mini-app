// charityCloud · 公益认领模块的云函数 wrapper
// 严格遵守 wechat-miniprogram-dev skill R2/R4:
//   - 用 wx.cloud.callFunction · 禁 Taro.cloud
//   - 全部 try/catch · 防 wx.cloud 未初始化的 rejection 引发白屏

export interface CharityCard {
  _id: string;
  name: string;
  description: string;
  tagline: string;
  story: string;
  story_preview: string;
  featured: boolean;
  pointsPrice: number;
  donatedFen: number;
  imageUrl: string | null;
  sortOrder: number;
}

export interface CharityStats {
  totalClaims: number;
  totalDonatedFen: number;
  configCharityRatio: string;
}

export interface CharityClaim {
  _id: string;
  cardId: string;
  cardSnapshot: {
    name: string;
    description: string;
    story: string;
    pointsPrice: number;
    donatedFen: number;
    imageUrl: string | null;
  };
  pointsSpent: number;
  donatedFen: number;
  sn: string;
  claimedAt: string;
  shareCount: number;
  claimerNickname?: string;
}

async function call<T = any>(name: string, data: Record<string, unknown> = {}): Promise<T | null> {
  try {
    // @ts-expect-error wx 由微信运行时注入·TS 不识别
    if (typeof wx === "undefined" || !wx.cloud) {
      return null;
    }
    // @ts-expect-error wx.cloud.callFunction 由微信注入
    const r = await wx.cloud.callFunction({ name, data });
    return (r as { result: T }).result;
  } catch (e) {
    console.warn(`[charityCloud] ${name} failed:`, e);
    return null;
  }
}

export const charityCloud = {
  async listCards(): Promise<{ items: CharityCard[]; total: number } | null> {
    const r = await call<{ ok: boolean; items: CharityCard[]; total: number }>("listCharityCards", { limit: 50 });
    if (r?.ok) {
      return { items: r.items, total: r.total };
    }
    return null;
  },

  async getStats(): Promise<CharityStats | null> {
    const r = await call<CharityStats & { ok: boolean }>("getCharityStats");
    if (r?.ok) {
      return {
        totalClaims: r.totalClaims,
        totalDonatedFen: r.totalDonatedFen,
        configCharityRatio: r.configCharityRatio,
      };
    }
    return null;
  },

  async claimCard(cardId: string): Promise<{ ok: boolean; claimId?: string; sn?: string; code?: string } | null> {
    return call("claimCharityCard", { cardId });
  },

  async myClaims(): Promise<{ items: CharityClaim[]; total: number; totalPointsSpent: number; totalDonatedFen: number } | null> {
    const r = await call<{ ok: boolean; items: CharityClaim[]; total: number; totalPointsSpent: number; totalDonatedFen: number }>("getMyCharityClaims", { limit: 50 });
    if (r?.ok) {
      return {
        items: r.items,
        total: r.total,
        totalPointsSpent: r.totalPointsSpent,
        totalDonatedFen: r.totalDonatedFen,
      };
    }
    return null;
  },

  async getClaimDetail(claimId: string): Promise<{ claim: CharityClaim; isOwner: boolean } | null> {
    const r = await call<{ ok: boolean; claim: CharityClaim; isOwner: boolean }>("getCharityClaimDetail", { claimId });
    if (r?.ok) {
      return { claim: r.claim, isOwner: r.isOwner };
    }
    return null;
  },

  async genShareLink(claimId: string): Promise<{ shortCode: string; path: string } | null> {
    const r = await call<{ ok: boolean; shortCode: string; path: string }>("genCharityShareLink", { claimId });
    if (r?.ok) {
      return { shortCode: r.shortCode, path: r.path };
    }
    return null;
  },

  async getMyAccount(): Promise<{ balance: number } | null> {
    const r = await call<{ ok: boolean; account: { balance: number } }>("getMyAccount", { logsLimit: 1 });
    if (r?.ok && r.account) {
      return { balance: r.account.balance };
    }
    return null;
  },
};
