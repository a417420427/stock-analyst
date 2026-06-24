"""策略扫描与推送 Celery 任务"""
import asyncio
import logging

from celery import shared_task

from app.core.database import async_session_factory
from app.services.strategy import StrategyEngine
from app.services.push import PushRouter

logger = logging.getLogger(__name__)


def run_async(coro):
    """在 Celery worker 中运行 async 函数"""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@shared_task(name="app.workers.scanner.scan_all_strategies")
def scan_all_strategies():
    """扫描所有活跃策略（盘中每 5 分钟执行）"""
    async def _run():
        async with async_session_factory() as db:
            engine = StrategyEngine(db)
            triggers = await engine.scan_all_active()
            logger.info(f"Strategy scan complete: {len(triggers)} triggers found")

            # 触发后推送到用户
            for trigger in triggers:
                # 获取策略信息
                from app.models import Strategy, Stock
                strategy = await db.get(Strategy, trigger.strategy_id)
                stock = await db.get(Stock, trigger.stock_id)
                if not strategy or not stock:
                    continue

                price = trigger.trigger_data.get("price", "N/A") if trigger.trigger_data else "N/A"

                router = PushRouter(db)
                await router.push(
                    user_id=strategy.user_id,
                    title=f"策略触发: {strategy.name}",
                    body=(
                        f"标的: {stock.name} ({stock.symbol}.{stock.market})\n"
                        f"当前价格: {price}\n"
                        f"触发时间: {trigger.triggered_at.strftime('%H:%M:%S')}\n"
                    ),
                    level="normal",
                    trigger_id=trigger.id,
                )
                await engine.execute_actions(trigger)

            await db.commit()
            return len(triggers)

    return run_async(_run())


@shared_task(name="app.workers.scanner.run_pre_market_check")
def run_pre_market_check():
    """盘前检查"""
    async def _run():
        async with async_session_factory() as db:
            from app.models import PushPreference, User
            result = await db.execute(
                "SELECT DISTINCT user_id FROM push_preferences WHERE daily_digest = true"
            )
            user_ids = [r[0] for r in result.fetchall()]

            router = PushRouter(db)
            for uid in user_ids:
                await router.push(
                    uid,
                    "☀️ 盘前前瞻",
                    f"交易日 {__import__('datetime').datetime.now().strftime('%Y-%m-%d')}\n\n准备开始今天的交易！",
                    level="info",
                )
            await db.commit()
            return len(user_ids)

    return run_async(_run())


@shared_task(name="app.workers.scanner.send_daily_digest")
def send_daily_digest():
    """收盘后发送每日复盘"""
    async def _run():
        async with async_session_factory() as db:
            from app.models import PushPreference
            result = await db.execute(
                "SELECT DISTINCT user_id FROM push_preferences WHERE daily_digest = true"
            )
            user_ids = [r[0] for r in result.fetchall()]

            router = PushRouter(db)
            for uid in user_ids:
                await router.send_daily_digest(uid)
            return len(user_ids)

    return run_async(_run())
