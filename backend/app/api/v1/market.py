"""行情相关 API"""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query, Body
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Stock, Price, Watchlist, WatchlistItem
from app.schemas import PriceOut, StockOut
from app.services.market import MarketService, StockLoader

router = APIRouter()


@router.get("/stocks/search", response_model=list[StockOut])
async def search_stocks(
    q: str = Query(..., min_length=1),
    market: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    svc = MarketService(db)
    stocks = await svc.search_stocks(q, market)
    return [StockOut.model_validate(s) for s in stocks]


@router.get("/stocks/{stock_id}/prices", response_model=list[PriceOut])
async def get_prices(
    stock_id: int,
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    start = datetime.now() - timedelta(days=days)
    result = await db.execute(
        select(Price)
        .where(Price.stock_id == stock_id, Price.date >= start)
        .order_by(Price.date.desc())
    )
    return [PriceOut.model_validate(p) for p in result.scalars().all()]


@router.get("/stocks/{stock_id}/realtime")
async def get_realtime(stock_id: int, db: AsyncSession = Depends(get_db)):
    """获取股票实时概览（最近价格 + 简况）"""
    stock = await db.get(Stock, stock_id)
    if not stock:
        return {"error": "股票不存在"}

    result = await db.execute(
        select(Price).where(Price.stock_id == stock_id).order_by(Price.date.desc()).limit(2)
    )
    prices = list(result.scalars().all())

    if not prices:
        return {"symbol": stock.symbol, "name": stock.name, "price": "N/A"}

    latest = prices[0]
    change = f"+{(float(latest.close) - float(prices[1].close)) / float(prices[1].close) * 100:.2f}%" \
        if len(prices) > 1 else "0%"

    return {
        "symbol": stock.symbol,
        "market": stock.market,
        "name": stock.name,
        "price": float(latest.close),
        "change": change,
        "volume": int(latest.volume),
        "date": latest.date.isoformat(),
    }


# ─── 自选股 ─────────────────────────────────────

@router.get("/watchlists")
async def get_watchlists(db: AsyncSession = Depends(get_db)):
    """获取所有自选股分组（含股票列表）"""
    result = await db.execute(
        select(Watchlist)
    )
    watchlists = result.scalars().all()
    data = []
    for wl in watchlists:
        items_result = await db.execute(
            select(Stock).join(WatchlistItem).where(WatchlistItem.watchlist_id == wl.id)
        )
        stocks = [StockOut.model_validate(s) for s in items_result.scalars().all()]
        data.append({"id": wl.id, "name": wl.name, "stocks": stocks})
    return data


@router.post("/watchlists")
async def create_watchlist(name: str = "默认分组", db: AsyncSession = Depends(get_db)):
    wl = Watchlist(name=name)
    db.add(wl)
    await db.flush()
    return {"id": wl.id, "name": wl.name}


# ─── 批量加载股票 ───────────────────────────────

@router.post("/stocks/load-all")
async def load_all_stocks(db: AsyncSession = Depends(get_db)):
    """从数据源批量加载 A/HK/US 股票列表"""
    loader = StockLoader(db)
    results = {}
    try:
        results["A"] = await loader.load_a_shares()
    except Exception as e:
        results["A"] = f"error: {e}"
    try:
        results["HK"] = await loader.load_hk_shares()
    except Exception as e:
        results["HK"] = f"error: {e}"
    try:
        results["US"] = await loader.load_us_shares()
    except Exception as e:
        results["US"] = f"error: {e}"
    await db.commit()
    return {"message": "加载完成", "results": results}


@router.get("/stocks/all", response_model=list[StockOut])
async def list_all_stocks(
    market: Optional[str] = None,
    limit: int = Query(200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
):
    """获取所有股票列表"""
    stmt = select(Stock)
    if market:
        stmt = stmt.where(Stock.market == market)
    stmt = stmt.limit(limit)
    result = await db.execute(stmt)
    return [StockOut.model_validate(s) for s in result.scalars().all()]


@router.post("/watchlists/{watchlist_id}/items")
async def add_to_watchlist(
    watchlist_id: int,
    stock_id: int = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
):
    wl = await db.get(Watchlist, watchlist_id)
    if not wl:
        return {"error": "分组不存在"}

    # 检查是否已存在
    existing = await db.execute(
        select(WatchlistItem).where(
            WatchlistItem.watchlist_id == watchlist_id,
            WatchlistItem.stock_id == stock_id,
        )
    )
    if existing.scalar_one_or_none():
        return {"message": "已存在"}

    item = WatchlistItem(watchlist_id=watchlist_id, stock_id=stock_id)
    db.add(item)
    await db.flush()
    return {"message": "添加成功"}


@router.delete("/watchlists/{watchlist_id}/items/{stock_id}")
async def remove_from_watchlist(
    watchlist_id: int,
    stock_id: int,
    db: AsyncSession = Depends(get_db),
):
    """从自选股分组中移出"""
    result = await db.execute(
        select(WatchlistItem).where(
            WatchlistItem.watchlist_id == watchlist_id,
            WatchlistItem.stock_id == stock_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        return {"error": "不在自选股中"}
    await db.delete(item)
    await db.flush()
    return {"message": "移出成功"}
