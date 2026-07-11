"""FastAPI 应用主入口"""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse

from app.api import api_router
from app.core.config import settings
from app.core.database import engine, Base
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

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
