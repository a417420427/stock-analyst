"""Workers 模块"""
from app.workers.celery_app import celery_app

# 导入确保任务被注册
import app.workers.scanner  # noqa
import app.workers.data_collector  # noqa

__all__ = ["celery_app"]
