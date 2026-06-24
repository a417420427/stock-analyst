"""Celery 应用配置"""
from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "stock_analyst",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        # 盘中扫描：每 5 分钟
        "scan-intraday-every-5min": {
            "task": "app.workers.scanner.scan_all_strategies",
            "schedule": 300,  # 5 分钟
            "args": (),
        },
        # 盘前检查：每个交易日上午 9:00
        "pre-market-check": {
            "task": "app.workers.scanner.run_pre_market_check",
            "schedule": {"schedule": "0 9 * * 1-5", "timezone": "Asia/Shanghai"},
            "args": (),
        },
        # 收盘复盘：每个交易日下午 15:30
        "post-market-digest": {
            "task": "app.workers.scanner.send_daily_digest",
            "schedule": {"schedule": "30 15 * * 1-5", "timezone": "Asia/Shanghai"},
            "args": (),
        },
        # 数据采集：每天凌晨 2:00 拉取行情
        "fetch-market-data-daily": {
            "task": "app.workers.data_collector.collect_all_market_data",
            "schedule": {"schedule": "0 2 * * 1-5", "timezone": "Asia/Shanghai"},
            "args": (),
        },
    },
)

# 自动发现任务模块
celery_app.autodiscover_tasks(["app.workers"])
