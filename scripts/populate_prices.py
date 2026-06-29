#!/usr/bin/env python3
"""填充价格数据到数据库 — 直接操作 DB + yfinance"""
import sys
sys.path.insert(0, '/root/workspace/stock-analyst/backend')

import asyncio
from datetime import datetime, timedelta
from decimal import Decimal

import yfinance as yf
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

DATABASE_URL = "sqlite+aiosqlite:///stock_analyst.db"
engine = create_async_engine(DATABASE_URL, echo=False)


def get_ticker(stock):
    """构建 yfinance 代码"""
    if stock.market == "A":
        return f"{stock.symbol}.SS" if stock.symbol.startswith("6") else f"{stock.symbol}.SZ"
    elif stock.market == "HK":
        return f"{stock.symbol}.HK"
    return stock.symbol


async def fetch_for_stock(session, stock_row, days=60):
    stock_id, symbol, market, name = stock_row
    ticker_symbol = get_ticker(type('S', (), {'market': market, 'symbol': symbol})())

    try:
        ticker = yf.Ticker(ticker_symbol)
        hist = ticker.history(period=f"{days}d")
    except Exception:
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period=f"{days}d")
        except Exception as e:
            print(f"  [{symbol}] 失败: {e}")
            return 0

    if hist.empty:
        print(f"  [{symbol}] 无数据")
        return 0

    # 删除旧数据
    await session.execute(text(f"DELETE FROM prices WHERE stock_id={stock_id}"))

    count = 0
    for date, row in hist.iterrows():
        await session.execute(text(f"""
            INSERT OR IGNORE INTO prices (stock_id, date, open, high, low, close, volume, amount)
            VALUES ({stock_id}, '{date}', {round(row['Open'],4)}, {round(row['High'],4)},
                    {round(row['Low'],4)}, {round(row['Close'],4)}, {int(row['Volume'])},
                    {round(row['Close']*row['Volume'],2)})
        """))
        count += 1

    print(f"  [{symbol}] {name}: {count} 条")
    return count


async def main():
    stock_ids = [int(a) for a in sys.argv[1:]] if len(sys.argv) > 1 else None

    async with AsyncSession(engine) as session:
        if stock_ids:
            result = await session.execute(
                text(f"SELECT id, symbol, market, name FROM stocks WHERE id IN ({','.join(map(str,stock_ids))})")
            )
        else:
            result = await session.execute(text("SELECT id, symbol, market, name FROM stocks LIMIT 20"))
        stocks = result.fetchall()

        total = 0
        for row in stocks:
            total += await fetch_for_stock(session, row)
            await session.commit()

        print(f"\n总计: {total} 条价格数据")


if __name__ == "__main__":
    asyncio.run(main())
