# Web 端功能一览 (Vue3 + Vite + Tailwind)

> 项目路径: `stock-analyst/frontend/`
> 框架: Vue3 + Vite + TailwindCSS + Axios + Zustand
> 部署: FastAPI 挂载静态文件，`/assets` 路由

---

## 一、功能总览

Web 端是一个以**股票分析与模拟交易**为核心的面板式应用。所有页面通过单页应用 (SPA) 提供，后端 FastAPI 挂载 `dist/` 目录。

---

## 二、页面结构

```
/login          — 登录页
/               — 大盘指数仪表盘（首页）
/stocks         — 股票列表
/stock/:id      — 个股详情（综合仪表盘）
/portfolio      — 模拟交易（多账户 + 持仓 + 交易）
/sectors        — 行业板块分析
/strategies     — 策略管理
/ai             — AI 分析
/push           — 推送设置
/logs           — 操作日志
/auth           — 认证
```

---

## 三、认证与用户

### JWT 令牌认证
- 登录后 Token 存 `localStorage`（key: `stock-analyst-auth`）
- 使用 Zustand `persist` 中间件持久化
- Token 中的 JWT payload 解码出 `user.id` 和 `user.username`

### Axios 请求拦截器
- 每次请求自动从 localStorage 读取 Token
- 放在 `Authorization: Bearer xxx` header

### 401 自动跳登录
- 响应拦截器捕获 401
- 清除 localStorage 中的 Token
- `window.location.href = '/auth'`

### 当前用户状态
- `useAuth` store 提供 `token` / `user` / `isLoggedIn()` / `logout()`

### ✅ 用户隔离
> 所有业务 API 均已按当前登录用户隔离数据，每个用户只能看到自己的数据。

---

## 四、功能模块

### 1. 大盘指数仪表盘 `/`
- 展示上证指数、深证成指、创业板指模拟走势
- 调用 `GET /market/indices`
- 最近 60 个交易日的趋势图

### 2. 股票搜索与列表 `/stocks`
- 按代码/名称模糊搜索
- 按市场筛选（A/HK/US）
- 分页展示（含最新价、涨跌幅、PE/PB）
- 调用 `GET /market/stocks/search` + `GET /market/stocks/all`

### 3. 个股详情页 `/stock/:id`
- **实时概览**: 最新价、涨跌幅、成交量
- **K 线图**: 可选天数（7/30/60/90 天）
- **技术指标面板**: MA5/MA20、MACD、RSI、布林带、KDJ
- **形态识别**: 双底、头肩顶等
- **趋势评分**: 短/中/长期 + 综合（-100 ~ +100）
- **基本面**: PE/PB/市值/股息率/营收增长/利润率
- **AI 分析**: AI 摘要 + AI 涨跌预测
- 调用: `realtime` / `prices` / `comprehensive` / `ai/summary` / `ai/predict`

### 4. 模拟交易 `/portfolio`
- **账户列表**: 多账户管理（名称、资金、持仓、盈亏）
- **账户详情**: 每只持仓股票的成本/现价/盈亏
- **交易流水**: 买入/卖出历史
- **创建交易**: 指定股票 + 方向 + 数量 + 价格
- **入金/提现**: 资金管理
- **AI 选股**: 输入需求 → AI 生成组合 → 一键创建账户并买入
- 调用: `GET/POST /portfolio/accounts`、`GET/POST /portfolio/accounts/{id}/trades`

### 5. 行业板块 `/sectors`
- 按行业分组统计（数量、平均 PE/PB、平均涨跌幅）
- 每组展示前 20 只成分股
- 调用 `GET /analysis/sectors`

### 6. 策略管理 `/strategies`
- **策略列表**: 显示当前用户创建的所有策略
- **创建策略**: 选择模板或自定义条件表达式
- **模板库**: 双均线金叉 / MACD 金叉 / RSI 超卖 / 放量突破 / 每日复盘
- **触发记录**: 查看策略触发的历史信号
- **测试触发**: 手动触发测试
- 调用: `GET/POST/PATCH/DELETE /strategies`

### 7. AI 分析 `/ai`
- **自然语言查询**: 输入问题，AI 回答
- **每日智能简报**: 生成当日市场总结
- **AI 设置**: 配置 AI 模型（Provider/Model/API Key/API Base）
- 调用: `POST /ai/query`、`POST /ai/digest`、`GET/POST /ai/settings`

### 8. 推送设置 `/push`
- 通道开关: Telegram / 邮件 / 钉钉 / 飞书
- 推送级别: 全部 / 普通 / 仅紧急
- 静默时段配置
- 简报订阅: 日/周
- 推送历史查询
- 测试推送
- 调用: `GET/PATCH /push/preferences`、`GET /push/history`、`POST /push/test`

### 9. 操作日志 `/logs`
- 查看当前用户的操作日志（AI 选股、交易等）
- 按 action 类型过滤
- 调用 `GET /logs`

### 10. 交易日历/状态
- 展示 A 股 / 港股 / 美股的当前交易状态
- 调用 `GET /market/trading-status`

---

## 五、技术栈

| 组件 | 技术 |
|------|------|
| 框架 | Vue3 + TypeScript |
| 构建 | Vite |
| 样式 | TailwindCSS + PostCSS |
| HTTP | Axios（baseURL: `/api/v1`） |
| 状态管理 | Zustand（认证状态持久化到 localStorage） |

---

## 六、API 封装

`src/services/api.ts` 中封装了所有后端 API 调用:
- 自动携带 JWT Token
- 401 响应自动清除 Token 并跳转登录
- 统一错误处理

---

## 七、认证数据流

```
用户登录 ──→ POST /auth/login ──→ 后端校验 ──→ 返回 JWT
         ↓
    localStorage 存储 Token
         ↓
    后续请求 → Axios 拦截器 → Authorization: Bearer xxx
         ↓
    401 响应 → 清除 Token → 跳转 /auth
```
