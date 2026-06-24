"""数据采集 Celery 任务"""
import logging

from celery import shared_task

from app.core.database import async_session_factory
from app.services.market import MarketService

logger = logging.getLogger(__name__)


def run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()

import asyncio


@shared_task(name="app.workers.data_collector.collect_all_market_data")
def collect_all_market_data():
    """全市场数据采集"""
    async def _run():
        async with async_session_factory() as db:
            svc = MarketService(db)
            try:
                a_count = await svc.fetch_a_shares()
                hk_count = await svc.fetch_hk_shares()
                us_count = await svc.fetch_us_shares()
                await db.commit()
                logger.info(
                    f"Market data collected: A={a_count} HK={hk_count} US={us_count}"
                )
                return {"A": a_count, "HK": hk_count, "US": us_count}
            finally:
                await svc.close()

    return run_async(_run())


@shared_task(name="app.workers.data_collector.collect_single_stock")
def collect_single_stock(symbol: str, market: str):
    """采集单只股票数据"""
    async def _run():
        async with async_session_factory() as db:
            svc = MarketService(db)
            try:
                stock = await svc.get_or_create_stock(symbol, market)
                await db.commit()
                return {"symbol": symbol, "market": market, "stock_id": stock.id}
            finally:
                await svc.close()

    return run_async(_run())
