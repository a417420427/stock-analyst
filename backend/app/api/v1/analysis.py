"""分析相关 API"""
from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Stock, Price, TechnicalIndicator
from app.services.analysis import AnalysisService

router = APIRouter()
analysis_svc = AnalysisService()


@router.get("/stocks/{stock_id}/indicators")
async def get_indicators(stock_id: int, lookback: int = 50, db: AsyncSession = Depends(get_db)):
    """获取股票的技术指标"""
    stock = await db.get(Stock, stock_id)
    if not stock:
        return {"error": "股票不存在"}

    result = await db.execute(
        select(Price).where(Price.stock_id == stock_id).order_by(Price.date.desc()).limit(lookback)
    )
    prices = list(result.scalars().all())
    prices.reverse()

    if not prices:
        return {"stock": {"id": stock.id, "symbol": stock.symbol, "name": stock.name}, "error": "暂无价格数据"}

    df = analysis_svc.to_series(prices)

    return {
        "stock": {"id": stock.id, "symbol": stock.symbol, "name": stock.name},
        "ma": analysis_svc.calc_ma(df),
        "macd": analysis_svc.calc_macd(df),
        "rsi": {"rsi14": analysis_svc.calc_rsi(df)},
        "bollinger": analysis_svc.calc_bollinger(df),
        "kdj": analysis_svc.calc_kdj(df),
    }


@router.get("/stocks/{stock_id}/patterns")
async def get_patterns(stock_id: int, lookback: int = 50, db: AsyncSession = Depends(get_db)):
    """识别技术形态"""
    result = await db.execute(
        select(Price).where(Price.stock_id == stock_id).order_by(Price.date.desc()).limit(lookback)
    )
    prices = list(result.scalars().all())
    prices.reverse()

    if not prices:
        return {"patterns": [], "trend_score": {"short": 0, "medium": 0, "long": 0, "composite": 0}}

    df = analysis_svc.to_series(prices)
    patterns = analysis_svc.detect_patterns(df)
    trend = analysis_svc.trend_score(df)

    return {
        "patterns": patterns,
        "trend_score": trend,
    }


@router.get("/stocks/{stock_id}/comprehensive")
async def comprehensive_analysis(stock_id: int, db: AsyncSession = Depends(get_db)):
    """综合分析仪表盘数据"""
    stock = await db.get(Stock, stock_id)
    if not stock:
        return {"error": "股票不存在"}

    result = await db.execute(
        select(Price).where(Price.stock_id == stock_id).order_by(Price.date.desc()).limit(60)
    )
    prices = list(result.scalars().all())
    prices.reverse()

    has_prices = len(prices) > 0

    if has_prices:
        df = analysis_svc.to_series(prices)
        indicators = {
            "ma": analysis_svc.calc_ma(df),
            "macd": analysis_svc.calc_macd(df),
            "rsi": {"rsi14": analysis_svc.calc_rsi(df)},
            "bollinger": analysis_svc.calc_bollinger(df),
            "kdj": analysis_svc.calc_kdj(df),
        }
        patterns = analysis_svc.detect_patterns(df)
        trend = analysis_svc.trend_score(df)
        latest_price = float(prices[-1].close)
        prev_price = float(prices[-2].close) if len(prices) > 1 else 0
        change_pct = round((latest_price - prev_price) / prev_price * 100, 2) if prev_price else 0
        volume = int(prices[-1].volume)
    else:
        indicators = {}
        patterns = []
        trend = {"short": 0, "medium": 0, "long": 0, "composite": 0}
        latest_price = 0
        change_pct = 0
        volume = 0

    def to_num(v):
        return float(v) if v is not None else None

    return {
        "stock": {
            "id": stock.id, "symbol": stock.symbol, "name": stock.name, "market": stock.market,
            "pe_ttm": to_num(stock.pe_ttm),
            "pb": to_num(stock.pb),
            "market_cap": to_num(stock.market_cap),
            "dividend_yield": to_num(stock.dividend_yield),
            "revenue_growth": to_num(stock.revenue_growth),
            "profit_margin": to_num(stock.profit_margin),
        },
        "latest_price": latest_price,
        "change_pct": change_pct,
        "volume": volume,
        "indicators": indicators,
        "patterns": patterns,
        "trend_score": trend,
    }


@router.get("/sectors")
async def sector_analysis(db: AsyncSession = Depends(get_db)):
    """行业板块分析"""
    result = await db.execute(
        select(Stock.sector, func.count(Stock.id), func.avg(Stock.pe_ttm), func.avg(Stock.pb))
        .where(Stock.sector.isnot(None))
        .group_by(Stock.sector)
    )
    rows = result.all()

    sectors = []
    for row in rows:
        sector, count, avg_pe, avg_pb = row

        # 计算该行业股票的平均涨跌幅
        stocks_in_sector = await db.execute(
            select(Stock).where(Stock.sector == sector)
        )
        sector_stocks = list(stocks_in_sector.scalars().all())

        total_change = 0.0
        change_count = 0
        stock_list = []
        for s in sector_stocks[:20]:
            price_result = await db.execute(
                select(Price).where(Price.stock_id == s.id).order_by(Price.date.desc()).limit(2)
            )
            prices = list(price_result.scalars().all())
            change = 0.0
            if len(prices) >= 2:
                change = round((float(prices[0].close) - float(prices[1].close)) / float(prices[1].close) * 100, 2)
                total_change += change
                change_count += 1
            stock_list.append({
                "id": s.id,
                "symbol": s.symbol,
                "name": s.name,
                "market": s.market,
                "change": change,
            })

        sectors.append({
            "sector": sector,
            "count": count,
            "avg_pe": round(float(avg_pe), 2) if avg_pe else 0,
            "avg_pb": round(float(avg_pb), 2) if avg_pb else 0,
            "avg_change": round(total_change / change_count, 2) if change_count > 0 else 0,
            "stocks": stock_list,
        })

    sectors.sort(key=lambda x: x["count"], reverse=True)
    return sectors
