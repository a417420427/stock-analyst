"""行情相关 API"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query, Body
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Stock, Price, Watchlist, WatchlistItem
from app.schemas import PriceOut, StockOut
from app.services.market import MarketService, StockLoader
import yfinance as yf

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
    pct = (float(latest.close) - float(prices[1].close)) / float(prices[1].close) * 100 \
        if len(prices) > 1 else 0
    change = f"{pct:+.2f}%"

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
async def create_watchlist(name: str = Body("默认分组"), db: AsyncSession = Depends(get_db)):
    wl = Watchlist(name=name)
    db.add(wl)
    await db.flush()
    return {"id": wl.id, "name": wl.name}


# ─── 批量加载股票 ───────────────────────────────

@router.get("/indices")
async def get_market_indices():
    """获取大盘指数数据（yfinance 实时拉取）"""
    import yfinance as yf
    import asyncio

    index_configs = [
        ("000001.SS", "上证指数", "A"),
        ("^HSI", "恒生指数", "HK"),
        ("^GSPC", "标普500", "US"),
        ("^IXIC", "纳斯达克", "US"),
        ("^DJI", "道琼斯", "US"),
        ("399001.SZ", "深证成指", "A"),
        ("399006.SZ", "创业板指", "A"),
    ]

    results = []
    for symbol, name, market in index_configs:
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="5d")
            info = ticker.info or {}

            if hist is not None and not hist.empty:
                closes = hist['Close'].tolist()
                dates = [str(d.date()) for d in hist.index]
                latest = closes[-1]
                prev = closes[-2] if len(closes) > 1 else latest
                change_pct = round((latest - prev) / prev * 100, 2) if prev else 0

                prices = [{"date": dates[i], "close": round(closes[i], 2)} for i in range(len(dates))]
            else:
                latest = info.get("regularMarketPrice") or info.get("previousClose") or 0
                prev = info.get("previousClose") or latest
                change_pct = round((latest - prev) / prev * 100, 2) if prev else 0
                prices = []

            results.append({
                "symbol": symbol,
                "name": name,
                "market": market,
                "price": round(float(latest), 2) if latest else 0,
                "change_pct": change_pct,
                "prices": prices[-60:],
            })
        except Exception as e:
            results.append({
                "symbol": symbol,
                "name": name,
                "market": market,
                "price": 0,
                "change_pct": 0,
                "prices": [],
                "error": str(e),
            })

    return results


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


@router.post("/stocks/{stock_id}/fetch-realtime")
async def fetch_realtime_prices(stock_id: int, days: int = Query(60, ge=5, le=365), db: AsyncSession = Depends(get_db)):
    """拉取某只股票的真实 K 线数据（yfinance）"""
    stock = await db.get(Stock, stock_id)
    if not stock:
        return {"error": "股票不存在"}
    svc = MarketService(db)
    prices = await svc.fetch_real_prices(stock, days)
    return {"symbol": stock.symbol, "market": stock.market, "name": stock.name, "count": len(prices)}


@router.post("/stocks/{stock_id}/fetch-fundamentals")
async def fetch_fundamentals(stock_id: int, db: AsyncSession = Depends(get_db)):
    """拉取基本面数据"""
    stock = await db.get(Stock, stock_id)
    if not stock:
        return {"error": "股票不存在"}
    svc = MarketService(db)
    result = await svc.fetch_fundamentals(stock)
    return {"symbol": stock.symbol, "name": stock.name, "fundamentals": result}


@router.post("/stocks/fetch-all-realtime")
async def fetch_all_realtime(db: AsyncSession = Depends(get_db)):
    """拉取所有自选股的真实 K 线数据"""
    result = await db.execute(select(Watchlist))
    watchlists = list(result.scalars().all())
    svc = MarketService(db)
    total = 0
    for wl in watchlists:
        items = await db.execute(
            select(WatchlistItem).where(WatchlistItem.watchlist_id == wl.id)
        )
        for item in items.scalars().all():
            stock = await db.get(Stock, item.stock_id)
            if stock:
                prices = await svc.fetch_real_prices(stock)
                total += len(prices)
    return {"message": "刷新完成", "total_prices": total}


@router.get("/stocks/all")
async def list_all_stocks(
    market: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=10, le=200),
    db: AsyncSession = Depends(get_db),
):
    """获取所有股票列表（分页，含最新价和涨跌幅）"""
    stmt = select(Stock)
    if market:
        stmt = stmt.where(Stock.market == market)
    stmt = stmt.order_by(Stock.id)
    
    # 先算总数
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar()
    
    # 分页
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    stocks = list(result.scalars().all())
    
    items = []
    for s in stocks:
        # 获取最新价格
        price_result = await db.execute(
            select(Price).where(Price.stock_id == s.id).order_by(Price.date.desc()).limit(2)
        )
        prices = list(price_result.scalars().all())
        latest_price = float(prices[0].close) if prices else None
        change_pct = round((float(prices[0].close) - float(prices[1].close)) / float(prices[1].close) * 100, 2) if len(prices) >= 2 else None
        
        items.append({
            "id": s.id,
            "symbol": s.symbol,
            "name": s.name,
            "market": s.market,
            "sector": s.sector,
            "industry": s.industry,
            "pe_ttm": float(s.pe_ttm) if s.pe_ttm else None,
            "pb": float(s.pb) if s.pb else None,
            "latest_price": latest_price,
            "change_pct": change_pct,
        })
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": items,
    }


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


@router.patch("/watchlists/{watchlist_id}")
async def rename_watchlist(watchlist_id: int, name: str = Body(...), db: AsyncSession = Depends(get_db)):
    """重命名自选股分组"""
    wl = await db.get(Watchlist, watchlist_id)
    if not wl:
        return {"error": "分组不存在"}
    wl.name = name
    await db.flush()
    return {"message": "重命名成功"}


@router.delete("/watchlists/{watchlist_id}")
async def delete_watchlist(watchlist_id: int, db: AsyncSession = Depends(get_db)):
    """删除自选股分组"""
    wl = await db.get(Watchlist, watchlist_id)
    if not wl:
        return {"error": "分组不存在"}
    # 删除所有关联的 items
    items = await db.execute(
        select(WatchlistItem).where(WatchlistItem.watchlist_id == watchlist_id)
    )
    for item in items.scalars().all():
        await db.delete(item)
    await db.delete(wl)
    await db.flush()
    return {"message": "删除成功"}


# ─── 交易日历 ─────────────────────────────────────

def _market_status(
    tz_name: str,
    open_hour: int, open_min: int,
    close_hour: int, close_min: int,
    pre_minutes: int = 30,
    post_minutes: int = 30,
):
    """
    判断给定市场当前处于什么阶段。
    pre_minutes / post_minutes 为盘前/盘后范围（分钟）。
    返回 { status, next_open, next_close }
    """
    import pytz
    tz = pytz.timezone(tz_name)
    now = datetime.now(tz)

    today_open = now.replace(hour=open_hour, minute=open_min, second=0, microsecond=0)
    today_close = now.replace(hour=close_hour, minute=close_min, second=0, microsecond=0)

    pre_start = today_open - timedelta(minutes=pre_minutes)
    post_end = today_close + timedelta(minutes=post_minutes)

    # 如果是周六/日，直接返回闭市
    weekday = now.weekday()
    is_trading_day = weekday < 5

    if not is_trading_day:
        return {
            "status": "closed",
            "next_open": (now + timedelta(days=(7 - weekday) if weekday == 6 else (1 - weekday))).replace(
                hour=open_hour, minute=open_min, second=0, microsecond=0
            ).isoformat(),
            "next_close": (now + timedelta(days=(7 - weekday) if weekday == 6 else (1 - weekday))).replace(
                hour=close_hour, minute=close_min, second=0, microsecond=0
            ).isoformat(),
        }

    if pre_start <= now < today_open:
        return {
            "status": "pre",
            "next_open": today_open.isoformat(),
            "next_close": today_close.isoformat(),
        }
    elif today_open <= now <= today_close:
        return {
            "status": "trading",
            "next_open": today_open.isoformat(),
            "next_close": today_close.isoformat(),
        }
    elif today_close < now <= post_end:
        return {
            "status": "post",
            "next_open": (today_open + timedelta(days=1)).isoformat(),
            "next_close": (today_close + timedelta(days=1)).isoformat(),
        }
    else:
        # 闭市，等到下一个交易日
        next_day = now + timedelta(days=1)
        # 如果第二天是周末，跳到周一
        while next_day.weekday() >= 5:
            next_day += timedelta(days=1)
        next_open = next_day.replace(hour=open_hour, minute=open_min, second=0, microsecond=0)
        next_close = next_day.replace(hour=close_hour, minute=close_min, second=0, microsecond=0)
        return {
            "status": "closed",
            "next_open": next_open.isoformat(),
            "next_close": next_close.isoformat(),
        }


@router.get("/trading-status")
async def get_trading_status():
    """
    获取各市场当前交易状态。
    根据当前时间判断 A股 / 港股 / 美股处于交易/盘前/盘后/休市。
    """
    import pytz

    # A 股：北京时间 9:30-15:00，盘前 30min，盘后 30min
    a_status = _market_status("Asia/Shanghai", 9, 30, 15, 0, 30, 30)

    # 港股：北京时间 9:30-16:00
    hk_status = _market_status("Asia/Shanghai", 9, 30, 16, 0, 30, 30)

    # 美股：美东时间 9:30-16:00 (ET = UTC-5 / UTC-4 DST) -> 即 21:30-04:00+1 北京时间
    us_status = _market_status("US/Eastern", 9, 30, 16, 0, 30, 30)

    return {
        "a": a_status,
        "hk": hk_status,
        "us": us_status,
        "server_time": datetime.now(timezone.utc).isoformat(),
    }
