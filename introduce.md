# 客服排班管理系统 · 项目说明

> 最后更新：2026-03-10

> ⚠️ **维护约定**：后续项目的结构和功能若有任何改变，请同步更新本文件，以便快速了解项目全貌。

---

## 项目概述

本项目是一套面向客服团队的 **排班管理系统**，覆盖从意愿采集、规则设定到自动排班的完整生命周期。系统以网页应用形式运行，支持多角色使用（员工自助填报 / 管理员看板审阅）。

---

## 技术栈

| 层级 | 技术 |
|---|---|
| 框架 | Next.js 16 (App Router，`'use client'`) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS v4 |
| 图标 | Lucide React |
| 日期工具 | date-fns v4（含 `zhCN` 中文 locale） |
| 状态管理 | React `useState` / `useEffect`（局部） |
| ORM | Prisma v6（SQLite，dev.db） |
| 运行端口 | 3001（开发环境） |

---

## 目录结构

```
/
├── src/
│   ├── app/
│   │   ├── page.tsx              # 主入口，所有页面逻辑合并在此文件
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       ├── config/
│   │       │   ├── route.ts                  # 全局配置（预留）
│   │       │   ├── holidays/route.ts         # 节假日配置 GET/PUT（持久化到 AuditLog）
│   │       │   ├── member-holiday/route.ts   # 成员法定节假日排班天数
│   │       │   └── min-staff/route.ts        # 最低排班人数配置
│   │       ├── schedule/
│   │       │   ├── draw/route.ts             # 排班计算触发（预留）
│   │       │   └── init/route.ts             # 初始化排班（预留）
│   │       └── stats/route.ts                # 统计数据
│   └── lib/
│       ├── prisma.ts
│       ├── feishu.ts              # 飞书通知（预留）
│       ├── scheduler.ts
│       └── mock-data.json
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── public/
```

---

## 页面结构（Tab 页签）

| Tab ID | 标签 | 功能描述 |
|---|---|---|
| `calendar` | 排班看板 | 查看当月/下月已应用排班方案，日历 + 表格双视图 |
| `leave-request` | 休息日预填 | 员工填写指定月份轮休/请假意愿，日历交互 |
| `schedule-calc` | 排班计算 | 排班进度看板 + 意愿汇总 + 自动排班计算 + 方案管理 |
| `members` | 成员管理 | 客服人员 CRUD，含岗位、参与排班开关 |
| `settings` | 全局配置 | 节假日配置、最低排班人数配置 |

---

## 核心状态变量（`page.tsx` 组件级）

| 变量 | 类型 | 说明 |
|---|---|---|
| `currentDate` | `Date` | 系统当前日期基准（固定 2026-03-05，用于演示） |
| `currentUser` | `string` | 当前登录用户（固定 `"何咏琪"`，用于演示） |
| `activeTab` | `TabType` | 当前激活页签 |
| `membersList` | `MemberItem[]` | 成员列表（localStorage 持久化） |
| `leaveData` | `Record<string, '轮休'\|'请假'>` | 当前用户预填意愿（key = `yyyy-MM-d`） |
| `calcMonth` | `Date` | 排班计算页筛选月份 |
| `fillMonth` | `Date` | 休息日预填页筛选月份（默认次月） |
| `calcDayMinStaffOverrides` | `Record<string, number>` | 每日最低排班人数覆盖（key = `yyyy-MM-dd`，localStorage 持久化） |
| `calcDayTypeOverridesDraft` | `Record<string, string>` | 编辑日历时日期类型草稿（用于取消恢复） |
| `calcDayMinStaffOverridesDraft` | `Record<string, number>` | 编辑日历时最低人数草稿（用于取消恢复） |
| `prefillOpenMap` | `Record<string, boolean>` | 各月份"开放预填"开关（localStorage 持久化，key = `yyyy-MM`） |
| `savedSchedules` | `SavedSchedule[]` | 已保存排班方案（localStorage 持久化） |
| `appliedSchedules` | `Record<string, SavedSchedule>` | 各月已应用方案（localStorage 持久化，key = `yyyy-MM`） |
| `globalHolidayConfig` | `HolidayRow[]` | 全局节假日配置（从 API 加载） |
| `minStaffConfig` | `Record<string, number>` | 最小排班人数（从 API 加载，key = 班次类型） |

---

## 数据结构

### `MemberItem`

```ts
type MemberItem = {
  name: string;
  role: string;          // '租号客服' | '卖号客服' | '管理员'
  status: string;        // '在职'
  inSchedule: boolean;   // 是否参与排班计算
};
```

> 注：已移除 `group`（分组）字段。旧 localStorage 数据会在加载时自动迁移（`inSchedule` 缺失时默认 `true`，`group` 字段丢弃）。

### `HolidayRow`

```ts
type HolidayRow = {
  date: string;          // 'yyyy/MM/dd'
  name: string;
  type: '节假日' | '调休上班日';
  isLegal: boolean;      // 是否为法定连休（计入节假日排班额度）
};
```

### `SavedSchedule`

```ts
type SavedSchedule = {
  id: string;
  planName: string;
  month: string;         // 'yyyy-MM'
  schedule: Record<string, Record<number, '早' | '晚' | '休' | '假'>>;
};
```

---

## 成员初始数据（`MEMBERS` 常量）

```ts
const MEMBERS = [
  { name: '何咏琪', role: '租号客服', status: '在职', inSchedule: true },
  { name: '向桂华', role: '租号客服', status: '在职', inSchedule: true },
  { name: '谢彦婷', role: '租号客服', status: '在职', inSchedule: true },
  { name: '汪宗顶', role: '租号客服', status: '在职', inSchedule: true },
  { name: '彭琪瑛', role: '租号客服', status: '在职', inSchedule: true },
];
```

---

## 功能详解

### 排班看板（calendar）

- 展示已应用（`appliedSchedules`）的排班方案
- 日历视图 / 表格视图切换
- 支持"仅看我"过滤（仅展示当前用户的排班）
- 上月 / 下月导航

---

### 休息日预填（leave-request）

- **月份下拉筛选**：当前日期后续 3 个月份可选，`fillMonth` state 驱动日历与数据
- **日历交互**：点击格子填入"轮休"或"请假"，再次点击循环切换或取消；仅当月格子可操作
- **额度计算**：每月可轮休天数由 `minStaffConfig` + 参与排班人数联动决定
- **`isCurr` 年月双重校验**：避免跨年判断错误（同时比较年份和月份）- **操作按钮**：仅保留「提交采集意愿」按钮（已移除“暂存草稿”按钮）
#### 蒙版逻辑（双条件不可填写）

| 条件 | 提示文案 |
|---|---|
| `isCurrentUserScheduled === false` | 🚫 您不在排班成员中，无需填写。 |
| `isFillPrefillOpen === false` | 🔒 该月份尚未开放填写，请耐心等待通知。 |

`isFillPrefillOpen` 判断：`prefillOpenMap[yyyy-MM]` 有手动记录则直接采用，否则自动判断今日是否 ≥ 所选月份前一月的第 20 日。

---

### 排班计算（schedule-calc）

#### ① X月排班进度（横向节点进度条）

3 个节点横向排列，节点间有动态颜色连接线，状态为"未开始 / 进行中 / 已完成"，显示在"预设休息日统计"板块上方。

| # | 节点名 | 已完成条件 | 进行中条件 |
|---|---|---|---|
| 1 | 确认排班配置 | 轮休意愿节点为进行中或已完成，**或**今日 ≥ 前月20日 | 今日在前月第18~19日，**或**18日前已有成员提交意愿 |
| 2 | 轮休意愿采集 | 有提交意愿 **且** 存在已保存方案，**或**今日 ≥ 前月第22日 | 有提交意愿但无保存方案，**或**今日在前月第20~21日 |
| 3 | 排班计算 | 该月存在已发布方案（`appliedSchedules[yyyy-MM]` 非空） | 该月存在已保存方案但尚未应用发布 |

> `node2Status` 先于 `node1Status` 计算，因为 node1 的逻辑依赖 node2 的结果。

#### ② 开放预填开关

- 位于"预设休息日统计"板块标题右侧的 Toggle 开关
- 手动点击 → 写入 `prefillOpenMap[progressMonthYM]`，localStorage 持久化
- 说明文字：将于每月 20 日自动开放次月预填
- `effectivePrefillOpen`：有手动覆盖值时采用，否则判断今日是否 ≥ 前月第20日

#### ③ 预设休息日统计

- 汇总展示各参与排班成员（`inSchedule = true`）的轮休/请假意愿
- 显示列：成员姓名、岗位、轮休天数、请假天数、剩余额度、已提交状态

#### ④ 排班计算算法（`performScheduleCalc`）

**仅处理 `inSchedule = true` 的成员**（第一步 `const scheduledMembers = membersList.filter(m => m.inSchedule)`，后续所有逻辑使用 `scheduledMembers`）

| 步骤 | 说明 |
|---|---|
| ① | 计算全月日历（工作日 / 周末 / 节假日 / 调休工作日 / 假前一日） |
| ② | 汇总各人轮休/请假意愿 |
| ③ | 计算每人严格休息额度（总天数 − 工作日 − 法定加班） |
| ④ | 超额检查：当日可休人数超限则随机剔除轮休意愿（保留请假） |
| ⑤ | 按额度分配休日（优先满足意愿 → 随机补足 → 容量放宽兜底） |
| ⑥ | 连续上班 > 6 天强制插入一天休息 |
| ⑦ | 分配早/晚班（偶数人各半；奇数人晚班多一；晚班次日不得接早班） |
| ⑧ | 确保每日最低排班人数（不足则将休→早班） |
| ⑨ | 验证结果，不符条件则自动重试（最多 8 次） |
| ⑩ | 输出逐日排班明细，写入日志 |

#### ⑤ 日历展示（底部）

- 每日格子右上角展示「最低排班人数」徽章（默认从全局配置按日期类型查找，支持每日覆盖）
- 点击「编辑日历」进入编辑模式：可修改日期类型和每日最低排班人数
- 编辑模式下，「保存」按钮左侧新增「取消」按钮，取消可恢复编辑前的状态并退出编辑模式
- 每日最低排班人数规则：
  - 未手动修改时，默认值 = 对应日期类型在【全局配置】中的最低排班人数
  - 手动修改并保存后，该日期的最低排班人数以修改后的数据为准
  - 数据持久化到 `localStorage('cs_day_min_staff_overrides')`
- 排班计算时，各日期的最低排班人数以此日历最终修改并保存的人数为准

#### ⑥ 方案管理

- **保存草稿**：命名后存入 `savedSchedules`（localStorage）
- **应用方案**：写入 `appliedSchedules[月份]`，同步显示在排班看板
- **删除方案**：二次确认弹窗后移除

---

### 成员管理（members）

- **列表字段**：姓名 / 岗位 / 状态 / 参与排班（**已移除分组字段**）
- **参与排班 Toggle**：每行末尾的开关，实时更新 `inSchedule`，影响排班计算与预填统计
- **岗位选项**：租号客服 / 卖号客服 / 管理员
- **添加成员规则**：岗位为"租号客服"时 `inSchedule` 默认 `true`，其他岗位默认 `false`
- **持久化**：所有变更存入 `localStorage('cs_members')`
- **旧数据迁移**：含 `group` 字段或缺少 `inSchedule` 的旧数据，加载时自动转换兼容

---

### 全局配置（settings）

- **节假日配置**：表格可编辑，PUT 持久化到数据库（`AuditLog`，`action = 'holiday-config'`）
- **最低排班人数**：按班次类型（普通工作日 / 假前一日 / 周末 / 法定节假日 / 调休工作日）分别配置

---

## 班次定义

| 班次 | 说明 |
|---|---|
| `早` | 早班 |
| `晚` | 晚班；晚班次日不得接早班，自动顺延为晚班 |
| `休` | 轮休（计入休息额度） |
| `假` | 请假（固定，不参与随机分配） |

---

## 日期类型定义

| 类型 | 含义 |
|---|---|
| `工作日` | 普通工作日 |
| `假前一日` | 工作日且次日为周末或法定节假日（自动推导） |
| `周末` | 非调休上班的周六/周日 |
| `法定节假日` | 法定假日（`isLegal=true` 者计入法定加班额度） |
| `调休工作日` | 节假日期间的调休补班日 |

---

## localStorage 存储 Key 一览

| Key | 类型 | 内容 |
|---|---|---|
| `cs_members` | `MemberItem[]` | 成员列表 |
| `cs_saved_schedules` | `SavedSchedule[]` | 已保存草稿方案 |
| `cs_applied_schedules` | `Record<string, SavedSchedule>` | 各月已应用方案（key = `yyyy-MM`） |
| `cs_prefill_open` | `Record<string, boolean>` | 各月份预填开关手动状态（key = `yyyy-MM`） |
| `cs_day_min_staff_overrides` | `Record<string, number>` | 每日最低排班人数覆盖（key = `yyyy-MM-dd`） |

---

## 开发启动

```bash
npm install
npx prisma migrate dev   # 首次或 schema 变更后执行
npm run dev -- -p 3001
```

访问：http://localhost:3001

---

## 待完成 / 已知 TODO

- [ ] 飞书通知集成（`lib/feishu.ts` 已预留）
- [ ] 排班结果导出（PDF / Excel）
- [ ] 权限分级（管理员 vs 普通员工视图分离）
- [ ] 意愿数据数据库持久化（当前全部 in-memory / localStorage）
- [ ] 多用户支持（当前 `currentUser` 硬编码为 `"何咏琪"`）
