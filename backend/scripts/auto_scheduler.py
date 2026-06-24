"""轻量自动化调度器 — 不依赖 Celery/Redis
替代 Celery Beat，直接跑一个后台循环做策略扫描和定时推送"""
import asyncio
import logging
import time
from datetime import datetime, time as dtime

import sys
sys.path.insert(0, "/Users/zlzk/Dev/personal/stock-analyst/backend")

from app.core.database import async_session_factory
from app.services.strategy import StrategyEngine
from app.services.push import PushRouter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("auto_scheduler")


async def run_scan():
    """执行策略扫描并推送"""
    async with async_session_factory() as db:
        engine = StrategyEngine(db)
        triggers = await engine.scan_all_active()
        logger.info(f"扫描完成: {len(triggers)} 个触发")

        for trigger in triggers:
            from app.models import Strategy, Stock

            strategy = await db.get(Strategy, trigger.strategy_id)
            stock = await db.get(Stock, trigger.stock_id)
            if not strategy or not stock:
                continue

            price = trigger.trigger_data.get("price", "N/A") if trigger.trigger_data else "N/A"
            change = trigger.trigger_data.get("change_pct", "") if trigger.trigger_data else ""

            body_lines = [
                f"策略: {strategy.name}",
                f"标的: {stock.name} ({stock.symbol}.{stock.market})",
            ]
            if price != "N/A":
                body_lines.append(f"价格: {price}")
            if change:
                body_lines.append(f"涨跌幅: {change}%")
            body_lines.append(f"触发时间: {trigger.triggered_at.strftime('%H:%M:%S')}")

            router = PushRouter(db)
            await router.push(
                user_id=1,
                title=f"⚡ 策略触发: {strategy.name}",
                body="\n".join(body_lines),
                level="normal",
                trigger_id=trigger.id,
            )
            await engine.execute_actions(trigger)

        await db.commit()
        db._session.commit()


async def run_pre_market():
    """盘前推送"""
    async with async_session_factory() as db:
        router = PushRouter(db)
        await router.push(
            user_id=1,
            title="☀️ 盘前前瞻",
            body=f"交易日 {datetime.now().strftime('%Y-%m-%d')}\n\n系统已就绪，准备开始今天的交易！",
            level="info",
        )
        await db.commit()


async def run_post_market():
    """收盘复盘推送"""
    async with async_session_factory() as db:
        router = PushRouter(db)
        await router.send_daily_digest(1)
        await db.commit()


async def main():
    logger.info("🚀 自动化调度器启动 (无需 Celery/Redis)")
    logger.info("  - 盘中扫描: 每 5 分钟")
    logger.info("  - 盘前提醒: 交易日 09:00")
    logger.info("  - 收盘复盘: 交易日 15:30")
    logger.info("")

    scan_interval = 300  # 5 分钟
    last_scan = 0
    last_pre_market_date = ""
    last_post_market_date = ""

    while True:
        now = datetime.now()
        today_str = now.strftime("%Y-%m-%d")
        weekday = now.weekday()  # 0=周一, 4=周五

        # 1. 盘中扫描（每 5 分钟）
        if time.time() - last_scan >= scan_interval:
            try:
                # 交易时段才扫描
                hour = now.hour + now.minute / 60
                is_trading_hours = (9.5 <= hour <= 11.5) or (13.0 <= hour <= 15.0)
                if is_trading_hours:
                    await run_scan()
                last_scan = time.time()
            except Exception as e:
                logger.error(f"扫描失败: {e}")

        # 2. 盘前提醒（交易日 09:00）
        if weekday < 5 and now.hour == 9 and now.minute == 0:
            day_key = f"pre_{today_str}"
            if last_pre_market_date != day_key:
                try:
                    await run_pre_market()
                    last_pre_market_date = day_key
                except Exception as e:
                    logger.error(f"盘前推送失败: {e}")

        # 3. 收盘复盘（交易日 15:30）
        if weekday < 5 and now.hour == 15 and now.minute == 30:
            day_key = f"post_{today_str}"
            if last_post_market_date != day_key:
                try:
                    await run_post_market()
                    last_post_market_date = day_key
                except Exception as e:
                    logger.error(f"收盘推送失败: {e}")

        await asyncio.sleep(30)  # 每 30 秒检查一次


if __name__ == "__main__":
    asyncio.run(main())
