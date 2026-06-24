"""注入 Mock 数据供开发预览"""
import asyncio
import random
from datetime import datetime, timedelta
from decimal import Decimal

import sys
sys.path.insert(0, "/Users/zlzk/Dev/personal/stock-analyst/backend")

from app.core.database import async_session_factory
from app.models import Stock, Price, Watchlist, WatchlistItem


async def seed():
    async with async_session_factory() as db:
        # 股票
        stocks_data = [
            ("600519", "A", "贵州茅台", "消费", "白酒"),
            ("000858", "A", "五粮液", "消费", "白酒"),
            ("00700", "HK", "腾讯控股", "科技", "互联网"),
            ("09988", "HK", "阿里巴巴-SW", "科技", "电商"),
            ("AAPL",  "US", "Apple Inc.", "科技", "消费电子"),
            ("TSLA",  "US", "Tesla Inc.", "汽车", "新能源车"),
            ("MSFT",  "US", "Microsoft Corp", "科技", "软件"),
            ("03690", "HK", "美团-W", "科技", "本地生活"),
        ]

        stocks = {}
        for symbol, market, name, sector, industry in stocks_data:
            stock = Stock(
                symbol=symbol,
                market=market,
                name=name,
                sector=sector,
                industry=industry,
            )
            db.add(stock)
            await db.flush()
            stocks[symbol] = stock

        # K 线数据 — 每只股票 60 个交易日
        base_date = datetime.now() - timedelta(days=80)
        base_prices = {
            "600519": 1880.00,
            "000858": 145.00,
            "00700": 380.00,
            "09988": 82.00,
            "AAPL":  198.00,
            "TSLA":  248.00,
            "MSFT":  425.00,
            "03690": 118.00,
        }

        for symbol, stock in stocks.items():
            price = base_prices[symbol]
            for i in range(60):
                d = base_date + timedelta(days=i)
                # 跳过周末
                if d.weekday() >= 5:
                    continue

                change = random.uniform(-0.03, 0.035)
                price = price * (1 + change)
                volume = random.randint(500_000, 5_000_000)
                high = price * (1 + random.uniform(0, 0.02))
                low = price * (1 - random.uniform(0, 0.02))

                p = Price(
                    stock_id=stock.id,
                    date=d,
                    open=Decimal(str(round(price * (1 - random.uniform(-0.01, 0.01)), 2))),
                    high=Decimal(str(round(high, 2))),
                    low=Decimal(str(round(low, 2))),
                    close=Decimal(str(round(price, 2))),
                    volume=volume,
                    amount=Decimal(str(round(volume * price, 2))),
                )
                db.add(p)

        # 自选股
        wl = Watchlist(name="默认自选")
        db.add(wl)
        await db.flush()
        for symbol in ["600519", "00700", "AAPL", "TSLA"]:
            item = WatchlistItem(watchlist_id=wl.id, stock_id=stocks[symbol].id)
            db.add(item)

        await db.commit()
        print(f"✅ 已注入 {len(stocks_data)} 只股票 + K线数据 + 自选股")


if __name__ == "__main__":
    asyncio.run(seed())
