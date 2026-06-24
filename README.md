# 📊 多市场股票智能分析系统

覆盖 A 股 / 港股 / 美股的智能股票分析平台，支持自动化策略引擎与多通道推送。

## 技术栈

**后端**：Python FastAPI + Celery + PostgreSQL/TimescaleDB + Redis  
**前端**：React + TypeScript + ECharts + Tailwind  
**AI**：LangChain + OpenAI / 本地模型  
**推送**：Telegram Bot / Email / WebSocket / 钉钉

## 项目结构

```
stock-analyst/
├── backend/           # FastAPI 后端
│   ├── app/
│   │   ├── api/       # REST 路由
│   │   ├── core/      # 配置、依赖、中间件
│   │   ├── models/    # SQLAlchemy 模型
│   │   ├── schemas/   # Pydantic 数据模型
│   │   ├── services/  # 业务逻辑
│   │   │   ├── market/   # 行情服务
│   │   │   ├── analysis/ # 分析服务
│   │   │   ├── strategy/ # 策略引擎
│   │   │   ├── push/     # 推送服务
│   │   │   └── ai/       # AI 分析
│   │   ├── workers/   # Celery 任务
│   │   └── tasks/     # 定时任务定义
│   └── tests/
├── frontend/          # React 前端
│   └── src/
│       ├── components/
│       ├── hooks/
│       ├── services/
│       ├── stores/
│       └── pages/
├── config/           # 配置文件模板
├── scripts/          # 部署/运维脚本
└── docs/             # 文档
```

## 快速启动

```bash
# 后端
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# 前端
cd frontend
npm install
npm run dev
```

## 迭代路线

见 [docs/ROADMAP.md](docs/ROADMAP.md)
