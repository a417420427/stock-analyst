# 项目启动指南

## 前置依赖

- Python 3.9+
- Node.js 18+
- PostgreSQL 14+ (可选，默认使用 SQLite 级内存模式)
- Redis (可选，Celery 任务队列需要)

## 🚀 快速启动

### 1. 后端

```bash
cd backend

# 复制配置
cp ../.env.example .env
# 编辑 .env 填入 API Key

# 启动 FastAPI 开发服务器
uvicorn app.main:app --reload --port 8000
```

API 文档: http://localhost:8000/docs

### 2. 前端

```bash
cd frontend

# 安装依赖（已装了可以跳过）
npm install

# 启动开发服务器
npm run dev
```

访问: http://localhost:5173

### 3. Celery 任务队列（可选，自动化策略需要）

```bash
cd backend

# 启动 Worker
celery -A app.workers.celery_app worker --loglevel=info

# 启动 Beat 调度器（定时任务）
celery -A app.workers.celery_app beat --loglevel=info
```

## 🔧 配置说明

### 数据源

| 数据源 | 市场 | 需要 API Key | 备注 |
|--------|------|-------------|------|
| AKShare | A股/港股 | 否 | 免费，akshare_enabled=true |
| Tushare | A股 | 是 | 需要 tushare_token |
| yfinance | 港股/美股 | 否 | 免费，自动使用 |
| Alpha Vantage | 美股 | 是 | 可选 |

### 推送通道

| 通道 | 配置项 | 说明 |
|------|--------|------|
| Telegram | TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID | BotFather 创建 bot |
| Email | SMTP_* | 支持任何 SMTP 服务 |
| 钉钉 | DINGTALK_WEBHOOK_URL | 群机器人 Webhook |

### AI 分析

- 配置 `OPENAI_API_KEY` 启用 AI 分析功能
- 不配置则使用规则引擎兜底

## 📁 项目结构

```
stock-analyst/
├── backend/           # FastAPI 后端 (Python)
│   ├── app/
│   │   ├── api/       # REST 路由
│   │   ├── core/      # 配置、数据库
│   │   ├── models/    # ORM 模型
│   │   ├── schemas/   # Pydantic 数据模型
│   │   ├── services/  # 业务逻辑
│   │   │   ├── market/   # 行情服务
│   │   │   ├── analysis/ # 技术分析
│   │   │   ├── strategy/ # 策略引擎
│   │   │   ├── push/     # 推送服务
│   │   │   └── ai/       # AI 分析
│   │   └── workers/   # Celery 任务
│   └── tests/
├── frontend/          # React 前端 (TypeScript)
│   └── src/
│       ├── components/  # 通用组件
│       ├── pages/       # 页面
│       └── services/    # API 调用
├── config/            # 配置文件模板
├── scripts/           # 部署脚本
└── docs/              # 文档
```
