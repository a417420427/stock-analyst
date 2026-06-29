"""AI 分析相关 API"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Stock, Price
from app.services.ai import AIService

router = APIRouter()
ai_svc = AIService()


@router.get("/summary/{stock_id}")
async def ai_stock_summary(stock_id: int, db: AsyncSession = Depends(get_db)):
    """AI 个股分析摘要"""
    stock = await db.get(Stock, stock_id)
    if not stock:
        return {"error": "股票不存在"}

    result = await db.execute(
        select(Price).where(Price.stock_id == stock_id).order_by(Price.date.desc()).limit(60)
    )
    prices = list(result.scalars().all())
    prices.reverse()

    summary = await ai_svc.stock_summary(stock, prices, db_session=db)
    return {
        "stock": {"id": stock.id, "symbol": stock.symbol, "name": stock.name},
        "analysis": summary,
    }


@router.post("/query")
async def nl_query(
    query: str = Query(..., description="自然语言查询"),
    db: AsyncSession = Depends(get_db),
):
    """自然语言查询"""
    result = await db.execute(select(Stock).limit(10))
    stocks = list(result.scalars().all())

    answer = await ai_svc.nl_query(query, stocks, db_session=db)
    return {"query": query, "answer": answer}


@router.post("/digest")
async def generate_digest(db: AsyncSession = Depends(get_db)):
    """生成每日智能简报"""
    result = await db.execute(select(Stock).limit(10))
    stocks = list(result.scalars().all())

    stocks_data = []
    for stock in stocks:
        price_result = await db.execute(
            select(Price).where(Price.stock_id == stock.id).order_by(Price.date.desc()).limit(2)
        )
        prices = list(price_result.scalars().all())
        change = 0
        if len(prices) >= 2:
            change = round((float(prices[0].close) - float(prices[1].close)) / float(prices[1].close) * 100, 2)
        stocks_data.append({
            "name": stock.name,
            "symbol": stock.symbol,
            "change": change,
        })

    digest = await ai_svc.generate_digest(stocks_data)
    return {"digest": digest}


@router.post("/predict/{stock_id}")
async def ai_predict_stock(stock_id: int, db: AsyncSession = Depends(get_db)):
    """AI 个股涨跌预测"""
    stock = await db.get(Stock, stock_id)
    if not stock:
        return {"error": "股票不存在"}

    result = await db.execute(
        select(Price).where(Price.stock_id == stock_id).order_by(Price.date.desc()).limit(90)
    )
    prices = list(result.scalars().all())
    prices.reverse()

    if not prices:
        return {"error": "暂无价格数据"}

    prediction = await ai_svc.ai_predict_stock(stock, prices, db_session=db)
    return {
        "stock": {"id": stock.id, "symbol": stock.symbol, "name": stock.name, "market": stock.market},
        "prediction": prediction,
    }
