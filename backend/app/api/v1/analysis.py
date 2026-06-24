"""分析相关 API"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
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

    df = analysis_svc.to_series(prices)

    indicators = {
        "ma": analysis_svc.calc_ma(df),
        "macd": analysis_svc.calc_macd(df),
        "rsi": analysis_svc.calc_rsi(df),
        "bollinger": analysis_svc.calc_bollinger(df),
        "kdj": analysis_svc.calc_kdj(df),
    }
    patterns = analysis_svc.detect_patterns(df)
    trend = analysis_svc.trend_score(df)

    latest_price = float(prices[-1].close) if prices else 0
    prev_price = float(prices[-2].close) if len(prices) > 1 else 0
    change_pct = round((latest_price - prev_price) / prev_price * 100, 2) if prev_price else 0

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
        "volume": int(prices[-1].volume) if prices else 0,
        "indicators": indicators,
        "patterns": patterns,
        "trend_score": trend,
    }
