# 📊 多市场股票智能分析系统

覆盖 **A 股 / 港股 / 美股** 的智能股票分析平台，集成 AI 选股、模拟交易、大盘监控等功能。

## 技术栈

| 端 | 技术 |
|----|------|
| **后端** | Python FastAPI + SQLAlchemy + SQLite |
| **前端** | React 18 + TypeScript + Ant Design 5 + ECharts |
| **AI** | OpenAI / DeepSeek API (可配置) |
| **数据源** | yfinance + akshare |
| **部署** | 阿里云 ECS (Alibaba Cloud Linux 3) |

## 功能总览

### 📊 大盘行情（首页）
- 实时拉取 **7 大指数**：上证指数、深证成指、创业板指、恒生指数、标普500、纳斯达克、道琼斯
- 每指数带**迷你走势图**
- 市场概览（A股/港股/美股数量统计）
- 模拟持仓快照（总资产、总盈亏、各组合概览）
- 快捷入口（行业板块、全部股票、模拟交易）

### 📈 全部股票
- **分页加载**（30 条/页，可调）
- **搜索**（股票名称/代码）
- **筛选**（A股/港股/美股）
- **排序**（价格、涨跌幅、PE、PB）
- 快速**AI 预测**入口
- 点击名称弹出详情弹窗（K 线 + 技术指标 + 基本面）

### 🔬 个股分析
- **K 线图**（含 MA5/MA20 均线 + 成交量柱）
- **时间周期切换**：1 月 / 3 月 / 6 月 / 1 年
- **副图切换**：MACD / RSI 可独立显隐
- **基本面展示**：PE、PB、市值、股息率、营收增长、利润率
- **趋势评分** + 形态识别
- **AI 智能分析**（摘要 + 趋势判断 + 支撑/阻力位）
- **AI 对话**（自然语言问答）

### 💼 模拟交易（多账户）
- **多账户管理** — 每个策略/组合独立账户（如白马组合、成长组合、AI选股账户）
- **真实费用模拟**：
  - A 股：万 1.5 手续费 + 卖出万 5 印花税
  - 港股：万 2.5 手续费
  - 美股：万 1 手续费
- **滑点**：默认 0.1%（可配置）
- **买入/卖出**（市价/限价单）
- **自动计算**：执行价、手续费、总成本
- **资金管理**：入金、提现、可用余额
- **账户重置**：一键清空交易记录
- **持仓明细**：持仓数量、均价、成本、市值、盈亏、收益率
- **交易流水**：每笔交易明细（含手续费）

### 🤖 AI 选股
- **自然语言选股**：输入如"选5只低PE高分红白马股，等权重配置"
- **全市场分析**：LLM 分析全部 249 只股票的 PE/PB/市值数据
- **结果预览**：选股清单 + 预估买入金额 + 资金汇总
- **一键创建**：AI 选股结果 → 自动创建模拟账户 → 按权重自动买入
- **历史追溯**：每个 AI 创建的组合有紫色标签，详情页可查看当时的输入描述

### 🤖 AI 个股预测
- **涨跌方向**：看涨 / 看跌 / 震荡
- **预估涨跌幅**：具体百分比
- **时间范围**：1 个月 / 3 个月 / 6 个月
- **置信度**：高 / 中 / 低
- **支撑位 / 阻力位**
- **看涨理由** + **风险提示**
- **技术面分析** + **基本面分析**（可折叠展开）
- **一句话总结**

### 🔄 定时 AI 选股
- **配置面板**：每个组合独立配置定时选股
- **参数**：选股描述、Top N 数量、投入资金、是否自动买入
- **自动运行**：每个交易日 16:30 执行（crontab）
- **保存持久化**：localStorage 存每个组合的配置

### 🏢 行业板块
- **行业涨跌统计**：总数、上涨/下跌、总标的数、最强行业
- **涨幅前 3** + **跌幅前 3**
- **行业明细**：PE、PB、涨跌幅（可扩展查看子股票）

### 📋 操作日志
- 记录 **AI 选股** 和 **交易** 操作
- AI 选股日志：组合名称、选入股票、金额
- 交易日志：买入/卖出、数量、价格、手续费
- 按类型筛选

### 🔐 账号体系
- 注册 / 登录
- JWT token 认证
- 路由守卫（未登录自动跳转）
- 用户信息 + 退出登录

### 📅 数据同步（定时）
- **每日 16:30**（工作日）自动执行 crontab
- 增量拉取最近 5 个交易日价格
- 补缺基本面数据（PE/PB）
- **定时 AI 选股**按各组合配置执行

## 页面导航

| 路径 | 页面 |
|------|------|
| `/` | 大盘行情 |
| `/stocks` | 全部股票 |
| `/analysis/:stockId` | 个股分析 |
| `/portfolio` | 模拟交易（多账户） |
| `/sectors` | 行业板块 |
| `/ai` | AI 设置 |
| `/logs` | 操作日志 |
| `/auth` | 登录/注册 |

## 快速启动

### 本地开发

```bash
# 后端
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 前端
cd frontend
npm install
npm run dev
```

前端默认通过 vite proxy 将 `/api` 请求转发到 `http://39.106.172.134:8000`。

### 服务端部署

```bash
# 后端（已在服务器运行）
cd ~/workspace/stock-analyst/backend
nohup python3.11 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 &

# 前端构建
cd ~/workspace/stock-analyst/frontend
npm run build

# 定时任务（工作日 16:30）
crontab -l  # 查看
30 16 * * 1-5 /root/workspace/stock-analyst/scripts/run_daily_update.sh
```

### 默认账号
- 用户名：`admin`
- 密码：`admin123`
- 注册新用户后首次进入需配置 AI API Key

## 项目结构

```
stock-analyst/
├── backend/
│   └── app/
│       ├── api/v1/        # REST 接口 (market/analysis/portfolio/ai/auth/logs)
│       ├── core/           # 配置/数据库/中间件
│       ├── models/         # SQLAlchemy ORM 模型
│       ├── schemas/        # Pydantic 数据模型
│       ├── services/       # 业务逻辑 (market/analysis/strategy/push/ai)
│       └── main.py         # FastAPI 入口
├── frontend/
│   └── src/
│       ├── components/     # 公共组件 (AppLayout, StockDetailModal)
│       ├── hooks/          # 自定义 hooks (useAuth)
│       ├── pages/          # 页面组件
│       ├── services/       # API 客户端 (axios)
│       └── App.tsx         # 前端入口
├── scripts/                # 数据同步/运维脚本
│   ├── populate_prices_sync.py
│   ├── sync_prices_daily.py
│   ├── sync_fundamentals.py
│   └── run_daily_update.sh
└── README.md
```

## 数据库表

| 表 | 说明 |
|----|------|
| `users` | 用户 |
| `stocks` | 股票（249 只 A/港股/美股） |
| `prices` | 日 K 线价格数据 |
| `financials` | 季度财务数据 |
| `simulated_accounts` | 模拟账户（多账户+策略组合） |
| `simulated_trades` | 模拟交易记录 |
| `strategies` | 策略引擎（暂隐藏） |
| `strategy_triggers` | 策略触发记录 |
| `activity_logs` | 操作日志 |
| `ai_settings` | AI 模型配置 |
| `watchlists/watchlist_items` | 自选股（已去掉导航，表保留） |

## 开发说明

### AI 功能配置
- AI 选股和预测需要 API Key
- 前往 **AI 设置** 页面配置（支持 OpenAI / DeepSeek）
- 未配置时接口会返回友好错误提示

### 本地 vs 服务端
- 本地开发用 `npm run dev` 启动前端，API 代理到服务器
- 服务端后端在阿里云 ECS 运行，数据源（yfinance/akshare）从服务器获取
- 修改后端代码后需 `rsync` 同步到服务器并重启

## 迭代路线

见 [docs/ROADMAP.md](docs/ROADMAP.md)（如未创建则暂无）
