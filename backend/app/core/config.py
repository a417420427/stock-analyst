"""应用核心配置"""
from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # 应用
    app_name: str = "StockAnalyst"
    debug: bool = True

    # 数据库 — 开发环境默认 SQLite，生产换 PostgreSQL
    database_url: str = f"sqlite+aiosqlite:///{Path(__file__).resolve().parent.parent.parent / 'stock_analyst.db'}"
    database_url_sync: str = f"sqlite:///{Path(__file__).resolve().parent.parent.parent / 'stock_analyst.db'}"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Celery
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # 数据源
    tushare_token: str = ""
    akshare_enabled: bool = True
    alpha_vantage_key: str = ""

    # 推送
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""
    mail_from: str = ""
    dingtalk_webhook_url: str = ""
    feishu_webhook_url: str = ""

    # AI
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    # JWT
    secret_key: str = "change-me-to-a-random-string"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    # 行情
    market_a_hours: str = "9:30-11:30/13:00-15:00"
    market_hk_hours: str = "9:30-12:00/13:00-16:00"
    market_us_hours: str = "9:30-16:00"

    # 扫描
    scan_interval_default: int = 300
    scan_interval_fast: int = 60

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()

# 路径
BASE_DIR = Path(__file__).resolve().parent.parent.parent
