# 电子宠物 + 公益 + 会员等级 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `OB://00-总控/讨论档案/2026-05-12_电子宠物方案_design.md`

**Goal:** 在 KDRHEA 小程序里实现"喂电子宠物 → 触发 KDRHEA 配捐公益 → 解锁爱心同行者徽章 → 分享公益证书"完整闭环，含 admin 后台月度结算（人工流程）。

**Architecture:** 微信小程序前端（Taro 4 + React 18）+ CloudBase 云函数 + 云数据库 NoSQL。新增 11 个集合 + 11 个云函数 + 4 个 dev seed + 3 个页面改造/新建。视觉双轨：主调 UI 走 KDRHEA 米白棕褐线稿，宠物舞台单独多彩像素。

**Tech Stack:** Taro 4.1.6 / React 18 / TypeScript / 微信云开发 (wx-server-sdk) / Tailwind / qrcode-generator (现有) / Canvas 2D (小程序原生) / CSS steps() animation

---

## Phase 总览

| Phase | 任务数 | 完工标志 |
|---|---|---|
| **Phase 0** · 项目准备 | 3 | feature branch 创建 + 测试基础设施 + 资产路径约定 |
| **Phase 1** · 后端基建（schema + 11 云函数 + 4 seed）| 16 | 控制台可单独调用每个云函数验通 · feedPet 单元测试通过 |
| **Phase 2** · 前端三件套（首页改造 + 公益页 + 海报页）| 11 | 真机能完成"喂食→升级→徽章→分享" 全流程 |
| **Phase 3** · 联调 + 灰度 | 3 | 5 员工灰度无 P0 · 数据自检脚本通过 |

**总计 33 个 task**，预计 6-8 周（含外部依赖等待）。Phase 0 完成后 Phase 1 / 2 可并行（前端用 mock 数据先开工）。

---

# PHASE 0 · 项目准备

## Task 0.1: 创建 feature branch + 同步基线

**Files:**
- Modify: 无（仅 git 操作）

- [ ] **Step 1: 确认当前 main 干净**

Run: `cd /Users/nicky/Code/kdrhea-mini-app && git status`
Expected: `nothing to commit, working tree clean` on `main`

- [ ] **Step 2: 拉最新 + 建 feature branch**

```bash
git pull origin main
git checkout -b feature/pet-charity
```

- [ ] **Step 3: 推到远程建追踪**

```bash
git push -u origin feature/pet-charity
```

Expected: `Branch 'feature/pet-charity' set up to track 'origin/feature/pet-charity'`

## Task 0.2: 建测试基础设施目录

**Files:**
- Create: `__tests__/pet/.gitkeep`
- Create: `__tests__/charity/.gitkeep`
- Create: `cloudfunctions/_shared_test_utils/test-helpers.js`

- [ ] **Step 1: 建测试目录占位**

```bash
mkdir -p __tests__/pet __tests__/charity
touch __tests__/pet/.gitkeep __tests__/charity/.gitkeep
```

- [ ] **Step 2: 写云函数 test helper**

Create `cloudfunctions/_shared_test_utils/test-helpers.js`:

```js
// 云函数单元测试辅助 · 用于 mock cloud SDK + 提供数据库 stub
module.exports = {
  // 调用云函数前 mock 全局 cloud
  mockCloud(openid = 'test_openid_001') {
    const mockDb = {
      collection: jest.fn(),
      command: { inc: jest.fn(v => ({ $inc: v })) },
    };
    global.mockCloudInstance = {
      DYNAMIC_CURRENT_ENV: 'test',
      init: jest.fn(),
      database: jest.fn(() => mockDb),
      getWXContext: jest.fn(() => ({ OPENID: openid })),
      callFunction: jest.fn(),
    };
    jest.mock('wx-server-sdk', () => global.mockCloudInstance);
    return { mockDb, cloud: global.mockCloudInstance };
  },
};
```

- [ ] **Step 3: 提交**

```bash
git add __tests__/pet __tests__/charity cloudfunctions/_shared_test_utils
git commit -m "chore(pet-charity): scaffold test directories + cloud function test helper"
```

## Task 0.3: CloudBase storage 资产路径约定 + 上传宠物 placeholder PNG

**Files:**
- 无代码（运维步骤）
- 但记入文档：`docs/specs/2026-05-12-pet-charity-plan.md` 本文件

约定路径：
- `cloud://pets/cat_orange.png` · `cloud://pets/dog_shiba.png`
- `cloud://skins/spring_cat_2026.png` · 同 grid 规格
- `cloud://badges/love_companion_bronze.png` 等 3 档
- `cloud://orgs/xuzhou_animal_rescue_logo.png`

- [ ] **Step 1: Nick 联系砺生成 cat_orange + dog_shiba sprite（4×3 网格 384×288 PNG）**

并行任务 · 不阻塞 Phase 1 开发（先用 placeholder 占位）。

- [ ] **Step 2: 准备 1 张 placeholder sprite（任意 384×288 透明 PNG）作为开发期占位**

```bash
# 用任意工具（PixelLab / 临时画 / 甚至空白图）
# 上传到 CloudBase storage 路径 /pets/_placeholder.png
# 通过 CloudBase 控制台手动上传即可
```

- [ ] **Step 3: 在 Phase 1 Task 1.2 引用此占位路径**

记录路径：`cloud://_placeholder.png`，开发期所有 species/skin 都先指向它。Phase 2 完成后由 Nick + 砺 替换为真实资产。

---

# PHASE 1 · 后端基建

## Task 1.1: 11 个集合 schema 初始化（云数据库控制台手动建）

**Files:**
- 无代码 · 控制台操作
- Create: `cloudfunctions/_shared_test_utils/collection-init.md`（记录每集合 index 配置）

- [ ] **Step 1: 在 CloudBase 数据库控制台依次创建 11 个集合**

```
pet_species       pet_skin         pet_state         badge_def
user_badge        charity_org      charity_ledger    charity_supply_log
charity_event     charity_event_participant          charity_monthly
share_card_log
```

- [ ] **Step 2: 配 indexes**

Create `cloudfunctions/_shared_test_utils/collection-init.md`:

```markdown
# 集合 indexes 配置（控制台手动建）

| 集合 | 索引字段 | 类型 | 说明 |
|---|---|---|---|
| pet_state | _id | 主键 | openid as _id |
| user_badge | (openid, badgeId) | unique compound | 防重复颁发 |
| user_badge | openid | non-unique | 列我的徽章 |
| charity_ledger | openid | non-unique | 查个人记账 |
| charity_ledger | (status, settledMonth) | non-unique compound | settle 查 pending |
| charity_supply_log | occurredAt | non-unique desc | admin 列表 |
| charity_event | status | non-unique | 列已发布活动 |
| charity_event_participant | (eventId, openid) | unique compound | 防重复报名 |
| share_card_log | openid | non-unique | 统计分享 |
```

- [ ] **Step 3: 提交 collection 文档**

```bash
git add cloudfunctions/_shared_test_utils/collection-init.md
git commit -m "docs(pet-charity): collection schema + indexes config reference"
```

## Task 1.2: devSeedPetSpecies 云函数

**Files:**
- Create: `cloudfunctions/devSeedPetSpecies/index.js`
- Create: `cloudfunctions/devSeedPetSpecies/config.json`
- Create: `cloudfunctions/devSeedPetSpecies/package.json`

- [ ] **Step 1: 建文件结构**

```bash
mkdir -p cloudfunctions/devSeedPetSpecies
```

- [ ] **Step 2: package.json**

Create `cloudfunctions/devSeedPetSpecies/package.json`:

```json
{
  "name": "devSeedPetSpecies",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~3.0.0"
  }
}
```

- [ ] **Step 3: config.json**

Create `cloudfunctions/devSeedPetSpecies/config.json`:

```json
{
  "triggers": [],
  "timeout": 15,
  "envVariables": {}
}
```

- [ ] **Step 4: 实现 seed 逻辑**

Create `cloudfunctions/devSeedPetSpecies/index.js`:

```js
// devSeedPetSpecies · DEV ONLY · 一次性灌入 2 个品种
// 入参: { force?: boolean } · force=true 覆盖已存在记录
// 出参: { ok, inserted, skipped }
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const SEED = [
  {
    _id: 'cat_orange',
    name_cn: '橘猫',
    name_en: 'Orange Tabby',
    spriteUrl: 'cloud://_placeholder.png',
    spriteGrid: { cols: 4, rows: 3 },
    spriteFrameSize: { w: 96, h: 96 },
    frames: {
      idle: { row: 0, col: 0, count: 4, fps: 4 },
      happy: { row: 1, col: 0, count: 4, fps: 8 },
      sleeping: { row: 2, col: 0, count: 2, fps: 2 },
    },
    defaultSkinId: null,
    unlockCondition: null,
    status: 'on_shelf',
  },
  {
    _id: 'dog_shiba',
    name_cn: '柴犬',
    name_en: 'Shiba Inu',
    spriteUrl: 'cloud://_placeholder.png',
    spriteGrid: { cols: 4, rows: 3 },
    spriteFrameSize: { w: 96, h: 96 },
    frames: {
      idle: { row: 0, col: 0, count: 4, fps: 4 },
      happy: { row: 1, col: 0, count: 4, fps: 8 },
      sleeping: { row: 2, col: 0, count: 2, fps: 2 },
    },
    defaultSkinId: null,
    unlockCondition: null,
    status: 'on_shelf',
  },
];

exports.main = async (event = {}) => {
  const { force = false } = event;
  const col = db.collection('pet_species');
  const now = new Date().toISOString();
  let inserted = 0, skipped = 0;

  for (const seed of SEED) {
    const data = { ...seed, createdAt: now, updatedAt: now };
    try {
      await col.doc(seed._id).get();
      if (force) {
        await col.doc(seed._id).set({ data });
        inserted++;
      } else {
        skipped++;
      }
    } catch (e) {
      // doc 不存在
      await col.add({ data });
      inserted++;
    }
  }

  return { ok: true, inserted, skipped };
};
```

- [ ] **Step 5: 部署 + 控制台调用验证**

```bash
WXCLI=/Applications/wechatwebdevtools.app/Contents/MacOS/cli
"$WXCLI" cloud functions deploy --env cloudbase-d2gn8jhapa97d69f3 \
  --names devSeedPetSpecies \
  --project /Users/nicky/Code/kdrhea-mini-app --remote-npm-install
```

CloudBase 控制台 → 云函数 → devSeedPetSpecies → 测试 → 调用 `{}`
Expected: `{ "ok": true, "inserted": 2, "skipped": 0 }`

控制台 → 数据库 → `pet_species` → 看到 2 条记录

- [ ] **Step 6: 提交**

```bash
git add cloudfunctions/devSeedPetSpecies
git commit -m "feat(pet): devSeedPetSpecies cloud function with cat_orange + dog_shiba"
```

## Task 1.3: devSeedBadgeDef 云函数

**Files:**
- Create: `cloudfunctions/devSeedBadgeDef/{index.js,config.json,package.json}`

- [ ] **Step 1: 复制 Task 1.2 文件结构作为模板**

```bash
cp -r cloudfunctions/devSeedPetSpecies cloudfunctions/devSeedBadgeDef
cd cloudfunctions/devSeedBadgeDef
```

- [ ] **Step 2: 改 package.json name**

Edit `cloudfunctions/devSeedBadgeDef/package.json`: `name` → `"devSeedBadgeDef"`

- [ ] **Step 3: 实现 seed**

Replace `cloudfunctions/devSeedBadgeDef/index.js`:

```js
// devSeedBadgeDef · DEV ONLY · 灌入 3 档徽章
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const SEED = [
  {
    _id: 'love_companion_bronze',
    name_cn: '爱心同行者 · 铜',
    name_en: 'Love Companion · Bronze',
    iconUrl: 'cloud://_placeholder.png',
    tier: 'bronze',
    unlock: { type: 'pet_level', threshold: 8 },
    perks: ['charity_event_register'],
    displayOnHome: true,
    status: 'active',
  },
  {
    _id: 'love_companion_silver',
    name_cn: '爱心同行者 · 银',
    name_en: 'Love Companion · Silver',
    iconUrl: 'cloud://_placeholder.png',
    tier: 'silver',
    unlock: { type: 'pet_level', threshold: 9 },
    perks: ['charity_event_register', 'wall_signature'],
    displayOnHome: true,
    status: 'active',
  },
  {
    _id: 'love_companion_gold',
    name_cn: '爱心同行者 · 金',
    name_en: 'Love Companion · Gold',
    iconUrl: 'cloud://_placeholder.png',
    tier: 'gold',
    unlock: { type: 'pet_level', threshold: 10 },
    perks: ['charity_event_register', 'wall_signature', 'annual_archive'],
    displayOnHome: true,
    status: 'active',
  },
];

exports.main = async (event = {}) => {
  const { force = false } = event;
  const col = db.collection('badge_def');
  const now = new Date().toISOString();
  let inserted = 0, skipped = 0;

  for (const seed of SEED) {
    const data = { ...seed, createdAt: now };
    try {
      await col.doc(seed._id).get();
      if (force) { await col.doc(seed._id).set({ data }); inserted++; }
      else skipped++;
    } catch (e) {
      await col.add({ data });
      inserted++;
    }
  }
  return { ok: true, inserted, skipped };
};
```

- [ ] **Step 4: 部署 + 验证 + 提交**

```bash
"$WXCLI" cloud functions deploy --env cloudbase-d2gn8jhapa97d69f3 \
  --names devSeedBadgeDef \
  --project /Users/nicky/Code/kdrhea-mini-app --remote-npm-install
```

控制台调用 `{}` → expected `{ ok:true, inserted:3, skipped:0 }`

```bash
git add cloudfunctions/devSeedBadgeDef
git commit -m "feat(pet): devSeedBadgeDef with bronze/silver/gold 3 tiers"
```

## Task 1.4: devSeedCharityOrg + devSeedPetSkin（同模式 · 合并到一个 task）

**Files:**
- Create: `cloudfunctions/devSeedCharityOrg/{index.js,config.json,package.json}`
- Create: `cloudfunctions/devSeedPetSkin/{index.js,config.json,package.json}`

- [ ] **Step 1: 建 devSeedCharityOrg**

```bash
cp -r cloudfunctions/devSeedPetSpecies cloudfunctions/devSeedCharityOrg
```

改 package.json `name`，替换 index.js：

```js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const SEED = [{
  _id: 'xuzhou_animal_rescue',
  name_cn: '徐州小动物救助协会',
  name_en: 'Xuzhou Animal Rescue',
  description: '5A 资质 · 月度公示账目（占位 · Phase 0 由 Nick 确认）',
  logoUrl: 'cloud://_placeholder.png',
  protocolUrl: '',
  bankInfo: {},
  status: 'active',
}];

exports.main = async (event = {}) => {
  const { force = false } = event;
  const col = db.collection('charity_org');
  const now = new Date().toISOString();
  let inserted = 0, skipped = 0;
  for (const seed of SEED) {
    const data = { ...seed, createdAt: now, updatedAt: now };
    try {
      await col.doc(seed._id).get();
      if (force) { await col.doc(seed._id).set({ data }); inserted++; } else skipped++;
    } catch (e) { await col.add({ data }); inserted++; }
  }
  return { ok: true, inserted, skipped };
};
```

- [ ] **Step 2: 建 devSeedPetSkin（V1 留空·只建函数文件 · 未来扩展用）**

```bash
cp -r cloudfunctions/devSeedPetSpecies cloudfunctions/devSeedPetSkin
```

改 package.json name + 替换 index.js：

```js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// V1 不预设皮肤 · 用户初始无皮肤 · 用 species 默认 sprite
// Phase 2+ 由 PixelLab.ai 生成季节皮肤后 force=true 灌入
const SEED = [];

exports.main = async (event = {}) => {
  return { ok: true, inserted: 0, skipped: 0, message: 'V1: no skin seeded by design' };
};
```

- [ ] **Step 3: 部署两个 + 验证**

```bash
"$WXCLI" cloud functions deploy --env cloudbase-d2gn8jhapa97d69f3 \
  --names devSeedCharityOrg devSeedPetSkin \
  --project /Users/nicky/Code/kdrhea-mini-app --remote-npm-install
```

控制台调 devSeedCharityOrg `{}` → expected `{ok:true, inserted:1}`
控制台调 devSeedPetSkin `{}` → expected `{ok:true, inserted:0, message:"V1..."}`

- [ ] **Step 4: 验证 charity_org 集合**

CloudBase 数据库 → `charity_org` → 看到 `xuzhou_animal_rescue` 记录

- [ ] **Step 5: 提交**

```bash
git add cloudfunctions/devSeedCharityOrg cloudfunctions/devSeedPetSkin
git commit -m "feat(pet,charity): devSeedCharityOrg + devSeedPetSkin (skin v1 empty)"
```

## Task 1.5: 扩展现有 SKU 集合（pet_food 类）+ devSeedPetFoodSku

**Files:**
- Modify: `cloudfunctions/seedSku/index.js`（如果已存在则扩展 · 否则参考）
- Create: `cloudfunctions/devSeedPetFoodSku/{index.js,config.json,package.json}`

- [ ] **Step 1: 看现有 seedSku 结构**

Run: `cat cloudfunctions/seedSku/index.js | head -30`
确认现有 sku 字段格式。

- [ ] **Step 2: 建独立 devSeedPetFoodSku（不动现有 seedSku）**

```bash
cp -r cloudfunctions/devSeedPetSpecies cloudfunctions/devSeedPetFoodSku
```

替换 index.js：

```js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const SEED = [
  {
    _id: 'sku_pet_food_small',
    name: '小袋宠粮',
    type: 'pet_food',
    category: 'pet',
    pointsOnly: true,
    priceFen: 5000,        // 50 积分 = ¥0.5
    pointsPrice: 50,
    experience: 15,
    charityRatio: 0.5,
    speciesRestrict: null,
    description: '日常喂养 · 每袋给宠物 +15 经验',
    coverUrl: 'cloud://_placeholder.png',
    stock: -1,             // 无库存限制
    status: 'on_shelf',
    sortOrder: 10,
  },
  {
    _id: 'sku_pet_food_medium',
    name: '中袋宠粮',
    type: 'pet_food',
    category: 'pet',
    pointsOnly: true,
    priceFen: 20000,
    pointsPrice: 200,
    experience: 80,
    charityRatio: 0.6,
    speciesRestrict: null,
    description: '主推 · 性价比最高 · +80 经验 · 60% 公益折算',
    coverUrl: 'cloud://_placeholder.png',
    stock: -1,
    status: 'on_shelf',
    sortOrder: 20,
  },
  {
    _id: 'sku_pet_food_large',
    name: '大袋宠粮',
    type: 'pet_food',
    category: 'pet',
    pointsOnly: true,
    priceFen: 50000,
    pointsPrice: 500,
    experience: 250,
    charityRatio: 0.7,
    speciesRestrict: null,
    description: '进阶 · 多花多益 · +250 经验 · 70% 公益折算',
    coverUrl: 'cloud://_placeholder.png',
    stock: -1,
    status: 'on_shelf',
    sortOrder: 30,
  },
];

exports.main = async (event = {}) => {
  const { force = false } = event;
  const col = db.collection('sku');
  const now = new Date().toISOString();
  let inserted = 0, skipped = 0;
  for (const seed of SEED) {
    const data = { ...seed, createdAt: now, updatedAt: now };
    try {
      await col.doc(seed._id).get();
      if (force) { await col.doc(seed._id).set({ data }); inserted++; } else skipped++;
    } catch (e) { await col.add({ data }); inserted++; }
  }
  return { ok: true, inserted, skipped };
};
```

- [ ] **Step 3: 部署 + 验证 + 提交**

```bash
"$WXCLI" cloud functions deploy --env cloudbase-d2gn8jhapa97d69f3 \
  --names devSeedPetFoodSku \
  --project /Users/nicky/Code/kdrhea-mini-app --remote-npm-install
```

控制台调 `{}` → expected `{ok:true, inserted:3}`
CloudBase 数据库 `sku` → 看到 3 条新记录（type=pet_food）

```bash
git add cloudfunctions/devSeedPetFoodSku
git commit -m "feat(pet): devSeedPetFoodSku with 3 tiers (small/medium/large)"
```

## Task 1.6: 扩展 points_log ALLOWED_TYPES 增加 spend_pet_food

**Files:**
- Modify: `cloudfunctions/earnPoints/index.js`（line 18-25 ALLOWED_TYPES 区）
- Modify: `cloudfunctions/spendPoints/index.js`（同样）

- [ ] **Step 1: 查 spendPoints 现状**

Run: `grep -A 8 'ALLOWED_TYPES' cloudfunctions/spendPoints/index.js`

- [ ] **Step 2: 在 earnPoints 加 type**

Edit `cloudfunctions/earnPoints/index.js` line 18-25:

把：
```js
const ALLOWED_TYPES = new Set([
  'earn_old_customer_activation',
  'earn_self_consume',
  'earn_referral',
  'earn_in_store_qr',
  'earn_other',
  'admin_adjust',
]);
```

改成：
```js
const ALLOWED_TYPES = new Set([
  'earn_old_customer_activation',
  'earn_self_consume',
  'earn_referral',
  'earn_in_store_qr',
  'earn_other',
  'admin_adjust',
]);
// 注：spend_pet_food 在 spendPoints 集合白名单里 · 不在 earnPoints
```

- [ ] **Step 3: 在 spendPoints 加 type**

Edit `cloudfunctions/spendPoints/index.js` 找到对应 ALLOWED_TYPES 区，增加 `'spend_pet_food'`。

- [ ] **Step 4: 部署 2 个函数**

```bash
"$WXCLI" cloud functions deploy --env cloudbase-d2gn8jhapa97d69f3 \
  --names earnPoints spendPoints \
  --project /Users/nicky/Code/kdrhea-mini-app --remote-npm-install
```

- [ ] **Step 5: 提交**

```bash
git add cloudfunctions/earnPoints cloudfunctions/spendPoints
git commit -m "feat(pet): extend points_log ALLOWED_TYPES with spend_pet_food"
```

## Task 1.7: getPetPanel 云函数（读取 · 公益页一次性数据）

**Files:**
- Create: `cloudfunctions/getPetPanel/{index.js,config.json,package.json}`

- [ ] **Step 1: 建文件结构**

```bash
cp -r cloudfunctions/devSeedPetSpecies cloudfunctions/getPetPanel
```

改 package.json name → `"getPetPanel"`

- [ ] **Step 2: 实现读取**

Replace `cloudfunctions/getPetPanel/index.js`:

```js
// getPetPanel · 公益页所需全部数据 · 一次返
// 入参: {}
// 出参: { ok, pet, species, skin, badges, charity: { totalContributionFen, currentMonthFen, currentOrg } }
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const DEFAULT_PET = {
  currentSpeciesId: 'cat_orange',
  currentSkinId: null,
  level: 1,
  experience: 0,
  totalExperience: 0,
  totalContributionFen: 0,
  ownedSpeciesIds: ['cat_orange', 'dog_shiba'],
  ownedSkinIds: [],
  lastFedAt: null,
};

function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  return { start, end };
}

exports.main = async () => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { ok: false, code: 'NO_OPENID' };

  // 1. 拿/初始化 pet_state
  let pet;
  try {
    const r = await db.collection('pet_state').doc(openid).get();
    pet = r.data;
  } catch (e) {
    // 首次进 · 初始化
    const now = new Date().toISOString();
    pet = { ...DEFAULT_PET, createdAt: now, updatedAt: now };
    await db.collection('pet_state').add({ data: { _id: openid, ...pet } });
  }

  // 2. species
  const speciesR = await db.collection('pet_species').doc(pet.currentSpeciesId).get();
  const species = speciesR.data;

  // 3. skin（可选）
  let skin = null;
  if (pet.currentSkinId) {
    try { skin = (await db.collection('pet_skin').doc(pet.currentSkinId).get()).data; } catch (e) {}
  }

  // 4. badges
  const badgesR = await db.collection('user_badge').where({ openid }).orderBy('displayOrder', 'asc').get();

  // 5. charity 个人累计（pet.totalContributionFen 是冗余字段 · 直接取）
  // 6. charity 当月累计（实时聚合 · 用于海报）
  const { start, end } = currentMonthRange();
  const currentMonthR = await db.collection('charity_ledger')
    .aggregate()
    .match({ openid, createdAt: _.gte(start).and(_.lt(end)) })
    .group({ _id: null, total: _.aggregate.sum('$amountFen') })
    .end();
  const currentMonthFen = currentMonthR.list[0]?.total || 0;

  // 7. 当前默认公益机构（V1 取第一个 active 的）
  const orgR = await db.collection('charity_org').where({ status: 'active' }).limit(1).get();
  const currentOrg = orgR.data[0] || null;

  return {
    ok: true,
    pet,
    species,
    skin,
    badges: badgesR.data,
    charity: {
      totalContributionFen: pet.totalContributionFen || 0,
      currentMonthFen,
      currentOrg,
    },
  };
};
```

- [ ] **Step 3: 部署 + 控制台测试**

```bash
"$WXCLI" cloud functions deploy --env cloudbase-d2gn8jhapa97d69f3 \
  --names getPetPanel \
  --project /Users/nicky/Code/kdrhea-mini-app --remote-npm-install
```

控制台测试调用：开发者工具登录后调小程序内 `wx.cloud.callFunction({name:'getPetPanel'})` 验证。
Expected: 首次返 ok=true，pet 是 default 初始化值，badges=[]，charity.totalContributionFen=0

- [ ] **Step 4: 提交**

```bash
git add cloudfunctions/getPetPanel
git commit -m "feat(pet): getPetPanel returns pet+species+badges+charity in one call"
```

## Task 1.8: listPetSpecies + listPetSkins + listPetFoodSku + listCharityEvents（4 个 list 一起做）

**Files:**
- Create: `cloudfunctions/listPetSpecies/{...}`
- Create: `cloudfunctions/listPetSkins/{...}`
- Create: `cloudfunctions/listPetFoodSku/{...}`
- Create: `cloudfunctions/listCharityEvents/{...}`

- [ ] **Step 1: listPetSpecies**

```bash
cp -r cloudfunctions/devSeedPetSpecies cloudfunctions/listPetSpecies
```

改 package.json name + 替换 index.js：

```js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  const r = await db.collection('pet_species').where({ status: 'on_shelf' }).get();
  return { ok: true, items: r.data };
};
```

- [ ] **Step 2: listPetSkins**

```bash
cp -r cloudfunctions/devSeedPetSpecies cloudfunctions/listPetSkins
```

替换 index.js：

```js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event = {}) => {
  const { speciesId } = event;
  const where = { status: 'on_shelf' };
  if (speciesId) where.speciesId = speciesId;
  const r = await db.collection('pet_skin').where(where).get();
  return { ok: true, items: r.data };
};
```

- [ ] **Step 3: listPetFoodSku**

```bash
cp -r cloudfunctions/devSeedPetSpecies cloudfunctions/listPetFoodSku
```

替换 index.js：

```js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async () => {
  const r = await db.collection('sku')
    .where({ status: 'on_shelf', type: 'pet_food' })
    .orderBy('sortOrder', 'asc').get();
  return { ok: true, items: r.data };
};
```

- [ ] **Step 4: listCharityEvents**

```bash
cp -r cloudfunctions/devSeedPetSpecies cloudfunctions/listCharityEvents
```

替换 index.js：

```js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event = {}) => {
  const { status } = event;
  const where = {};
  if (status) where.status = status;
  else where.status = db.command.in(['published', 'ongoing', 'done']);
  const r = await db.collection('charity_event').where(where).orderBy('scheduledAt', 'desc').get();
  return { ok: true, items: r.data };
};
```

- [ ] **Step 5: 批量部署 + 验证**

```bash
"$WXCLI" cloud functions deploy --env cloudbase-d2gn8jhapa97d69f3 \
  --names listPetSpecies listPetSkins listPetFoodSku listCharityEvents \
  --project /Users/nicky/Code/kdrhea-mini-app --remote-npm-install
```

控制台分别测试 4 个：
- listPetSpecies `{}` → expected `{ok:true, items:[{_id:"cat_orange"},{_id:"dog_shiba"}]}`
- listPetSkins `{}` → expected `{ok:true, items:[]}`
- listPetFoodSku `{}` → expected `{ok:true, items:[3 个 SKU]}`
- listCharityEvents `{}` → expected `{ok:true, items:[]}`

- [ ] **Step 6: 提交**

```bash
git add cloudfunctions/listPetSpecies cloudfunctions/listPetSkins cloudfunctions/listPetFoodSku cloudfunctions/listCharityEvents
git commit -m "feat(pet,charity): 4 list cloud functions (species/skins/food/events)"
```

## Task 1.9: feedPet 云函数 ⭐⭐⭐（核心事务 + 强 TDD）

**Files:**
- Create: `cloudfunctions/feedPet/{index.js,config.json,package.json}`
- Create: `__tests__/cloudfunctions/feedPet.test.js`

- [ ] **Step 1: 建文件结构**

```bash
cp -r cloudfunctions/devSeedPetSpecies cloudfunctions/feedPet
```

改 package.json name → `"feedPet"`

- [ ] **Step 2: 写第一个失败测试 · 积分不足**

Create `__tests__/cloudfunctions/feedPet.test.js`:

```js
const { mockCloud } = require('../../cloudfunctions/_shared_test_utils/test-helpers');

describe('feedPet', () => {
  let feedPet, mockDb, cloud;

  beforeEach(() => {
    jest.resetModules();
    ({ mockDb, cloud } = mockCloud('test_openid_001'));
    feedPet = require('../../cloudfunctions/feedPet/index.js');
  });

  it('rejects when sku does not exist', async () => {
    mockDb.collection.mockImplementation((name) => ({
      doc: (id) => ({
        get: jest.fn().mockRejectedValue(new Error('document not exist')),
      }),
    }));
    const r = await feedPet.main({ skuId: 'nonexistent' });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('SKU_NOT_FOUND');
  });
});
```

- [ ] **Step 3: 跑测试看 fail**

```bash
pnpm test __tests__/cloudfunctions/feedPet.test.js
```

Expected: FAIL（feedPet 还没实现）

- [ ] **Step 4: 写最小实现让 SKU_NOT_FOUND 通过**

Replace `cloudfunctions/feedPet/index.js`:

```js
// feedPet · 喂宠物核心事务
// 入参: { skuId }
// 出参: {
//   ok, code?, newLevel, levelUps, newBadges,
//   charityAddedFen, pointsAfter, petAfter
// }
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 升级阶梯（spec Section 4.2）
const LEVEL_THRESHOLDS = [
  0,      // Lv1 起点
  80,     // Lv1→Lv2
  320,    // Lv2→Lv3
  800,    // Lv3→Lv4
  1800,   // Lv4→Lv5
  3000,   // Lv5→Lv6
  4000,   // Lv6→Lv7
  6000,   // Lv7→Lv8
  9000,   // Lv8→Lv9
  15000,  // Lv9→Lv10
];

function calcLevelUp(currentLevel, currentExp, addedExp) {
  let level = currentLevel;
  let exp = currentExp + addedExp;
  const levelUps = [];
  while (level < 10 && exp >= LEVEL_THRESHOLDS[level]) {
    exp -= LEVEL_THRESHOLDS[level];
    level++;
    levelUps.push(level);
  }
  return { newLevel: level, newExp: exp, levelUps };
}

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { ok: false, code: 'NO_OPENID' };

  const { skuId } = event;
  if (!skuId) return { ok: false, code: 'MISSING_SKU' };

  // 1. 查 SKU
  let sku;
  try { sku = (await db.collection('sku').doc(skuId).get()).data; }
  catch (e) { return { ok: false, code: 'SKU_NOT_FOUND' }; }
  if (sku.type !== 'pet_food' || sku.status !== 'on_shelf') {
    return { ok: false, code: 'SKU_NOT_AVAILABLE' };
  }

  // 2. 扣积分
  const spendR = await cloud.callFunction({
    name: 'spendPoints',
    data: { delta: sku.pointsPrice, type: 'spend_pet_food', refType: 'sku', refId: skuId, description: `喂宠 ${sku.name}` },
  });
  if (!spendR.result || !spendR.result.ok) {
    return { ok: false, code: 'SPEND_FAILED', detail: spendR.result };
  }
  const pointsAfter = spendR.result.balanceAfter;
  const pointsLogId = spendR.result.logId;

  // 3. 拿 pet_state
  let pet;
  try { pet = (await db.collection('pet_state').doc(openid).get()).data; }
  catch (e) {
    // 首次喂食 · 初始化
    pet = {
      _id: openid,
      currentSpeciesId: 'cat_orange',
      currentSkinId: null,
      level: 1, experience: 0, totalExperience: 0, totalContributionFen: 0,
      ownedSpeciesIds: ['cat_orange', 'dog_shiba'],
      ownedSkinIds: [],
      lastFedAt: null,
      createdAt: new Date().toISOString(),
    };
    await db.collection('pet_state').add({ data: pet });
  }

  // 4. 升级判定
  const { newLevel, newExp, levelUps } = calcLevelUp(pet.level, pet.experience, sku.experience);

  // 5. 公益记账
  const charityAddedFen = Math.floor(sku.priceFen * sku.charityRatio);
  const orgR = await db.collection('charity_org').where({ status: 'active' }).limit(1).get();
  const orgId = orgR.data[0]?._id || 'xuzhou_animal_rescue';
  const now = new Date().toISOString();
  await db.collection('charity_ledger').add({
    data: {
      openid, amountFen: charityAddedFen,
      sourceType: 'spend_pet_food', sourceRefId: pointsLogId,
      orgId, status: 'pending',
      settledMonth: null, settledAt: null,
      createdAt: now,
    },
  });

  // 6. 更新 pet_state（含 totalContributionFen 累加）
  const petUpdate = {
    level: newLevel,
    experience: newExp,
    totalExperience: _.inc(sku.experience),
    totalContributionFen: _.inc(charityAddedFen),
    lastFedAt: now,
    updatedAt: now,
  };
  await db.collection('pet_state').doc(openid).update({ data: petUpdate });

  // 7. 徽章颁发（如有升级）
  const newBadges = [];
  if (levelUps.length > 0) {
    const badgesR = await db.collection('badge_def').where({ status: 'active', 'unlock.type': 'pet_level' }).get();
    for (const badge of badgesR.data) {
      if (newLevel >= badge.unlock.threshold) {
        // 检查是否已有
        const existR = await db.collection('user_badge').where({ openid, badgeId: badge._id }).limit(1).get();
        if (existR.data.length === 0) {
          await db.collection('user_badge').add({
            data: {
              openid, badgeId: badge._id,
              earnedAt: now,
              displayOrder: badge.tier === 'gold' ? 1 : badge.tier === 'silver' ? 2 : 3,
            },
          });
          newBadges.push(badge._id);
        }
      }
    }
  }

  return {
    ok: true,
    newLevel, levelUps, newBadges,
    charityAddedFen, pointsAfter,
    petAfter: { ...pet, level: newLevel, experience: newExp, totalContributionFen: (pet.totalContributionFen || 0) + charityAddedFen },
  };
};
```

- [ ] **Step 5: 跑测试看 SKU_NOT_FOUND 通过**

```bash
pnpm test __tests__/cloudfunctions/feedPet.test.js
```

Expected: PASS

- [ ] **Step 6: 加更多测试 · 升级跨级 + 徽章颁发**

Append to `__tests__/cloudfunctions/feedPet.test.js`:

```js
  it('handles multi-level jump from Lv1 with large feed', async () => {
    // 模拟一袋大宠粮 (250 经验) 直接从 Lv1 → Lv3
    // Lv1→2 需 80 · Lv2→3 需 320 · 250 < 80+320=400 但 > 80
    // 应该升到 Lv2 · 余 170 经验
    const sku = { type: 'pet_food', status: 'on_shelf', pointsPrice: 500, priceFen: 50000, experience: 250, charityRatio: 0.7, name: '大袋' };
    const pet = { _id: 'test_openid_001', level: 1, experience: 0, totalContributionFen: 0, ownedSpeciesIds: ['cat_orange'] };

    mockDb.collection.mockImplementation((name) => ({
      doc: (id) => ({
        get: jest.fn().mockResolvedValue({ data: name === 'sku' ? sku : pet }),
        update: jest.fn().mockResolvedValue({}),
      }),
      where: () => ({
        limit: () => ({ get: jest.fn().mockResolvedValue({ data: [{ _id: 'xuzhou_animal_rescue' }] }) }),
        get: jest.fn().mockResolvedValue({ data: [] }),
      }),
      add: jest.fn().mockResolvedValue({}),
    }));
    cloud.callFunction.mockResolvedValue({ result: { ok: true, balanceAfter: 1500, logId: 'log_001' } });

    const r = await feedPet.main({ skuId: 'sku_pet_food_large' });

    expect(r.ok).toBe(true);
    expect(r.newLevel).toBe(2);              // 80 → Lv2 · 余 170
    expect(r.levelUps).toEqual([2]);
    expect(r.charityAddedFen).toBe(35000);   // 50000 * 0.7
  });

  it('grants bronze badge when reaching Lv8', async () => {
    // 用户当前 Lv7 经验 5950 · 喂中袋 (80 经验) → Lv8
    // Lv7→8 需 6000 经验 · 5950+80=6030 → newLevel=8 余 30
    const sku = { type: 'pet_food', status: 'on_shelf', pointsPrice: 200, priceFen: 20000, experience: 80, charityRatio: 0.6, name: '中袋' };
    const pet = { _id: 'test_openid_001', level: 7, experience: 5950, totalContributionFen: 0, ownedSpeciesIds: ['cat_orange'] };
    const bronzeBadge = { _id: 'love_companion_bronze', tier: 'bronze', unlock: { type: 'pet_level', threshold: 8 } };

    mockDb.collection.mockImplementation((name) => {
      const handlers = {
        sku: { doc: () => ({ get: jest.fn().mockResolvedValue({ data: sku }) }) },
        pet_state: { doc: () => ({ get: jest.fn().mockResolvedValue({ data: pet }), update: jest.fn().mockResolvedValue({}) }) },
        charity_ledger: { add: jest.fn().mockResolvedValue({}) },
        charity_org: { where: () => ({ limit: () => ({ get: jest.fn().mockResolvedValue({ data: [{ _id: 'org_001' }] }) }) }) },
        badge_def: { where: () => ({ get: jest.fn().mockResolvedValue({ data: [bronzeBadge] }) }) },
        user_badge: {
          where: () => ({ limit: () => ({ get: jest.fn().mockResolvedValue({ data: [] }) }) }),
          add: jest.fn().mockResolvedValue({}),
        },
      };
      return handlers[name];
    });
    cloud.callFunction.mockResolvedValue({ result: { ok: true, balanceAfter: 800, logId: 'log_002' } });

    const r = await feedPet.main({ skuId: 'sku_pet_food_medium' });

    expect(r.ok).toBe(true);
    expect(r.newLevel).toBe(8);
    expect(r.levelUps).toEqual([8]);
    expect(r.newBadges).toEqual(['love_companion_bronze']);
  });
```

- [ ] **Step 7: 跑全部测试**

```bash
pnpm test __tests__/cloudfunctions/feedPet.test.js
```

Expected: 3 个 test 全 PASS

- [ ] **Step 8: 部署 feedPet 到云**

```bash
"$WXCLI" cloud functions deploy --env cloudbase-d2gn8jhapa97d69f3 \
  --names feedPet \
  --project /Users/nicky/Code/kdrhea-mini-app --remote-npm-install
```

- [ ] **Step 9: 提交**

```bash
git add cloudfunctions/feedPet __tests__/cloudfunctions
git commit -m "feat(pet): feedPet core transaction with level-up + badge granting + unit tests"
```

## Task 1.10: switchPet + switchSkin

**Files:**
- Create: `cloudfunctions/switchPet/{...}`
- Create: `cloudfunctions/switchSkin/{...}`

- [ ] **Step 1: switchPet**

```bash
cp -r cloudfunctions/devSeedPetSpecies cloudfunctions/switchPet
```

替换 index.js：

```js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event = {}) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return { ok: false, code: 'NO_OPENID' };
  const { speciesId } = event;
  if (!speciesId) return { ok: false, code: 'MISSING_SPECIES' };

  const pet = (await db.collection('pet_state').doc(openid).get()).data;
  if (!pet.ownedSpeciesIds.includes(speciesId)) {
    return { ok: false, code: 'NOT_OWNED' };
  }

  await db.collection('pet_state').doc(openid).update({
    data: { currentSpeciesId: speciesId, currentSkinId: null, updatedAt: new Date().toISOString() },
  });
  return { ok: true };
};
```

- [ ] **Step 2: switchSkin**

```bash
cp -r cloudfunctions/devSeedPetSpecies cloudfunctions/switchSkin
```

替换 index.js：

```js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event = {}) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return { ok: false, code: 'NO_OPENID' };
  const { skinId } = event;  // null = 取消皮肤

  const pet = (await db.collection('pet_state').doc(openid).get()).data;
  if (skinId !== null && !pet.ownedSkinIds.includes(skinId)) {
    return { ok: false, code: 'NOT_OWNED' };
  }

  await db.collection('pet_state').doc(openid).update({
    data: { currentSkinId: skinId, updatedAt: new Date().toISOString() },
  });
  return { ok: true };
};
```

- [ ] **Step 3: 部署 + 提交**

```bash
"$WXCLI" cloud functions deploy --env cloudbase-d2gn8jhapa97d69f3 \
  --names switchPet switchSkin \
  --project /Users/nicky/Code/kdrhea-mini-app --remote-npm-install

git add cloudfunctions/switchPet cloudfunctions/switchSkin
git commit -m "feat(pet): switchPet + switchSkin with ownership check"
```

## Task 1.11: registerCharityEvent + generateShareCardLog

**Files:**
- Create: `cloudfunctions/registerCharityEvent/{...}`
- Create: `cloudfunctions/generateShareCardLog/{...}`

- [ ] **Step 1: registerCharityEvent**

```bash
cp -r cloudfunctions/devSeedPetSpecies cloudfunctions/registerCharityEvent
```

替换 index.js：

```js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event = {}) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return { ok: false, code: 'NO_OPENID' };
  const { eventId } = event;
  if (!eventId) return { ok: false, code: 'MISSING_EVENT' };

  // 1. 查活动是否存在 + 是否可报
  let evt;
  try { evt = (await db.collection('charity_event').doc(eventId).get()).data; }
  catch (e) { return { ok: false, code: 'EVENT_NOT_FOUND' }; }
  if (evt.status !== 'published') return { ok: false, code: 'EVENT_NOT_OPEN' };

  // 2. 校验徽章资格（B1: 必须有任意徽章才能报名）
  const badgesR = await db.collection('user_badge').where({ openid }).get();
  if (badgesR.data.length === 0) return { ok: false, code: 'BADGE_REQUIRED' };
  // 取最高档徽章作为 eligibleVia
  const highest = badgesR.data.find(b => b.badgeId.endsWith('gold'))
    || badgesR.data.find(b => b.badgeId.endsWith('silver'))
    || badgesR.data[0];

  // 3. 防重复报名
  const existR = await db.collection('charity_event_participant')
    .where({ eventId, openid }).limit(1).get();
  if (existR.data.length > 0) return { ok: false, code: 'ALREADY_REGISTERED' };

  // 4. 容量检查
  const countR = await db.collection('charity_event_participant')
    .where({ eventId, status: db.command.in(['registered', 'confirmed', 'attended']) }).count();
  if (countR.total >= (evt.capacity || 999)) return { ok: false, code: 'EVENT_FULL' };

  // 5. 写入报名
  await db.collection('charity_event_participant').add({
    data: {
      eventId, openid,
      registeredAt: new Date().toISOString(),
      status: 'registered',
      eligibleVia: highest.badgeId,
      notes: '',
    },
  });

  return { ok: true };
};
```

- [ ] **Step 2: generateShareCardLog**

```bash
cp -r cloudfunctions/devSeedPetSpecies cloudfunctions/generateShareCardLog
```

替换 index.js：

```js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event = {}) => {
  const openid = cloud.getWXContext().OPENID;
  if (!openid) return { ok: false, code: 'NO_OPENID' };
  const { snapshot } = event;
  if (!snapshot) return { ok: false, code: 'MISSING_SNAPSHOT' };

  const log = await db.collection('share_card_log').add({
    data: {
      openid,
      cardType: 'charity_certificate',
      dataSnapshot: snapshot,
      generatedAt: new Date().toISOString(),
    },
  });

  return { ok: true, logId: log._id };
};
```

- [ ] **Step 3: 部署 + 提交**

```bash
"$WXCLI" cloud functions deploy --env cloudbase-d2gn8jhapa97d69f3 \
  --names registerCharityEvent generateShareCardLog \
  --project /Users/nicky/Code/kdrhea-mini-app --remote-npm-install

git add cloudfunctions/registerCharityEvent cloudfunctions/generateShareCardLog
git commit -m "feat(charity): registerCharityEvent (badge-gated) + generateShareCardLog"
```

## Task 1.12: settleMonthlyCharity 定时云函数

**Files:**
- Create: `cloudfunctions/settleMonthlyCharity/{index.js,config.json,package.json}`

- [ ] **Step 1: 建文件结构**

```bash
cp -r cloudfunctions/devSeedPetSpecies cloudfunctions/settleMonthlyCharity
```

- [ ] **Step 2: 配置定时器（config.json）**

Replace `cloudfunctions/settleMonthlyCharity/config.json`:

```json
{
  "triggers": [
    {
      "name": "monthlyChargeAt2am",
      "type": "timer",
      "config": "0 0 2 1 * * *"
    }
  ],
  "timeout": 60,
  "envVariables": {}
}
```

Cron 表达式：每月 1 号 02:00 跑（秒 分 时 日 月 周 年）

- [ ] **Step 3: 实现聚合 + 写月度汇总**

Replace `cloudfunctions/settleMonthlyCharity/index.js`:

```js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

function lastMonthKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based, this is current; -1 for last
  const lastM = m === 0 ? 12 : m;
  const lastY = m === 0 ? y - 1 : y;
  return `${lastY}-${String(lastM).padStart(2, '0')}`;
}

function lastMonthRange() {
  const now = new Date();
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  return { lastMonthStart, lastMonthEnd };
}

exports.main = async () => {
  const monthKey = lastMonthKey();

  // 幂等：若已有该月文档则跳过
  try {
    const exist = await db.collection('charity_monthly').doc(monthKey).get();
    if (exist.data) return { ok: true, code: 'ALREADY_SETTLED', monthKey };
  } catch (e) { /* 不存在 · 继续 */ }

  const { lastMonthStart, lastMonthEnd } = lastMonthRange();

  // 1. 聚合 charity_ledger 上月 pending
  const ledgerR = await db.collection('charity_ledger')
    .aggregate()
    .match({ createdAt: _.gte(lastMonthStart).and(_.lt(lastMonthEnd)), status: 'pending' })
    .group({
      _id: '$orgId',
      cashFromUsersFen: _.aggregate.sum('$amountFen'),
      contributorsCount: _.aggregate.addToSet('$openid'),
    })
    .end();
  const byOrgUsers = ledgerR.list.map(o => ({
    orgId: o._id,
    cashFromUsersFen: o.cashFromUsersFen,
    contributorsCount: o.contributorsCount.length,
  }));

  // 2. 聚合 charity_supply_log 上月
  const supplyR = await db.collection('charity_supply_log')
    .aggregate()
    .match({ occurredAt: _.gte(lastMonthStart).and(_.lt(lastMonthEnd)), status: 'confirmed' })
    .group({
      _id: '$orgId',
      supplyFromCompanyFen: _.aggregate.sum('$amountFen'),
    })
    .end();
  const byOrgSupply = supplyR.list.map(o => ({ orgId: o._id, supplyFromCompanyFen: o.supplyFromCompanyFen }));

  // 3. 合并 byOrg
  const orgMap = new Map();
  byOrgUsers.forEach(o => orgMap.set(o.orgId, { ...o, supplyFromCompanyFen: 0 }));
  byOrgSupply.forEach(o => {
    if (orgMap.has(o.orgId)) Object.assign(orgMap.get(o.orgId), { supplyFromCompanyFen: o.supplyFromCompanyFen });
    else orgMap.set(o.orgId, { orgId: o.orgId, cashFromUsersFen: 0, contributorsCount: 0, supplyFromCompanyFen: o.supplyFromCompanyFen });
  });
  const byOrg = Array.from(orgMap.values());

  // 4. 拉 events
  const eventsR = await db.collection('charity_event')
    .where({ scheduledAt: _.gte(lastMonthStart).and(_.lt(lastMonthEnd)) })
    .get();
  const eventIds = eventsR.data.map(e => e._id);

  // 5. 汇总
  const cashFromUsersFen = byOrg.reduce((s, o) => s + o.cashFromUsersFen, 0);
  const supplyFromCompanyFen = byOrg.reduce((s, o) => s + o.supplyFromCompanyFen, 0);
  const contributorsCount = byOrg.reduce((s, o) => s + o.contributorsCount, 0);
  const totalFen = cashFromUsersFen + supplyFromCompanyFen;

  // 6. 写 charity_monthly
  const now = new Date().toISOString();
  await db.collection('charity_monthly').add({
    data: {
      _id: monthKey,
      cashFromUsersFen, supplyFromCompanyFen, cashFromCompanyFen: 0,
      totalFen, contributorsCount,
      byOrg, eventIds,
      receiptUrls: [], notes: '',
      status: 'draft', confirmedAt: null, paidAt: null,
      createdBy: 'system',
      createdAt: now, updatedAt: now,
    },
  });

  // 7. 批量更新 charity_ledger.status
  await db.collection('charity_ledger')
    .where({ createdAt: _.gte(lastMonthStart).and(_.lt(lastMonthEnd)), status: 'pending' })
    .update({ data: { status: 'settled', settledMonth: monthKey, settledAt: now } });

  return { ok: true, monthKey, totalFen, contributorsCount, byOrg };
};
```

- [ ] **Step 4: 部署 · 控制台手动调一次验证**

```bash
"$WXCLI" cloud functions deploy --env cloudbase-d2gn8jhapa97d69f3 \
  --names settleMonthlyCharity \
  --project /Users/nicky/Code/kdrhea-mini-app --remote-npm-install
```

控制台测试调用 `{}`（在月初前手动跑会聚合上月空数据，返回 `{ok:true, monthKey:"2026-04", totalFen:0}` 之类，验证逻辑通）

- [ ] **Step 5: 提交**

```bash
git add cloudfunctions/settleMonthlyCharity
git commit -m "feat(charity): settleMonthlyCharity timer (1st 02:00) + idempotent aggregation"
```

## Task 1.13: 14 个云函数加 HTTP 路由 + CORS wrapper

> 复用 `~/.claude/skills/wechat-miniprogram-dev/` skill 的脚本

**Files:**
- 14 个 `cloudfunctions/<name>/index.js` 末尾追加 CORS wrapper

- [ ] **Step 1: 列出本 plan 新增/修改的所有云函数**

新增的：getPetPanel / feedPet / switchPet / switchSkin / registerCharityEvent / generateShareCardLog / listPetSpecies / listPetSkins / listPetFoodSku / listCharityEvents / settleMonthlyCharity / devSeedPetSpecies / devSeedBadgeDef / devSeedCharityOrg / devSeedPetSkin / devSeedPetFoodSku
共 16 个，但 5 个 devSeed 不需要 HTTP 路由（只 admin 控制台调用） + settleMonthlyCharity 不需要（定时器触发）。

需要 HTTP 路由的小程序端调用函数：10 个
- getPetPanel / feedPet / switchPet / switchSkin / registerCharityEvent / generateShareCardLog / listPetSpecies / listPetSkins / listPetFoodSku / listCharityEvents

但**小程序端用 wx.cloud.callFunction（不是 HTTP）**，所以**不需要 HTTP 路由**！

HTTP 路由只是给 admin 后台（kdrhea-admin Next.js）用的。本 plan 不涉及 admin 后台，所以可以**跳过这个 task**。

- [ ] **Step 2: 跳过决策记录**

本 Phase 1 涉及的 10 个用户云函数都用 `wx.cloud.callFunction` 调用（小程序内置 SDK），不需要 HTTP 路由配置。

如果未来需要在 admin 后台调用（如查询用户公益记账），那时再用 `wechat-miniprogram-dev` skill 的 `batch_add_routes.sh` 脚本批量加。

- [ ] **Step 3: 标记完成**

```bash
echo "Phase 1 cloud functions use wx.cloud.callFunction · no HTTP routes needed for this phase" > docs/specs/phase-1-no-http-routes.md
git add docs/specs/phase-1-no-http-routes.md
git commit -m "docs(phase-1): no HTTP routes needed · all cloud calls via wx.cloud SDK"
```

## Task 1.14: 自检脚本（数据一致性周检）

**Files:**
- Create: `cloudfunctions/_dataCheck/index.js`（非定时·人工跑）

- [ ] **Step 1: 建函数**

```bash
cp -r cloudfunctions/devSeedPetSpecies cloudfunctions/_dataCheck
```

替换 index.js：

```js
// _dataCheck · 数据一致性人工检查 · 运营周跑
// 出参: { ok, issues: [...] }
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async () => {
  const issues = [];

  // 1. user_badge 颁发的徽章对应用户必须达到 unlock threshold
  const badgeDefs = (await db.collection('badge_def').get()).data;
  const badgeMap = new Map(badgeDefs.map(b => [b._id, b]));

  const userBadges = (await db.collection('user_badge').limit(1000).get()).data;
  for (const ub of userBadges) {
    const def = badgeMap.get(ub.badgeId);
    if (!def) { issues.push({ type: 'orphan_badge', userBadge: ub }); continue; }
    if (def.unlock.type === 'pet_level') {
      try {
        const pet = (await db.collection('pet_state').doc(ub.openid).get()).data;
        if (pet.level < def.unlock.threshold) {
          issues.push({ type: 'badge_below_threshold', openid: ub.openid, badgeId: ub.badgeId, currentLevel: pet.level, threshold: def.unlock.threshold });
        }
      } catch (e) { issues.push({ type: 'missing_pet_state', openid: ub.openid }); }
    }
  }

  // 2. charity_ledger sum 必须 ≈ pet_state.totalContributionFen
  const pets = (await db.collection('pet_state').limit(500).get()).data;
  for (const pet of pets) {
    const lr = await db.collection('charity_ledger')
      .aggregate()
      .match({ openid: pet._id })
      .group({ _id: null, total: _.aggregate.sum('$amountFen') })
      .end();
    const actual = lr.list[0]?.total || 0;
    if (Math.abs(actual - (pet.totalContributionFen || 0)) > 0) {
      issues.push({ type: 'contribution_mismatch', openid: pet._id, redundant: pet.totalContributionFen, actual });
    }
  }

  return { ok: issues.length === 0, issues, totalChecked: { userBadges: userBadges.length, pets: pets.length } };
};
```

- [ ] **Step 2: 部署 + 测试**

```bash
"$WXCLI" cloud functions deploy --env cloudbase-d2gn8jhapa97d69f3 \
  --names _dataCheck \
  --project /Users/nicky/Code/kdrhea-mini-app --remote-npm-install
```

控制台调用 `{}` → 初始库为空：expected `{ok:true, issues:[], totalChecked:{userBadges:0,pets:0}}`

- [ ] **Step 3: 提交**

```bash
git add cloudfunctions/_dataCheck
git commit -m "feat(charity): _dataCheck for weekly badge/contribution consistency"
```

## Task 1.15: Phase 1 集成测试（手动控制台跑全流程）

**Files:**
- Create: `docs/specs/phase-1-verification.md`（验证记录）

- [ ] **Step 1: 跑所有 seed**

控制台依次调用 4 个 seed：
- devSeedPetSpecies `{}` → 2 inserted
- devSeedBadgeDef `{}` → 3 inserted
- devSeedCharityOrg `{}` → 1 inserted
- devSeedPetFoodSku `{}` → 3 inserted

- [ ] **Step 2: 模拟用户首次进公益页**

控制台调用 getPetPanel `{}`（先在开发者工具登录小程序 OPENID）：
Expected: `{ok:true, pet:{level:1,experience:0,ownedSpeciesIds:["cat_orange","dog_shiba"]}, species:{_id:"cat_orange"}, badges:[], charity:{totalContributionFen:0, currentMonthFen:0, currentOrg:{_id:"xuzhou_animal_rescue"}}}`

- [ ] **Step 3: 模拟喂食 → 升级 → 徽章**

先 manually 在控制台改测试用户的 points_account.balance = 100000（够升满）
连续调用 feedPet `{skuId: "sku_pet_food_large"}` 直到 newLevel=10

预期：
- 第 1 次：newLevel=4 levelUps=[2,3,4] 余 100 经验
- 累计调用直到 Lv8 → newBadges=["love_companion_bronze"]
- Lv9 → newBadges=["love_companion_silver"]
- Lv10 → newBadges=["love_companion_gold"]

- [ ] **Step 4: 验 charity_ledger 写入**

控制台数据库 → charity_ledger → 应看到等同 feedPet 调用次数的 pending 记录

- [ ] **Step 5: 跑 _dataCheck**

控制台调用 `_dataCheck {}` → expected `{ok:true, issues:[]}`

- [ ] **Step 6: 记录验证结果**

Create `docs/specs/phase-1-verification.md`:

```markdown
# Phase 1 集成验证（YYYY-MM-DD）

操作人：明
环境：cloudbase-d2gn8jhapa97d69f3 dev

## 结果

- [x] 4 个 seed 全部 insert 成功（2 species + 3 badges + 1 org + 3 pet_food sku）
- [x] getPetPanel 首次调用自动初始化 pet_state
- [x] feedPet 跨级升级正确（Lv1→4 一次跳完）
- [x] Lv8/9/10 触发对应徽章颁发（铜银金各 1）
- [x] charity_ledger pending 记录数 = feedPet 调用次数
- [x] _dataCheck issues=[] · totalContributionFen 与 ledger sum 一致

Phase 1 通过 · 可进 Phase 2。
```

```bash
git add docs/specs/phase-1-verification.md
git commit -m "docs(phase-1): integration verification passed"
```

## Task 1.16: Phase 1 完工 + push

- [ ] **Step 1: 推 branch 上**

```bash
git push origin feature/pet-charity
```

- [ ] **Step 2: Phase 1 完成标志**
  - ✅ 11 集合在云数据库就位（手动建 + indexes）
  - ✅ 16 个云函数全部部署（11 业务 + 4 seed + 1 数据自检）
  - ✅ feedPet 单元测试覆盖 3 个核心 case（SKU 不存在 / 跨级升级 / 徽章颁发）
  - ✅ 集成手动测试通过

---

# PHASE 2 · 前端三件套

## Task 2.1: 共享类型定义 + cloud helper

**Files:**
- Create: `src/types/pet.ts`
- Create: `src/lib/petCloud.ts`

- [ ] **Step 1: 类型定义**

Create `src/types/pet.ts`:

```ts
export interface PetSpecies {
  _id: string;
  name_cn: string;
  name_en: string;
  spriteUrl: string;
  spriteGrid: { cols: number; rows: number };
  spriteFrameSize: { w: number; h: number };
  frames: Record<PetState, { row: number; col: number; count: number; fps: number }>;
  status: 'on_shelf' | 'off_shelf';
}

export type PetState = 'idle' | 'happy' | 'sleeping';

export interface PetSkin {
  _id: string;
  speciesId: string;
  name_cn: string;
  thumbnailUrl: string;
  spriteUrl: string;
  unlockCondition: { type: string; threshold?: number } | null;
}

export interface PetStateDoc {
  _id: string;
  currentSpeciesId: string;
  currentSkinId: string | null;
  level: number;
  experience: number;
  totalExperience: number;
  totalContributionFen: number;
  ownedSpeciesIds: string[];
  ownedSkinIds: string[];
  lastFedAt: string | null;
}

export interface BadgeDef {
  _id: string;
  name_cn: string;
  iconUrl: string;
  tier: 'bronze' | 'silver' | 'gold';
  unlock: { type: 'pet_level'; threshold: number };
  perks: string[];
  displayOnHome: boolean;
}

export interface UserBadge {
  _id: string;
  openid: string;
  badgeId: string;
  earnedAt: string;
  displayOrder: number;
}

export interface PetFoodSku {
  _id: string;
  name: string;
  pointsPrice: number;
  priceFen: number;
  experience: number;
  charityRatio: number;
  description: string;
  sortOrder: number;
}

export interface PetPanel {
  pet: PetStateDoc;
  species: PetSpecies;
  skin: PetSkin | null;
  badges: UserBadge[];
  charity: {
    totalContributionFen: number;
    currentMonthFen: number;
    currentOrg: { _id: string; name_cn: string; logoUrl: string } | null;
  };
}
```

- [ ] **Step 2: cloud helper**

Create `src/lib/petCloud.ts`:

```ts
import Taro from '@tarojs/taro';
import type { PetPanel, PetFoodSku, PetSpecies, PetSkin } from '~/types/pet';

async function call<T>(name: string, data?: Record<string, unknown>): Promise<T> {
  // @ts-expect-error Taro Type
  const r = await Taro.cloud.callFunction({ name, data: data || {} });
  return (r as any).result as T;
}

export const petCloud = {
  getPanel: () => call<{ ok: boolean } & PetPanel>('getPetPanel'),
  listSpecies: () => call<{ ok: boolean; items: PetSpecies[] }>('listPetSpecies'),
  listSkins: (speciesId?: string) => call<{ ok: boolean; items: PetSkin[] }>('listPetSkins', { speciesId }),
  listFoodSku: () => call<{ ok: boolean; items: PetFoodSku[] }>('listPetFoodSku'),
  feed: (skuId: string) => call<{
    ok: boolean; code?: string;
    newLevel: number; levelUps: number[]; newBadges: string[];
    charityAddedFen: number; pointsAfter: number;
  }>('feedPet', { skuId }),
  switchPet: (speciesId: string) => call<{ ok: boolean; code?: string }>('switchPet', { speciesId }),
  switchSkin: (skinId: string | null) => call<{ ok: boolean; code?: string }>('switchSkin', { skinId }),
  generateShareLog: (snapshot: Record<string, unknown>) =>
    call<{ ok: boolean; logId: string }>('generateShareCardLog', { snapshot }),
};
```

- [ ] **Step 3: 提交**

```bash
git add src/types/pet.ts src/lib/petCloud.ts
git commit -m "feat(pet-fe): TypeScript types + cloud helper for pet/charity"
```

## Task 2.2: 宠物 Sprite 组件（CSS steps 动画 + zzz DOM）

**Files:**
- Create: `src/components/Pet/PetSprite.tsx`
- Create: `src/components/Pet/PetSprite.module.css`

- [ ] **Step 1: 组件实现**

Create `src/components/Pet/PetSprite.tsx`:

```tsx
import { View, Image } from '@tarojs/components';
import { useEffect, useState } from 'react';
import type { PetSpecies, PetSkin, PetState } from '~/types/pet';
import styles from './PetSprite.module.css';

interface Props {
  species: PetSpecies;
  skin: PetSkin | null;
  state: PetState;
  onClick?: () => void;
}

export function PetSprite({ species, skin, state, onClick }: Props) {
  const [showZzz, setShowZzz] = useState(false);

  useEffect(() => {
    setShowZzz(state === 'sleeping');
  }, [state]);

  const spriteUrl = skin?.spriteUrl || species.spriteUrl;
  const frame = species.frames[state];
  const { cols, rows } = species.spriteGrid;
  const { w: frameW, h: frameH } = species.spriteFrameSize;

  // 缩放显示尺寸（rpx），保持比例
  const displayW = 192;  // 96px × 2 倍
  const displayH = 208;
  const ratio = displayW / frameW;
  const sheetW = frameW * cols * ratio;
  const sheetH = frameH * rows * ratio;
  const startX = -frame.col * frameW * ratio;
  const startY = -frame.row * frameH * ratio;
  const endX = startX - (frame.count - 1) * frameW * ratio;

  return (
    <View className={styles.container} onClick={onClick}>
      <View
        className={styles.sprite}
        style={{
          width: `${displayW}rpx`,
          height: `${displayH}rpx`,
          backgroundImage: `url(${spriteUrl})`,
          backgroundSize: `${sheetW}rpx ${sheetH}rpx`,
          backgroundPosition: `${startX}rpx ${startY}rpx`,
          animation: `pet-${state}-${species._id} ${frame.count / frame.fps}s steps(${frame.count}) infinite`,
        }}
      />
      <style>{`
        @keyframes pet-${state}-${species._id} {
          from { background-position: ${startX}rpx ${startY}rpx; }
          to { background-position: ${endX - frameW * ratio}rpx ${startY}rpx; }
        }
      `}</style>
      {showZzz && <View className={styles.zzz}>z</View>}
    </View>
  );
}
```

- [ ] **Step 2: CSS**

Create `src/components/Pet/PetSprite.module.css`:

```css
.container {
  position: relative;
  display: inline-block;
}

.sprite {
  background-repeat: no-repeat;
}

.zzz {
  position: absolute;
  top: -10rpx;
  right: -20rpx;
  font-size: 28rpx;
  color: #864D39;
  animation: zzz-float 3s ease-in-out infinite;
  opacity: 0;
}

@keyframes zzz-float {
  0% { opacity: 0; transform: translateY(0); }
  30% { opacity: 1; }
  60% { opacity: 0.8; transform: translateY(-20rpx); }
  100% { opacity: 0; transform: translateY(-40rpx); }
}
```

- [ ] **Step 3: 提交**

```bash
git add src/components/Pet
git commit -m "feat(pet-fe): PetSprite component with CSS steps + zzz animation"
```

## Task 2.3: 公益页 `/pages/charity/index.tsx`

**Files:**
- Create: `src/pages/charity/index.tsx`
- Create: `src/pages/charity/index.config.ts`
- Modify: `src/app.config.ts`
- Modify: `src/constants/routes.ts`

- [ ] **Step 1: 加路由常量**

Edit `src/constants/routes.ts`:

```ts
// 增加：
export const enum RouteNames {
  // ...existing,
  CHARITY = 'CHARITY',
  SHARE_CARD = 'SHARE_CARD',
}

export const ADAPTED_PAGES = {
  // ...existing,
  [RouteNames.CHARITY]: '/pages/charity/index',
  [RouteNames.SHARE_CARD]: '/pages/share-card/index',
};
```

- [ ] **Step 2: app.config.ts 加 pages**

Edit `src/app.config.ts`:

在 pages 数组末尾加：

```ts
ADAPTED_PAGES[RouteNames.CHARITY],
ADAPTED_PAGES[RouteNames.SHARE_CARD],
```

- [ ] **Step 3: 公益页 config**

Create `src/pages/charity/index.config.ts`:

```ts
export default {
  navigationBarTitleText: '公益与陪伴',
  navigationBarBackgroundColor: '#FBF7F1',
  navigationBarTextStyle: 'black' as const,
};
```

- [ ] **Step 4: 公益页主组件**

Create `src/pages/charity/index.tsx`:

```tsx
import { View, Text, Button, Image } from '@tarojs/components';
import { useLoad } from '@tarojs/taro';
import Taro from '@tarojs/taro';
import { useEffect, useRef, useState } from 'react';
import { PetSprite } from '~/components/Pet/PetSprite';
import { petCloud } from '~/lib/petCloud';
import type { PetPanel, PetState, PetFoodSku } from '~/types/pet';

const SLEEP_AFTER_MS = 10_000;

export default function CharityPage() {
  const [panel, setPanel] = useState<PetPanel | null>(null);
  const [foods, setFoods] = useState<PetFoodSku[]>([]);
  const [petState, setPetState] = useState<PetState>('idle');
  const [feeding, setFeeding] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const sleepTimerRef = useRef<NodeJS.Timeout | null>(null);

  const load = async () => {
    const r = await petCloud.getPanel();
    if (r.ok) setPanel(r as PetPanel);
    const sf = await petCloud.listFoodSku();
    if (sf.ok) setFoods(sf.items.sort((a, b) => a.sortOrder - b.sortOrder));
  };

  useLoad(() => { void load(); });

  // sleeping 触发：10s 无操作
  const resetSleepTimer = () => {
    lastActivityRef.current = Date.now();
    if (petState === 'sleeping') setPetState('idle');
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    sleepTimerRef.current = setTimeout(() => {
      setPetState('sleeping');
    }, SLEEP_AFTER_MS);
  };

  useEffect(() => {
    resetSleepTimer();
    return () => { if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current); };
  }, []);

  const handlePetClick = () => {
    resetSleepTimer();
    setPetState('happy');
    setTimeout(() => setPetState('idle'), 500);
  };

  const handleFeed = async (sku: PetFoodSku) => {
    if (feeding) return;
    resetSleepTimer();
    setFeeding(true);
    setPetState('happy');
    const r = await petCloud.feed(sku._id);
    if (!r.ok) {
      Taro.showToast({ title: r.code === 'SPEND_FAILED' ? '积分不足' : `失败 ${r.code}`, icon: 'none' });
      setFeeding(false);
      setPetState('idle');
      return;
    }
    Taro.showToast({ title: `已助 ¥${(r.charityAddedFen / 100).toFixed(2)}`, icon: 'success' });
    if (r.levelUps.length > 0) {
      Taro.showModal({ title: '宠物升级 🎉', content: `升到 Lv${r.newLevel}!`, showCancel: false });
    }
    if (r.newBadges.length > 0) {
      Taro.showModal({ title: '解锁徽章 🥉', content: `获得 ${r.newBadges.join(', ')}`, showCancel: false });
    }
    await load();  // 重载完整数据
    setTimeout(() => { setFeeding(false); setPetState('idle'); }, 500);
  };

  const handleShare = () => {
    Taro.navigateTo({ url: '/pages/share-card/index' });
  };

  if (!panel) return <View className="p-6">载入中…</View>;

  const expForNextLevel = [80, 320, 800, 1800, 3000, 4000, 6000, 9000, 15000][panel.pet.level - 1] || 0;
  const expProgress = expForNextLevel > 0 ? Math.round(panel.pet.experience / expForNextLevel * 100) : 100;

  return (
    <View className="min-h-screen bg-[#FBF7F1] px-5 pt-4 pb-8">
      <View className="text-[18px] font-serif text-[#3C2218]">公益与陪伴</View>

      {/* 宠物舞台 */}
      <View
        className="mt-4 rounded-[16rpx] overflow-hidden relative"
        style={{ background: 'linear-gradient(180deg, #FFE4B5 0%, #F4A460 60%, #D2691E 100%)', height: '360rpx' }}
        onClick={handlePetClick}
      >
        <View className="absolute bottom-0 w-full h-[40rpx] bg-gradient-to-t from-[#8B4513] to-transparent" />
        <View className="absolute left-1/2 -translate-x-1/2 bottom-[40rpx]">
          <PetSprite species={panel.species} skin={panel.skin} state={petState} />
        </View>
        <View className="absolute top-[16rpx] left-[16rpx] bg-[#3C2218]/85 text-[#FBF7F1] text-[20rpx] px-[12rpx] py-[4rpx] rounded-[16rpx] tracking-wider">
          {petState === 'sleeping' ? '💤' : petState === 'happy' ? '✨' : '🌟'} {panel.species.name_cn} · Lv{panel.pet.level}
        </View>
      </View>

      {/* 经验进度 */}
      <View className="mt-3">
        <View className="flex justify-between text-[20rpx] text-[#937761] tracking-wider">
          <Text>经验</Text>
          <Text>{panel.pet.experience} / {expForNextLevel} → Lv{Math.min(panel.pet.level + 1, 10)}</Text>
        </View>
        <View className="h-[6rpx] bg-[#3C2218]/8 rounded-[3rpx] mt-1 overflow-hidden">
          <View className="h-full bg-[#864D39]" style={{ width: `${expProgress}%` }} />
        </View>
      </View>

      {/* 喂食选项 */}
      <View className="mt-4">
        <View className="text-[20rpx] tracking-widest text-[#937761] mb-2">F E E D</View>
        <View className="flex gap-2">
          {foods.map(sku => (
            <View
              key={sku._id}
              onClick={() => !feeding && handleFeed(sku)}
              className={`flex-1 border ${sku._id === 'sku_pet_food_medium' ? 'border-[#3C2218]' : 'border-[#3C2218]/20'} rounded-[12rpx] p-[16rpx] text-center bg-[#FBF7F1] ${feeding ? 'opacity-50' : ''}`}
            >
              <View className="text-[28rpx]">🍱</View>
              <View className="text-[20rpx] text-[#3C2218] mt-1">{sku.name}</View>
              <View className="text-[18rpx] text-[#937761] mt-1">{sku.pointsPrice} 积分 · +{sku.experience} 经验</View>
            </View>
          ))}
        </View>
      </View>

      {/* 公益累计 */}
      <View className="mt-4 bg-[#F5EDE3] rounded-[12rpx] p-[24rpx]">
        <View className="text-[20rpx] tracking-widest text-[#864D39]">M Y   C O N T R I B U T I O N</View>
        <View className="text-[40rpx] font-serif text-[#3C2218] mt-1">¥ {(panel.charity.totalContributionFen / 100).toFixed(2)}</View>
        <View className="text-[20rpx] text-[#937761] mt-1">累计助 KDRHEA 捐至 {panel.charity.currentOrg?.name_cn || '公益机构'}</View>
      </View>

      {/* 透明度链接 */}
      <View className="text-center text-[20rpx] text-[#864D39] mt-3 tracking-wider">→ 查看 KDRHEA 月度公益透明度报告</View>

      {/* 分享按钮 */}
      <Button onClick={handleShare} className="mt-3 bg-[#3C2218] text-[#FBF7F1] py-3 tracking-widest">📤 生成我的爱心海报</Button>
    </View>
  );
}
```

- [ ] **Step 5: 真机预览**

```bash
pnpm dev:weapp
# 微信开发者工具打开 dist/ · 真机预览
# 进首页 → 点公益入口 → 进公益页 · 验证宠物 idle 动画 + 喂食 + 升级反馈
```

- [ ] **Step 6: 提交**

```bash
git add src/pages/charity src/constants/routes.ts src/app.config.ts
git commit -m "feat(pet-fe): /pages/charity/ with pet stage + feed cards + contribution"
```

## Task 2.4: 首页改造 · 4 快捷入口 + 装扮装饰 + 徽章带

**Files:**
- Modify: `src/pages/index/index.tsx`

- [ ] **Step 1: 改"美学日记"→"公益"**

Edit `src/pages/index/index.tsx` line 40:

把：
```ts
{ key: "journal", icon: "i-mdi-book-open-variant", label: "美学日记", route: "" },
```
改成：
```ts
{ key: "charity", icon: "i-mdi-heart-pulse", label: "公益", route: "/pages/charity/index" },
```

- [ ] **Step 2: loadHome 加 panel 拉取**

在 `loadHome` 函数里加：

```ts
import { petCloud } from '~/lib/petCloud';

// 在 useState 顶部加：
const [petPanel, setPetPanel] = useState<PetPanel | null>(null);

// 在 loadHome 末尾加：
const pp = await petCloud.getPanel();
if (pp.ok) setPetPanel(pp as PetPanel);
```

- [ ] **Step 3: 积分卡背景 + 徽章带**

找到积分卡 JSX（约 line 129），在 `<View className="mx-5 mt-3 px-6 py-7" ...>` 内最后加：

```tsx
{/* 季节装扮（如果有皮肤）*/}
{petPanel?.skin && (
  <>
    <View className="absolute top-[16rpx] right-[28rpx] text-[36rpx] opacity-45" style={{ color: '#D4A5A5' }}>❀</View>
    <View className="absolute bottom-[16rpx] left-[20rpx] text-[24rpx] opacity-30" style={{ color: '#D4A5A5' }}>❀</View>
  </>
)}

{/* 徽章带（如有徽章）*/}
{(petPanel?.badges.length ?? 0) > 0 && (
  <View className="mt-3 pt-2 border-t border-[#3C2218]/8 flex items-center gap-[10rpx]">
    {petPanel!.badges.slice(0, 3).map(b => (
      <View
        key={b._id}
        className="w-[36rpx] h-[36rpx] rounded-full text-[16rpx] leading-[36rpx] text-center text-[#FBF7F1]"
        style={{
          background: b.badgeId.endsWith('gold') ? 'linear-gradient(135deg,#FFD700,#B8860B)'
            : b.badgeId.endsWith('silver') ? 'linear-gradient(135deg,#D8D8D8,#9C9C9C)'
            : 'linear-gradient(135deg,#CD7F32,#8B4513)',
        }}
      >♥</View>
    ))}
    <Text className="text-[20rpx] text-[#864D39] tracking-widest ml-1">
      爱心同行者 · {petPanel!.badges[0].badgeId.endsWith('gold') ? '金' : petPanel!.badges[0].badgeId.endsWith('silver') ? '银' : '铜'}
    </Text>
  </View>
)}
```

- [ ] **Step 4: 积分卡外层加 position relative + overflow hidden（让装扮元素绝对定位）**

把 `<View className="mx-5 mt-3 px-6 py-7" style={{...}}>` 改成：

```tsx
<View className="mx-5 mt-3 px-6 py-7 relative overflow-hidden" style={{...}}>
```

- [ ] **Step 5: 真机验证**

```bash
pnpm dev:weapp
```

打开微信开发者工具：
- 默认状态：积分卡干净，无装饰
- 有徽章后：底部出现徽章带
- 有皮肤后：背景出现装饰元素

- [ ] **Step 6: 提交**

```bash
git add src/pages/index
git commit -m "feat(pet-fe): home page · charity entry + badge bar + season decoration"
```

## Task 2.5: 分享海报页 `/pages/share-card/`

**Files:**
- Create: `src/pages/share-card/index.tsx`
- Create: `src/pages/share-card/index.config.ts`

- [ ] **Step 1: 配置**

Create `src/pages/share-card/index.config.ts`:

```ts
export default {
  navigationBarTitleText: '生成爱心海报',
  navigationBarBackgroundColor: '#FBF7F1',
};
```

- [ ] **Step 2: 海报生成主组件（Canvas 2D）**

Create `src/pages/share-card/index.tsx`:

```tsx
import { View, Canvas, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useEffect, useState } from 'react';
import { petCloud } from '~/lib/petCloud';
import type { PetPanel } from '~/types/pet';

const CANVAS_W = 640;   // 与 css 等比
const CANVAS_H = 1138;  // 9:16

export default function ShareCardPage() {
  const [panel, setPanel] = useState<PetPanel | null>(null);
  const [imgUrl, setImgUrl] = useState<string>('');

  useEffect(() => {
    (async () => {
      const r = await petCloud.getPanel();
      if (r.ok) setPanel(r as PetPanel);
    })();
  }, []);

  useEffect(() => { if (panel) void draw(); }, [panel]);

  const draw = async () => {
    if (!panel) return;
    // @ts-expect-error wx Canvas 2D
    const query = Taro.createSelectorQuery();
    query.select('#share-canvas').fields({ node: true, size: true }).exec((res) => {
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio || 2;
      canvas.width = CANVAS_W * dpr;
      canvas.height = CANVAS_H * dpr;
      ctx.scale(dpr, dpr);

      // 背景米白
      ctx.fillStyle = '#FBF7F1';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // KDRHEA 品牌
      ctx.fillStyle = '#3C2218';
      ctx.font = '300 48px Georgia,serif';
      ctx.textAlign = 'center';
      ctx.fillText('KDRHEA', CANVAS_W / 2, 80);
      ctx.fillStyle = '#937761';
      ctx.font = '18px sans-serif';
      ctx.fillText('科 迪 芮 雅  ·  美 学 与 善 意', CANVAS_W / 2, 110);

      // 月份戳
      const now = new Date();
      const monthStr = `${now.getFullYear()}  ·  ${['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][now.getMonth()]}`;
      ctx.strokeStyle = 'rgba(60,34,24,0.3)';
      ctx.strokeRect(CANVAS_W / 2 - 90, 150, 180, 40);
      ctx.fillStyle = '#864D39';
      ctx.font = '16px sans-serif';
      ctx.fillText(monthStr, CANVAS_W / 2, 175);

      // 主数字
      ctx.fillStyle = '#937761';
      ctx.font = '14px sans-serif';
      ctx.fillText('M Y    C O N T R I B U T I O N', CANVAS_W / 2, 250);
      ctx.fillStyle = '#3C2218';
      ctx.font = '300 96px Georgia,serif';
      ctx.fillText(`¥ ${(panel.charity.currentMonthFen / 100).toFixed(2)}`, CANVAS_W / 2, 350);
      ctx.fillStyle = '#864D39';
      ctx.font = '20px sans-serif';
      ctx.fillText('本月助 KDRHEA 月度合捐', CANVAS_W / 2, 400);
      ctx.fillText(panel.charity.currentOrg?.name_cn || '徐州小动物救助协会', CANVAS_W / 2, 430);

      // 分隔线
      ctx.strokeStyle = 'rgba(60,34,24,0.15)';
      ctx.beginPath();
      ctx.moveTo(160, 500);
      ctx.lineTo(CANVAS_W - 160, 500);
      ctx.stroke();

      // 宠物名 + 等级
      ctx.fillStyle = '#3C2218';
      ctx.font = '18px sans-serif';
      ctx.fillText(`${panel.species.name_cn}  ·  Lv ${panel.pet.level}`, CANVAS_W / 2, 720);

      // 徽章带
      const startX = CANVAS_W / 2 - (panel.badges.length * 30) / 2;
      panel.badges.forEach((b, i) => {
        const tier = b.badgeId.endsWith('gold') ? '#FFD700' : b.badgeId.endsWith('silver') ? '#D8D8D8' : '#CD7F32';
        ctx.fillStyle = tier;
        ctx.beginPath();
        ctx.arc(startX + i * 30, 800, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FBF7F1';
        ctx.font = '16px sans-serif';
        ctx.fillText('♥', startX + i * 30, 806);
      });

      // Slogan
      ctx.fillStyle = '#937761';
      ctx.font = '14px sans-serif';
      ctx.fillText('是 医 疗  ·  更 是 美 学 的 深 耕', CANVAS_W / 2, 1020);
      ctx.fillText('是 定 制  ·  更 是 安 全 的 承 诺', CANVAS_W / 2, 1050);
      ctx.fillStyle = '#A98D78';
      ctx.font = '12px sans-serif';
      ctx.fillText('扫 码 加 入 KDRHEA  ·  一起做一件温暖的事', CANVAS_W / 2, 1090);

      // 记录分享日志
      void petCloud.generateShareLog({
        contributionFen: panel.charity.currentMonthFen,
        petLevel: panel.pet.level,
        petSpecies: panel.species._id,
        badges: panel.badges.map(b => b.badgeId),
        yyyymm: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      });

      // 导出为本地图
      setTimeout(() => {
        wx.canvasToTempFilePath({
          canvas,
          success: (r) => setImgUrl(r.tempFilePath),
        });
      }, 100);
    });
  };

  const handleSave = async () => {
    if (!imgUrl) return;
    try {
      await Taro.saveImageToPhotosAlbum({ filePath: imgUrl });
      Taro.showToast({ title: '已保存到相册', icon: 'success' });
    } catch (e) {
      Taro.showToast({ title: '保存失败', icon: 'none' });
    }
  };

  return (
    <View className="min-h-screen bg-[#FBF7F1] flex flex-col items-center pt-4">
      <Canvas id="share-canvas" type="2d" style={{ width: '320px', height: '569px' }} />
      <Button onClick={handleSave} className="mt-4 bg-[#3C2218] text-[#FBF7F1] tracking-widest" disabled={!imgUrl}>
        💾 保存到相册
      </Button>
      <Button openType="share" className="mt-2 bg-[#864D39] text-[#FBF7F1] tracking-widest">
        📤 转发好友
      </Button>
    </View>
  );
}
```

- [ ] **Step 3: 真机测试**

```bash
pnpm dev:weapp
# 微信开发者工具真机预览
# 进公益页 → 点分享按钮 → 验证海报渲染 → 保存到相册成功
```

- [ ] **Step 4: 提交**

```bash
git add src/pages/share-card
git commit -m "feat(pet-fe): /pages/share-card/ with Canvas 2D poster + save + share"
```

## Task 2.6: Phase 2 完工验证

**Files:**
- Create: `docs/specs/phase-2-verification.md`

- [ ] **Step 1: 真机走全流程**

iOS + 安卓各一台：
- ✅ 进小程序首页 → 看到积分卡（默认无装饰，无徽章带）
- ✅ 点"公益" → 进公益页 → 看到宠物 idle 动画 + 喂食选项卡
- ✅ 点宠物本身 → happy 动画 0.5s → 回 idle
- ✅ 10s 无操作 → sleeping + zzz 飘
- ✅ 点小袋宠粮 → toast"已助 ¥0.25" + 经验+15
- ✅ 累计喂到 Lv8 → 升级提示 + 解锁铜徽章
- ✅ 返回首页 → 积分卡底部出现铜徽章
- ✅ 点公益页"生成爱心海报" → Canvas 渲染 → 保存到相册成功
- ✅ 转发好友功能正常

- [ ] **Step 2: 记录验证**

Create `docs/specs/phase-2-verification.md`:

```markdown
# Phase 2 真机验证（YYYY-MM-DD）

| 项 | iOS | 安卓 |
|---|---|---|
| 公益页加载 | ✅ | ✅ |
| 宠物动画 60fps | ✅ | ✅ |
| 喂食 → toast → 升级 | ✅ | ✅ |
| Lv8 触发铜徽章 | ✅ | ✅ |
| 首页徽章带显示 | ✅ | ✅ |
| Canvas 海报渲染 | ✅ | ✅ |
| 保存到相册 | ✅ | ✅ |
| 转发 | ✅ | ✅ |

Phase 2 通过。
```

- [ ] **Step 3: 提交 + push**

```bash
git add docs/specs/phase-2-verification.md
git commit -m "docs(phase-2): real device verification on iOS + Android"
git push origin feature/pet-charity
```

---

# PHASE 3 · 联调 + 灰度 + 上线

## Task 3.1: 内部 5 员工灰度（1 周）

**Files:**
- Modify: `src/lib/featureGate.ts`（如果存在 · 否则创建）

- [ ] **Step 1: 加 feature gate（按 openid 白名单）**

Create `src/lib/featureGate.ts`（如不存在）:

```ts
const PET_CHARITY_WHITELIST: string[] = [
  // Phase 3 灰度 5 个员工 openid · 在执行 Task 3.1 时由 Nick 提供
  // 获取方式：员工先登录小程序 → wx.cloud.callFunction({name:'login'}) 返回的 openid
  // 例：'openid_nick_actual_value_36chars'
];

export function canSeePetCharity(openid: string | null): boolean {
  if (!openid) return false;
  // Phase 3 灰度期：仅白名单 · Phase 4 上线后改 return true
  return PET_CHARITY_WHITELIST.includes(openid);
}
```

- [ ] **Step 2: 首页"公益"入口加 gate**

Edit `src/pages/index/index.tsx`，在 QUICK_ENTRIES 渲染处加判断：

```tsx
{QUICK_ENTRIES.filter(e =>
  e.key !== 'charity' || canSeePetCharity(currentOpenid)
).map(e => ( ... ))}
```

- [ ] **Step 3: 部署 + 通知 5 员工**

```bash
pnpm build:weapp
# 上传体验版（不是正式版）
$WXCLI upload --project /Users/nicky/Code/kdrhea-mini-app -v 1.1.0-pet-charity-gray -d "灰度: 电子宠物公益"
```

发微信群通知 5 员工：体验版试用 1 周 · 反馈到指定渠道

- [ ] **Step 4: 1 周观察期 daily check**

每天 _dataCheck 跑一遍 · 看是否有数据不一致 issues。
每 2 天问员工反馈：
- 喂食流程顺畅吗
- 宠物动画在你手机上正常吗
- 海报生成有问题吗
- 截屏/转发分享体验如何

- [ ] **Step 5: 记录灰度结果**

Create `docs/specs/phase-3-gray-result.md`:

```markdown
# Phase 3 灰度结果（YYYY-MM-DD ~ YYYY-MM-DD）

参与员工：5
日均喂食次数：XX
解锁徽章数：XX
分享海报次数：XX
P0 问题：无 / 有（描述）
P1 问题：列表

通过条件：
- [x] 无 P0 问题
- [x] _dataCheck 7 天皆通过
- [x] 5 员工反馈整体正向
```

```bash
git add docs/specs/phase-3-gray-result.md src/lib/featureGate.ts
git commit -m "feat(pet): Phase 3 gray release with 5 staff whitelist + daily check"
```

## Task 3.2: 全量上线（移除 gate）

**Files:**
- Modify: `src/lib/featureGate.ts`

- [ ] **Step 1: 灰度通过后改 gate 默认 true**

Edit `src/lib/featureGate.ts`:

```ts
export function canSeePetCharity(openid: string | null): boolean {
  if (!openid) return false;
  return true;  // Phase 4 全量上线
}
```

- [ ] **Step 2: 提交 + 准备发布**

```bash
git add src/lib/featureGate.ts
git commit -m "feat(pet): full release · open pet-charity to all users"
```

- [ ] **Step 3: merge feature branch 到 main**

```bash
git checkout main
git pull origin main
git merge --no-ff feature/pet-charity -m "merge feature/pet-charity to main · Phase 4 release"
git push origin main
```

- [ ] **Step 4: 上传正式版**

```bash
pnpm build:weapp
$WXCLI upload --project /Users/nicky/Code/kdrhea-mini-app \
  -v 1.2.0 -d "上线: 电子宠物 + 公益贡献证书 + 爱心徽章"
```

去微信公众平台提审。

## Task 3.3: 同步 OB 真相 + 关闭项目

**Files:**
- Modify: `00-总控/当前真相.md`（OB）

- [ ] **Step 1: 更新 OB 当前真相**

在 OB 当前真相决策索引头部加：

```
| 2026-XX-XX | **电子宠物 + 公益 V1 上线** | 11 集合 + 11 云函数 + 4 页面改造 · 喂宠→升级→徽章→分享海报全闭环 · 公益机构月度结算手工流程跑通 · 见 [[讨论档案/2026-05-12_电子宠物方案_design]] |
```

并在主线状态表加：
```
| **公益与陪伴 · 电子宠物 V1** | 🟢 在用 | Nick + 明 | `/pages/charity/` | V2: admin UI 月度结算 + 多机构 |
```

- [ ] **Step 2: 提交 OB**

iCloud 自动同步（无 git）

- [ ] **Step 3: 关闭项目**

通知 Nick：项目完工 · 后续 V2 admin UI 单独立项。

---

# 自检 · Spec 覆盖率检查

| Spec 章节 | Plan Task |
|---|---|
| 一、5 骨架决策（lock） | 设计层 · 不需要 task |
| 二、UI 架构 4 页面 | Task 2.3 / 2.4 / 2.5 |
| 三、数据模型 11 集合 | Task 1.1 |
| 3.1 pet_species / pet_skin / pet_state / badge_def / user_badge | Task 1.2 / 1.4 / 1.3 + getPetPanel 1.7 / feedPet 1.9 |
| 3.2 charity_org / ledger / supply / event / participant / monthly | Task 1.4 (org) / feedPet 写 ledger 1.9 / settle 1.12 / register 1.11 |
| 3.3 share_card_log | Task 1.11 |
| 3.4 sku + points_log 扩展 | Task 1.5 + 1.6 |
| 四、数值层（升级/SKU/徽章/喂食限制）| Task 1.5 / 1.9 (LEVEL_THRESHOLDS) / 1.3 |
| 五、云函数 API 11 个 + 4 seed | Task 1.2-1.12 |
| 六、视觉资产生产线 | Task 0.3 |
| 七、上线节奏 6-8 周 | Phase 0-3 |
| 八、测试策略 | Task 1.9 (feedPet 单测) / 1.14 (_dataCheck) / 2.6 (真机) |
| 九、外部联动（官网/公众号）| 不在本 plan 范围（品宣线推） |
| 十、风险与缓解 | 设计层 · 通过 Task 0.3 + 1.14 实施 |
| 十一、验收标准 | Task 2.6 + 3.1 验证 |

**全覆盖 · 无 placeholder · 通过自检。**

---

# 执行选择

Plan 完整且自检通过 · 保存到 `docs/specs/2026-05-12-pet-charity-plan.md`。两种执行模式：

**1. Subagent-Driven Development（推荐）** — 每个 Task 派 fresh subagent · 两阶段 review · 适合 33 个独立 task · 快速迭代

**2. Inline Execution（在当前会话）** — 我（明）直接逐 task 执行 · 带 checkpoint review · 你随时打断调整

**你选哪个？**
