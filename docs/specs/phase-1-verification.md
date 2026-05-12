# Phase 1 集成验证（2026-05-12）

操作人：明 (Claude Opus 4.7) · 通过 subagent + 手动协作
环境：cloudbase-d2gn8jhapa97d69f3 dev
分支：feature/pet-charity

## 部署 + 验证结果

### Dev seed（4 个 · invoke 验证）

| 函数 | invoke | 结果 |
|---|---|---|
| `devSeedPetSpecies` | `{}` | `{"ok":true,"inserted":2,"skipped":0}` · cat_orange + dog_shiba |
| `devSeedBadgeDef` | `{}` | `{"ok":true,"inserted":3,"skipped":0}` · bronze/silver/gold |
| `devSeedCharityOrg` | `{}` | `{"ok":true,"inserted":1,"skipped":0}` · xuzhou_animal_rescue |
| `devSeedPetSkin` | `{}` | `{"ok":true,"inserted":0,"skipped":0,"message":"V1: no skin seeded by design"}` |
| `devSeedPetFoodSku` | `{}` | `{"ok":true,"inserted":3,"skipped":0}` · small/medium/large |

### 用户读（5 个 · 4 个独立 invoke + 1 个需 OPENID 跳过）

| 函数 | invoke | 结果 |
|---|---|---|
| `listPetSpecies` | `{}` | `{"ok":true,"items":[...2 items]}` |
| `listPetSkins` | `{}` | `{"ok":true,"items":[]}` (V1 空) |
| `listPetFoodSku` | `{}` | `{"ok":true,"items":[...3 items]}` |
| `listCharityEvents` | `{}` | `{"ok":true,"items":[]}` |
| `getPetPanel` | (跳过) | 需 OPENID context · 前端 wx.cloud 调用验证 |

### 用户写（5 个 · 全部需 OPENID · 前端集成时验证）

| 函数 | 部署 | 备注 |
|---|---|---|
| `feedPet` | ✅ 2.3 KB | 含 3 个 jest 单测全过（SKU_NOT_FOUND / 跨级升级 / 徽章颁发） |
| `switchPet` | ✅ 865 B | 部署多次失败 · 最终 tcb fn code update 救活 |
| `switchSkin` | ✅ 865 B | |
| `registerCharityEvent` | ✅ 1.2 KB | badge-gated |
| `generateShareCardLog` | ✅ 923 B | |

### 定时 + 数据自检

| 函数 | invoke | 结果 |
|---|---|---|
| `settleMonthlyCharity` | `{}` | `{"ok":true,"monthKey":"2026-04","totalFen":0,"contributorsCount":0,"byOrg":[]}` · 幂等通过 |
| `dataCheck` | `{}` | `{"ok":true,"issues":[],"totalChecked":{"userBadges":0,"pets":0}}` · 初始数据无 issues |

### 现有云函数扩展

| 函数 | 改动 | 验证 |
|---|---|---|
| `spendPoints` | ALLOWED_TYPES 加 `spend_pet_food` | 部署成功 · feedPet 测试调用通过 |

## 集合状态

部署后 dev seed 触发自动创建（CloudBase NoSQL ensureCollection 模式）：

```
✅ pet_species (2 docs · cat_orange + dog_shiba)
✅ badge_def (3 docs · bronze/silver/gold)
✅ charity_org (1 doc · xuzhou_animal_rescue)
✅ sku (+ 3 docs · pet_food 类)
（待真实使用时按需创建）
- pet_state · pet_skin · user_badge · charity_ledger
- charity_supply_log · charity_event · charity_event_participant
- charity_monthly · share_card_log
```

## 关键经验沉淀

1. **CloudBase 集合不自动创建** — dev seed 必须先 `db.createCollection()` 才能 add（spec/plan 已修正）
2. **函数名不能下划线开头** — `_dataCheck` 部署失败 · 改名 `dataCheck`
3. **wxdev cli deploy 偶发 timeout / Update failed** — 兜底方案：删除函数后重 deploy · 或用 `tcb fn code update --deployMode cos`
4. **wxdev cli 新建函数会卡 Creating 状态几十秒** — 同时 update code 会失败 · 必须等 Active 再 update

## Phase 1 完工 · 准备进 Phase 2

- ✅ 16 个云函数全部部署成功（含 1 个 fix + 1 重命名）
- ✅ 关键事务 feedPet 含 jest 单测覆盖
- ✅ 数据自检 dataCheck 通过
- ✅ 月度结算 settleMonthlyCharity 验证幂等
- ✅ 集合按需自动创建 ensureCollection 模式落实
