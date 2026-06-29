"""API 路由汇总"""
from fastapi import APIRouter

from app.api.v1 import market, analysis, strategy, push, ai, ai_settings, auth, portfolio, logs

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router, prefix="/auth", tags=["认证"])
api_router.include_router(market.router, prefix="/market", tags=["行情"])
api_router.include_router(analysis.router, prefix="/analysis", tags=["分析"])
api_router.include_router(strategy.router, prefix="/strategies", tags=["策略"])
api_router.include_router(push.router, prefix="/push", tags=["推送"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI"])
api_router.include_router(ai_settings.router, prefix="/ai", tags=["AI 设置"])
api_router.include_router(portfolio.router, prefix="/portfolio", tags=["模拟仓位"])
api_router.include_router(logs.router, prefix="/logs", tags=["日志"])
