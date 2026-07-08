"""AI 分析相关 API"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models import Stock, Price, User, AIUsage
from app.services.ai import AIService
from app.api.v1.auth import get_current_user

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
async def ai_predict_stock(
    stock_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.utils.ai_quota import check_and_increment
    await check_and_increment(user.id, "prediction", db)
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


@router.get("/quota")
async def get_ai_quota(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取当前用户的 AI 配额使用情况"""
    from datetime import datetime
    today = datetime.utcnow().strftime("%Y-%m-%d")

    result = await db.execute(
        select(AIUsage).where(
            AIUsage.user_id == user.id,
            AIUsage.date == today,
        )
    )
    usage_rows = list(result.scalars().all())

    usage_map = {r.action: r.count for r in usage_rows}

    quotas = []
    for action, limit in settings.ai_quota.items():
        used = usage_map.get(action, 0)
        quotas.append({
            "action": action,
            "label": {
                "ai_pick": "AI 选股",
                "summary": "AI 分析",
                "prediction": "AI 预测",
                "plan": "AI 策略",
            }.get(action, action),
            "used": used,
            "limit": limit,
            "remaining": max(0, limit - used),
        })

    return {"date": today, "quotas": quotas}
