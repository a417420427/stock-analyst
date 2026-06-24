"""FastAPI 应用主入口"""
import logging
from contextlib import asynccontextmanager

import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse

from app.api import api_router
from app.core.config import settings
from app.core.database import engine, async_session_factory, Base
from sqlalchemy import create_engine

logging.basicConfig(
    level=logging.INFO if settings.debug else logging.WARNING,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期"""
    logger.info(f"🚀 {settings.app_name} starting up...")
    # 同步方式建表（避免 greenlet 依赖）
    sync_engine = create_engine(settings.database_url_sync)
    Base.metadata.create_all(sync_engine)
    sync_engine.dispose()
    logger.info("✅ Database tables ready")
    yield
    await engine.dispose()
    logger.info("👋 Shutdown complete")


app = FastAPI(
    title=settings.app_name,
    description="多市场股票智能分析系统",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — 允许前端开发服务器
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url.path}")
    logger.error(traceback.format_exc())
    return JSONResponse(status_code=500, content={"detail": str(exc)})


@app.get("/")
async def root():
    return {
        "app": settings.app_name,
        "version": "0.1.0",
        "status": "running",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}
