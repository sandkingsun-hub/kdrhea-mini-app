# 集合 indexes 配置（控制台手动建）

> 集合本身在 dev seed 脚本首次插入数据时自动创建（CloudBase NoSQL 特性）。
> Indexes 需要在 CloudBase 数据库控制台 → 集合 → 索引管理 中手动配置。
> 性能关键：feedPet 高频写 charity_ledger · getPetPanel 读 pet_state · user_badge 防重复颁发。

| 集合 | 索引字段 | 类型 | 说明 |
|---|---|---|---|
| pet_state | _id | 主键 | openid as _id（无需另建） |
| user_badge | (openid, badgeId) | unique compound | 防重复颁发 |
| user_badge | openid | non-unique | 列我的徽章 |
| charity_ledger | openid | non-unique | 查个人记账 |
| charity_ledger | (status, settledMonth) | non-unique compound | settle 查 pending |
| charity_supply_log | occurredAt | non-unique desc | admin 列表 |
| charity_event | status | non-unique | 列已发布活动 |
| charity_event_participant | (eventId, openid) | unique compound | 防重复报名 |
| share_card_log | openid | non-unique | 统计分享 |

## 创建顺序

1. Phase 1 Task 1.2-1.5 dev seed 跑完后，集合自动出现
2. 进入控制台 → 数据库 → 选集合 → 索引管理 → 按上表逐个加
3. 集成测试（Task 1.15）前完成所有 index 创建
