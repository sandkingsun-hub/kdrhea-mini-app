// medicineCloud · 药品扫码模块云函数 wrapper · skill R2/R4 合规
export interface ScannedMedicine {
  name: string;
  productName?: string;
  registrantName?: string;
  registerNo?: string;
  spec?: string;
  status?: "complete" | "pending";
}

export interface CheckInSnapshot {
  dateStr?: string;
  checkedInAt?: string;
  staffOpenid?: string;
  pointsGranted?: number;
}

export interface MedicineRecord {
  _id: string;
  medicineKey: string;
  codeType: "GTIN" | "DRUG_CODE";
  name: string;
  registrantName?: string;
  registerNo?: string;
  spec?: string;
  pending: boolean;
  batchNo?: string | null;
  expireDate?: string | null;
  sn?: string | null;
  mfgDate?: string | null;
  checkInId?: string | null;
  checkInSnapshot?: CheckInSnapshot | null;
  scannedAt: string;
}

async function call<T = any>(name: string, data: Record<string, unknown> = {}): Promise<T | null> {
  try {
    // @ts-expect-error wx 由微信运行时注入 · TS 不识别
    if (typeof wx === "undefined" || !wx.cloud) {
      return null;
    }
    // @ts-expect-error wx.cloud.callFunction 由微信注入
    const r = await wx.cloud.callFunction({ name, data });
    return (r as { result: T }).result;
  } catch (e) {
    console.warn(`[medicineCloud] ${name} failed:`, e);
    return null;
  }
}

export interface CustomerCandidate {
  openid: string;
  nickname?: string | null;
  phoneMasked?: string | null;
  avatarUrl?: string | null;
  latestAppointment?: {
    _id: string;
    serviceName?: string | null;
    status?: string;
    appointmentTime?: string | null;
  } | null;
}

export const medicineCloud = {
  async scan(gsString: string, opts?: { customerOpenid?: string }) {
    return call<{
      ok: boolean;
      code?: string;
      message?: string;
      treatmentMedicineId?: string;
      medicine?: ScannedMedicine;
      batchInfo?: {
        batchNo?: string | null;
        expireDate?: string | null;
        sn?: string | null;
        mfgDate?: string | null;
      };
      checkInId?: string | null;
      checkInSnapshot?: CheckInSnapshot | null;
      isPending?: boolean;
      mode?: "self" | "staff_proxy";
    }>("scanMedicine", {
      gsString,
      customerOpenid: opts?.customerOpenid,
    });
  },

  async listMyRecords(opts?: { limit?: number; skip?: number; checkInId?: string }) {
    const r = await call<{ ok: boolean; items?: MedicineRecord[]; total?: number }>(
      "listMyMedicineRecords",
      opts || {},
    );
    if (r?.ok) {
      return { items: r.items || [], total: r.total || 0 };
    }
    return null;
  },

  // staff 用 · 按姓名/手机号搜顾客
  async searchCustomers(query: { name?: string; phone?: string; limit?: number }) {
    return call<{ ok: boolean; code?: string; items?: CustomerCandidate[] }>(
      "staffSearchCustomers",
      query,
    );
  },
};
