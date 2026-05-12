const { mockCloud } = require("../../cloudfunctions/_shared_test_utils/test-helpers");

describe("feedPet", () => {
  let feedPet, mockDb, cloud;

  beforeEach(() => {
    jest.resetModules();
    ({ mockDb, cloud } = mockCloud("test_openid_001"));
    feedPet = require("../../cloudfunctions/feedPet/index.js");
  });

  it("rejects when sku does not exist", async () => {
    mockDb.collection.mockImplementation(_name => ({
      doc: _id => ({
        get: jest.fn().mockRejectedValue(new Error("document not exist")),
      }),
    }));
    const r = await feedPet.main({ skuId: "nonexistent" });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("SKU_NOT_FOUND");
  });

  it("handles multi-level jump from Lv1 with large feed", async () => {
    // 大宠粮 250 经验 → Lv1 (0) + 250 = ?
    // Lv1→2 需 80 · 250 >= 80 → newLevel=2 余 170 经验
    // Lv2→3 需 320 · 170 < 320 · stop · 余 170
    const sku = { type: "pet_food", status: "on_shelf", pointsPrice: 500, priceFen: 50000, experience: 250, charityRatio: 0.7, name: "大袋" };
    const pet = { _id: "test_openid_001", level: 1, experience: 0, totalContributionFen: 0, ownedSpeciesIds: ["cat_orange"] };

    mockDb.collection.mockImplementation(name => ({
      doc: () => ({
        get: jest.fn().mockResolvedValue({ data: name === "sku" ? sku : pet }),
        update: jest.fn().mockResolvedValue({}),
      }),
      where: () => ({
        limit: () => ({ get: jest.fn().mockResolvedValue({ data: [{ _id: "xuzhou_animal_rescue" }] }) }),
        get: jest.fn().mockResolvedValue({ data: [] }),
      }),
      add: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue({ total: 0 }),
    }));
    cloud.callFunction.mockResolvedValue({ result: { ok: true, balanceAfter: 1500, logId: "log_001" } });

    const r = await feedPet.main({ skuId: "sku_pet_food_large" });

    expect(r.ok).toBe(true);
    expect(r.newLevel).toBe(2);
    expect(r.levelUps).toEqual([2]);
    expect(r.charityAddedFen).toBe(35000);
  });

  it("grants bronze badge when reaching Lv8", async () => {
    // Lv7 经验 5950 + 中袋 80 = 6030 → Lv7→8 阈值 6000 · 通过 · 余 30
    const sku = { type: "pet_food", status: "on_shelf", pointsPrice: 200, priceFen: 20000, experience: 80, charityRatio: 0.6, name: "中袋" };
    const pet = { _id: "test_openid_001", level: 7, experience: 5950, totalContributionFen: 0, ownedSpeciesIds: ["cat_orange"] };
    const bronzeBadge = { _id: "love_companion_bronze", tier: "bronze", unlock: { type: "pet_level", threshold: 8 } };

    mockDb.collection.mockImplementation((name) => {
      const handlers = {
        sku: { doc: () => ({ get: jest.fn().mockResolvedValue({ data: sku }) }), count: jest.fn().mockResolvedValue({ total: 0 }) },
        pet_state: { doc: () => ({ get: jest.fn().mockResolvedValue({ data: pet }), update: jest.fn().mockResolvedValue({}) }), count: jest.fn().mockResolvedValue({ total: 0 }) },
        charity_ledger: { add: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue({ total: 0 }) },
        charity_org: { where: () => ({ limit: () => ({ get: jest.fn().mockResolvedValue({ data: [{ _id: "org_001" }] }) }) }) },
        badge_def: { where: () => ({ get: jest.fn().mockResolvedValue({ data: [bronzeBadge] }) }) },
        user_badge: {
          where: () => ({ limit: () => ({ get: jest.fn().mockResolvedValue({ data: [] }) }) }),
          add: jest.fn().mockResolvedValue({}),
          count: jest.fn().mockResolvedValue({ total: 0 }),
        },
      };
      return handlers[name];
    });
    cloud.callFunction.mockResolvedValue({ result: { ok: true, balanceAfter: 800, logId: "log_002" } });

    const r = await feedPet.main({ skuId: "sku_pet_food_medium" });

    expect(r.ok).toBe(true);
    expect(r.newLevel).toBe(8);
    expect(r.levelUps).toEqual([8]);
    expect(r.newBadges).toEqual(["love_companion_bronze"]);
  });
});
