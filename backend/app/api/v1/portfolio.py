"""模拟交易 API"""
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import SimulatedTrade, Stock, Price

router = APIRouter()


@router.post("/trades")
async def create_trade(
    stock_id: int,
    side: str = Query(..., regex="^(buy|sell)$"),
    quantity: int = Query(..., ge=1),
    price: Optional[float] = None,
    note: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """记录模拟交易"""
    stock = await db.get(Stock, stock_id)
    if not stock:
        raise HTTPException(404, "股票不存在")

    # 如果没有指定价格，取最新收盘价
    if not price:
        result = await db.execute(
            select(Price).where(Price.stock_id == stock_id).order_by(Price.date.desc()).limit(1)
        )
        latest = result.scalar_one_or_none()
        if not latest:
            raise HTTPException(400, "该股票没有价格数据")
        price = float(latest.close)

    trade = SimulatedTrade(
        stock_id=stock_id,
        side=side,
        quantity=quantity,
        price=Decimal(str(price)),
        total=Decimal(str(round(price * quantity, 2))),
        note=note,
    )
    db.add(trade)
    await db.flush()
    return {
        "id": trade.id,
        "stock_id": stock_id,
        "side": side,
        "quantity": quantity,
        "price": price,
        "total": float(trade.total),
        "traded_at": trade.traded_at.isoformat(),
    }


@router.get("/trades")
async def list_trades(limit: int = 50, db: AsyncSession = Depends(get_db)):
    """获取所有模拟交易记录（含汇总）"""
    result = await db.execute(
        select(SimulatedTrade).order_by(desc(SimulatedTrade.traded_at)).limit(limit)
    )
    trades = list(result.scalars().all())

    items = []
    for t in trades:
        stock = await db.get(Stock, t.stock_id)
        items.append({
            "id": t.id,
            "stock_id": t.stock_id,
            "symbol": stock.symbol if stock else "",
            "name": stock.name if stock else "",
            "market": stock.market if stock else "",
            "side": t.side,
            "quantity": t.quantity,
            "price": float(t.price),
            "total": float(t.total),
            "traded_at": t.traded_at.isoformat(),
            "note": t.note,
        })

    # 计算持仓汇总
    positions = {}
    for t in trades:
        stock = await db.get(Stock, t.stock_id)
        symbol = stock.symbol if stock else str(t.stock_id)
        if symbol not in positions:
            positions[symbol] = {
                "stock_id": t.stock_id,
                "symbol": symbol,
                "name": stock.name if stock else "",
                "market": stock.market if stock else "",
                "quantity": 0,
                "cost": 0.0,
            }
        p = positions[symbol]
        if t.side == "buy":
            total_cost = p["cost"] * p["quantity"] + float(t.total)
            p["quantity"] += t.quantity
            p["cost"] = total_cost / p["quantity"] if p["quantity"] > 0 else 0
        else:  # sell
            p["quantity"] -= t.quantity

    # 计算当前市值和盈亏
    for symbol, pos in positions.items():
        if pos["quantity"] <= 0:
            continue
        result = await db.execute(
            select(Price).where(Price.stock_id == pos["stock_id"]).order_by(Price.date.desc()).limit(1)
        )
        latest = result.scalar_one_or_none()
        if latest:
            pos["current_price"] = float(latest.close)
            pos["market_value"] = round(pos["current_price"] * pos["quantity"], 2)
            pos["pnl"] = round(pos["market_value"] - pos["cost"] * pos["quantity"], 2)
            pos["pnl_pct"] = round((pos["current_price"] - pos["cost"]) / pos["cost"] * 100, 2) if pos["cost"] > 0 else 0
        else:
            pos["current_price"] = 0
            pos["market_value"] = 0
            pos["pnl"] = 0
            pos["pnl_pct"] = 0

    return {
        "trades": items,
        "positions": [p for p in positions.values() if p["quantity"] > 0],
    }


@router.delete("/trades/{trade_id}")
async def delete_trade(trade_id: int, db: AsyncSession = Depends(get_db)):
    trade = await db.get(SimulatedTrade, trade_id)
    if not trade:
        raise HTTPException(404, "记录不存在")
    await db.delete(trade)
    return {"message": "删除成功"}
