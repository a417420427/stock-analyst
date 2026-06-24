"""行情服务 — 多数据源采集与缓存"""
import asyncio
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Stock, Price


class MarketService:
    """统一行情服务，支持多市场、多数据源"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._http = httpx.AsyncClient(timeout=10.0)

    async def close(self):
        await self._http.aclose()

    # ─── 股票主数据 ─────────────────────────────

    async def get_or_create_stock(self, symbol: str, market: str, name: str = "") -> Stock:
        """获取股票，不存在则创建"""
        result = await self.db.execute(
            select(Stock).where(Stock.symbol == symbol, Stock.market == market)
        )
        stock = result.scalar_one_or_none()
        if stock:
            return stock
        stock = Stock(symbol=symbol, market=market, name=name or symbol)
        self.db.add(stock)
        await self.db.flush()
        return stock

    async def search_stocks(self, query: str, market: Optional[str] = None, limit: int = 20) -> list[Stock]:
        """搜索股票（按代码/名称）"""
        stmt = select(Stock).where(
            (Stock.symbol.ilike(f"%{query}%")) | (Stock.name.ilike(f"%{query}%"))
        )
        if market:
            stmt = stmt.where(Stock.market == market)
        stmt = stmt.limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # ─── K 线数据 ───────────────────────────────

    async def get_prices(
        self, stock_id: int,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
        limit: int = 200
    ) -> list[Price]:
        """获取日K线"""
        stmt = select(Price).where(Price.stock_id == stock_id)
        if start:
            stmt = stmt.where(Price.date >= start)
        if end:
            stmt = stmt.where(Price.date <= end)
        stmt = stmt.order_by(Price.date.desc()).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def fetch_a_shares(self) -> int:
        """从 AKShare 拉取 A 股日行情 (示例)"""
        # 实际实现会调用 akshare.stock_zh_a_hist()
        # 这里返回 mock 计数
        return await self._mock_fetch("A")

    async def fetch_hk_shares(self) -> int:
        """从 AKShare/Yahoo 拉取港股行情"""
        return await self._mock_fetch("HK")

    async def fetch_us_shares(self) -> int:
        """从 Yahoo Finance 拉取美股行情"""
        import yfinance as yf
        # 示例：获取 AAPL 最近数据
        ticker = yf.Ticker("AAPL")
        hist = ticker.history(period="5d")
        count = 0
        for date, row in hist.iterrows():
            stock = await self.get_or_create_stock("AAPL", "US", "Apple Inc.")
            price = Price(
                stock_id=stock.id,
                date=date.to_pydatetime(),
                open=Decimal(str(row["Open"])),
                high=Decimal(str(row["High"])),
                low=Decimal(str(row["Low"])),
                close=Decimal(str(row["Close"])),
                volume=int(row["Volume"]),
            )
            self.db.add(price)
            count += 1
        await self.db.flush()
        return count

    # ─── 真实 K 线数据 ────────────────────────────

    async def fetch_real_prices(self, stock: Stock, days: int = 60) -> list[Price]:
        """从 yfinance 拉取真实 K 线数据"""
        import yfinance as yf

        # 构建 yfinance 代码
        if stock.market == "A":
            ticker_symbol = f"{stock.symbol}.SS" if stock.symbol.startswith("6") else f"{stock.symbol}.SZ"
        elif stock.market == "HK":
            ticker_symbol = f"{stock.symbol}.HK"
        else:
            ticker_symbol = stock.symbol

        period = f"{days}d"
        try:
            ticker = yf.Ticker(ticker_symbol)
            hist = ticker.history(period=period)
        except Exception:
            ticker = yf.Ticker(stock.symbol)
            hist = ticker.history(period=period)

        prices = []
        if hist.empty:
            return prices

        # 删掉旧数据
        old = await self.db.execute(
            select(Price).where(Price.stock_id == stock.id)
        )
        for p in old.scalars().all():
            await self.db.delete(p)

        for date, row in hist.iterrows():
            price = Price(
                stock_id=stock.id,
                date=date.to_pydatetime(),
                open=Decimal(str(round(row["Open"], 4))),
                high=Decimal(str(round(row["High"], 4))),
                low=Decimal(str(round(row["Low"], 4))),
                close=Decimal(str(round(row["Close"], 4))),
                volume=int(row["Volume"]),
                amount=Decimal(str(round(row["Close"] * row["Volume"], 2))),
            )
            self.db.add(price)
            prices.append(price)

        await self.db.flush()
        return prices

    # ─── 基本面数据 ────────────────────────────────

    async def fetch_fundamentals(self, stock: Stock) -> dict:
        """从 yfinance 拉取基本面数据并保存"""
        import yfinance as yf

        if stock.market == "A":
            return {"error": "A 股基本面暂不支持"}

        ticker_symbol = f"{stock.symbol}.HK" if stock.market == "HK" else stock.symbol
        try:
            ticker = yf.Ticker(ticker_symbol)
            info = ticker.info or {}
        except Exception:
            try:
                ticker = yf.Ticker(stock.symbol)
                info = ticker.info or {}
            except Exception:
                return {"error": "获取失败"}

        # 更新 Stock 表
        stock.pe_ttm = Decimal(str(info.get("trailingPE", 0) or 0))
        stock.pb = Decimal(str(info.get("priceToBook", 0) or 0))
        stock.market_cap = Decimal(str(info.get("marketCap", 0) or 0))
        stock.dividend_yield = Decimal(str(info.get("dividendYield", 0) or 0))
        stock.revenue_growth = Decimal(str(info.get("revenueGrowth", 0) or 0))
        stock.profit_margin = Decimal(str(info.get("profitMargins", 0) or 0))

        # 保存季度财务数据
        try:
            financials = ticker.quarterly_financials
            if financials is not None and not financials.empty:
                from app.models import Financial
                for col in financials.columns[:8]:  # 最近 8 个季度
                    quarter = str(col)[:7].replace("-", "")
                    exists = await self.db.execute(
                        select(Financial).where(
                            Financial.stock_id == stock.id,
                            Financial.quarter == quarter
                        )
                    )
                    if exists.scalar_one_or_none():
                        continue
                    rev = financials.loc["Total Revenue"] if "Total Revenue" in financials.index else None
                    profit = financials.loc["Net Income"] if "Net Income" in financials.index else None
                    f = Financial(
                        stock_id=stock.id,
                        quarter=quarter,
                        revenue=Decimal(str(rev[col])) if rev is not None and col in rev else None,
                        net_profit=Decimal(str(profit[col])) if profit is not None and col in profit else None,
                    )
                    self.db.add(f)
        except Exception as e:
            pass  # 季度数据可选

        await self.db.flush()
        return {
            "pe_ttm": float(stock.pe_ttm) if stock.pe_ttm else None,
            "pb": float(stock.pb) if stock.pb else None,
            "market_cap": float(stock.market_cap) if stock.market_cap else None,
            "dividend_yield": float(stock.dividend_yield) if stock.dividend_yield else None,
            "revenue_growth": float(stock.revenue_growth) if stock.revenue_growth else None,
            "profit_margin": float(stock.profit_margin) if stock.profit_margin else None,
        }

    # ─── Mock ────────────────────────────────────

    async def _mock_fetch(self, market: str) -> int:
        stocks = {
            "A": [("600519", "贵州茅台"), ("000858", "五粮液")],
            "HK": [("00700", "腾讯控股"), ("09988", "阿里巴巴-SW")],
        }
        count = 0
        base_date = datetime.now() - timedelta(days=10)
        for symbol, name in stocks.get(market, []):
            stock = await self.get_or_create_stock(symbol, market, name)
            for i in range(10):
                d = base_date + timedelta(days=i)
                price = Price(
                    stock_id=stock.id,
                    date=d,
                    open=Decimal("100.00"),
                    high=Decimal("105.00"),
                    low=Decimal("98.00"),
                    close=Decimal("102.50"),
                    volume=1_000_000 + i * 100_000,
                    amount=Decimal("100000000"),
                )
                self.db.add(price)
                count += 1
        await self.db.flush()
        return count
