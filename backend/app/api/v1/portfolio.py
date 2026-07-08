"""模拟交易 API — 多账户 + 策略组合"""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import SimulatedAccount, SimulatedTrade, Stock, Price, Strategy, User
from app.api.v1.auth import get_current_user
from app.schemas import AccountCreate

router = APIRouter()

COMMISSION_RATES = {
    "A": 0.00015,    # 万1.5
    "HK": 0.00025,   # 万2.5
    "US": 0.0001,    # 万1
}
STAMP_DUTY_A = 0.0005  # A股印花税 万5 (卖出)


# ─── 日志辅助 ─────────────────────────────────────

async def _log(db: AsyncSession, user_id: int, action: str, level: str, title: str, detail: dict = None):
    from app.models import ActivityLog
    log = ActivityLog(user_id=user_id, action=action, level=level, title=title, detail=detail)
    db.add(log)


# ─── 账户管理 ─────────────────────────────────────

@router.post("/accounts")
async def create_account(
    body: AccountCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """创建模拟账户"""
    account = SimulatedAccount(
        user_id=user.id,
        name=body.name,
        initial_balance=Decimal(str(body.initial_balance)),
        available_balance=Decimal(str(body.initial_balance)),
        strategy_id=body.strategy_id,
    )
    db.add(account)
    await db.flush()
    return {
        "id": account.id,
        "name": account.name,
        "initial_balance": float(account.initial_balance),
        "available_balance": float(account.available_balance),
        "strategy_id": account.strategy_id,
    }


@router.get("/accounts")
async def list_accounts(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """列出当前用户的所有模拟账户（含汇总）"""
    result = await db.execute(
        select(SimulatedAccount).where(
            SimulatedAccount.is_active == True,
            SimulatedAccount.user_id == user.id,
        )
    )
    accounts = list(result.scalars().all())

    items = []
    for acc in accounts:
        strat_name = None
        if acc.strategy_id:
            strat = await db.get(Strategy, acc.strategy_id)
            strat_name = strat.name if strat else None

        # 计算持仓市值
        trades_result = await db.execute(
            select(SimulatedTrade).where(SimulatedTrade.account_id == acc.id).order_by(SimulatedTrade.traded_at)
        )
        trades = list(trades_result.scalars().all())

        positions = {}
        total_cost = Decimal("0")
        for t in trades:
            if t.side == "buy":
                if t.stock_id not in positions:
                    positions[t.stock_id] = {"qty": 0, "cost": Decimal("0")}
                p = positions[t.stock_id]
                p["qty"] += t.quantity
                p["cost"] += t.total
            else:
                if t.stock_id in positions:
                    p = positions[t.stock_id]
                    # Reduce proportionally
                    ratio = Decimal(str(t.quantity)) / Decimal(str(p["qty"])) if p["qty"] > 0 else Decimal("0")
                    p["cost"] = p["cost"] * (Decimal("1") - ratio)
                    p["qty"] -= t.quantity

        market_value = Decimal("0")
        for stock_id, pos in positions.items():
            if pos["qty"] <= 0:
                continue
            price_result = await db.execute(
                select(Price).where(Price.stock_id == stock_id).order_by(Price.date.desc()).limit(1)
            )
            latest = price_result.scalar_one_or_none()
            if latest:
                market_value += Decimal(str(latest.close)) * Decimal(str(pos["qty"]))

        total_asset = acc.available_balance + market_value + acc.frozen_balance
        total_pnl = total_asset - acc.initial_balance
        pnl_pct = float(total_pnl) / float(acc.initial_balance) * 100 if acc.initial_balance > 0 else 0

        items.append({
            "id": acc.id,
            "name": acc.name,
            "strategy_id": acc.strategy_id,
            "strategy_name": strat_name,
            "initial_balance": float(acc.initial_balance),
            "available_balance": float(acc.available_balance),
            "frozen_balance": float(acc.frozen_balance),
            "market_value": float(market_value),
            "total_asset": float(total_asset),
            "total_pnl": float(total_pnl),
            "pnl_pct": round(pnl_pct, 2),
            "position_count": sum(1 for p in positions.values() if p["qty"] > 0),
            "is_ai_generated": acc.is_ai_generated,
            "ai_prompt": acc.ai_prompt,
            "commission_rate": float(acc.commission_rate),
            "created_at": acc.created_at.isoformat() if acc.created_at else None,
        })

    return items


@router.get("/accounts/{account_id}")
async def get_account_detail(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """获取单个账户详细持仓"""
    acc = await db.get(SimulatedAccount, account_id)
    if not acc or acc.user_id != user.id:
        raise HTTPException(404, "账户不存在")

    strat_name = None
    if acc.strategy_id:
        strat = await db.get(Strategy, acc.strategy_id)
        strat_name = strat.name if strat else None

    trades_result = await db.execute(
        select(SimulatedTrade).where(SimulatedTrade.account_id == account_id).order_by(SimulatedTrade.traded_at)
    )
    trades = list(trades_result.scalars().all())

    # Build positions with stock info
    position_map = {}
    for t in trades:
        if t.stock_id not in position_map:
            stock = await db.get(Stock, t.stock_id)
            position_map[t.stock_id] = {
                "stock_id": t.stock_id,
                "symbol": stock.symbol if stock else "",
                "name": stock.name if stock else "",
                "market": stock.market if stock else "",
                "quantity": 0,
                "cost_total": Decimal("0"),
                "buy_count": 0,
                "sell_count": 0,
            }
        p = position_map[t.stock_id]
        if t.side == "buy":
            p["quantity"] += t.quantity
            p["cost_total"] += t.total
            p["buy_count"] += 1
        else:
            ratio = Decimal(str(t.quantity)) / Decimal(str(p["quantity"])) if p["quantity"] > 0 else Decimal("0")
            p["cost_total"] = p["cost_total"] * (Decimal("1") - ratio)
            p["quantity"] -= t.quantity
            p["sell_count"] += 1

    positions = []
    total_market_value = Decimal("0")
    for stock_id, pos in position_map.items():
        if pos["quantity"] <= 0:
            continue
        stock = await db.get(Stock, stock_id)
        price_result = await db.execute(
            select(Price).where(Price.stock_id == stock_id).order_by(Price.date.desc()).limit(1)
        )
        latest = price_result.scalar_one_or_none()
        current_price = float(latest.close) if latest else 0
        avg_cost = float(pos["cost_total"] / Decimal(str(pos["quantity"]))) if pos["quantity"] > 0 else 0
        market_val = current_price * pos["quantity"]
        pnl = market_val - float(pos["cost_total"])
        pnl_pct = (current_price - avg_cost) / avg_cost * 100 if avg_cost > 0 else 0

        total_market_value += Decimal(str(market_val))

        positions.append({
            "stock_id": stock_id,
            "symbol": stock.symbol if stock else "",
            "name": stock.name if stock else "",
            "market": stock.market if stock else "",
            "quantity": pos["quantity"],
            "avg_cost": round(avg_cost, 2),
            "current_price": current_price,
            "market_value": round(market_val, 2),
            "cost_total": round(float(pos["cost_total"]), 2),
            "pnl": round(pnl, 2),
            "pnl_pct": round(pnl_pct, 2),
            "buy_count": pos["buy_count"],
            "sell_count": pos["sell_count"],
        })

    total_asset = float(acc.available_balance) + float(total_market_value) + float(acc.frozen_balance)
    total_pnl = total_asset - float(acc.initial_balance)
    pnl_pct = total_pnl / float(acc.initial_balance) * 100 if float(acc.initial_balance) > 0 else 0

    return {
        "account": {
            "id": acc.id,
            "name": acc.name,
            "strategy_id": acc.strategy_id,
            "strategy_name": strat_name,
            "is_ai_generated": acc.is_ai_generated,
            "ai_prompt": acc.ai_prompt,
            "initial_balance": float(acc.initial_balance),
            "available_balance": float(acc.available_balance),
            "frozen_balance": float(acc.frozen_balance),
            "commission_rate": float(acc.commission_rate),
            "slippage": float(acc.slippage),
        },
        "summary": {
            "market_value": round(float(total_market_value), 2),
            "total_asset": round(total_asset, 2),
            "total_pnl": round(total_pnl, 2),
            "pnl_pct": round(pnl_pct, 2),
            "position_count": len(positions),
        },
        "positions": positions,
    }


# ─── 交易 ──────────────────────────────────────────

@router.post("/accounts/{account_id}/trades")
async def create_trade(
    account_id: int,
    stock_id: int,
    side: str = Query(..., pattern="^(buy|sell)$"),
    quantity: int = Query(..., ge=1),
    price: Optional[float] = None,
    order_type: str = Query("market", pattern="^(market|limit)$"),
    note: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """在指定账户下记录一笔交易"""
    acc = await db.get(SimulatedAccount, account_id)
    if not acc or acc.user_id != user.id:
        raise HTTPException(404, "账户不存在")

    stock = await db.get(Stock, stock_id)
    if not stock:
        raise HTTPException(404, "股票不存在")

    if not price:
        result = await db.execute(
            select(Price).where(Price.stock_id == stock_id).order_by(Price.date.desc()).limit(1)
        )
        latest = result.scalar_one_or_none()
        if not latest:
            raise HTTPException(400, "该股票没有价格数据")
        price = float(latest.close)

    # 计算交易费用
    commission_rate = float(acc.commission_rate)
    slip = float(acc.slippage)

    # 滑点：买入+0.1%，卖出-0.1%
    exec_price = price * (1 + slip) if side == "buy" else price * (1 - slip)
    trade_total = round(exec_price * quantity, 2)

    commission = round(trade_total * commission_rate, 2)
    stamp_duty = round(trade_total * STAMP_DUTY_A, 2) if stock.market == "A" and side == "sell" else 0
    total_cost = round(trade_total + commission + stamp_duty, 2)

    # 资金检查
    if side == "buy":
        if float(acc.available_balance) < total_cost:
            raise HTTPException(400, f"可用资金不足: ¥{float(acc.available_balance):.2f} < ¥{total_cost:.2f}")
        acc.available_balance = Decimal(str(float(acc.available_balance) - total_cost))
    else:
        # 检查持仓是否足够
        trades_result = await db.execute(
            select(SimulatedTrade).where(
                SimulatedTrade.account_id == account_id,
                SimulatedTrade.stock_id == stock_id,
            )
        )
        all_trades = list(trades_result.scalars().all())
        hold_qty = sum(t.quantity if t.side == "buy" else -t.quantity for t in all_trades)
        if hold_qty < quantity:
            raise HTTPException(400, f"持仓不足: {hold_qty} < {quantity}")
        acc.available_balance = Decimal(str(float(acc.available_balance) + trade_total - commission - stamp_duty))

    trade = SimulatedTrade(
        user_id=user.id,
        account_id=account_id,
        stock_id=stock_id,
        side=side,
        quantity=quantity,
        price=Decimal(str(price)),
        total=Decimal(str(trade_total)),
        commission=Decimal(str(commission)),
        order_type=order_type,
        note=note,
    )
    db.add(trade)
    await db.flush()

    await _log(db, user.id, "trade", "success",
        f'{"买入" if side == "buy" else "卖出"} {stock.name} {quantity}股 @ {price}',
        {"account_id": account_id, "stock_id": stock_id, "side": side, "quantity": quantity,
         "price": price, "total": trade_total, "commission": commission, "stamp_duty": stamp_duty}
    )

    return {
        "id": trade.id,
        "account_id": account_id,
        "stock_id": stock_id,
        "symbol": stock.symbol,
        "name": stock.name,
        "market": stock.market,
        "side": side,
        "quantity": quantity,
        "price": price,
        "exec_price": round(exec_price, 2),
        "trade_total": trade_total,
        "commission": commission,
        "stamp_duty": stamp_duty,
        "total_cost": total_cost,
        "order_type": order_type,
        "available_balance": float(acc.available_balance),
        "traded_at": trade.traded_at.isoformat(),
    }


# ─── 交易记录 ─────────────────────────────────────

@router.get("/accounts/{account_id}/trades")
async def list_trades(
    account_id: int,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """获取账户的交易流水"""
    acc = await db.get(SimulatedAccount, account_id)
    if not acc or acc.user_id != user.id:
        raise HTTPException(404, "账户不存在")
    result = await db.execute(
        select(SimulatedTrade)
        .where(SimulatedTrade.account_id == account_id)
        .order_by(desc(SimulatedTrade.traded_at))
        .limit(limit)
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
            "commission": float(t.commission),
            "order_type": t.order_type,
            "traded_at": t.traded_at.isoformat(),
            "note": t.note,
        })

    return items


@router.delete("/accounts/{account_id}")
async def reset_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """重置账户（删除所有交易记录，恢复初始资金）"""
    acc = await db.get(SimulatedAccount, account_id)
    if not acc or acc.user_id != user.id:
        raise HTTPException(404, "账户不存在")

    # Delete all trades
    result = await db.execute(
        select(SimulatedTrade).where(SimulatedTrade.account_id == account_id)
    )
    for t in result.scalars().all():
        await db.delete(t)

    acc.available_balance = acc.initial_balance
    acc.frozen_balance = Decimal("0")
    await db.flush()
    return {"message": f"账户 '{acc.name}' 已重置，初始资金 ¥{float(acc.initial_balance):.2f}"}


@router.delete("/accounts/{account_id}/delete")
async def delete_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """删除账户（软删除，is_active=False）"""
    acc = await db.get(SimulatedAccount, account_id)
    if not acc or acc.user_id != user.id:
        raise HTTPException(404, "账户不存在")

    acc.is_active = False
    await _log(
        db, user.id, "account_delete", "info",
        f'删除组合 "{acc.name}"',
        {"account_id": account_id, "name": acc.name}
    )
    await db.flush()
    return {"message": f"账户 '{acc.name}' 已删除"}


@router.post("/accounts/{account_id}/deposit")
async def deposit(
    account_id: int,
    amount: float = Query(..., gt=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """追加资金"""
    acc = await db.get(SimulatedAccount, account_id)
    if not acc or acc.user_id != user.id:
        raise HTTPException(404, "账户不存在")
    acc.available_balance += Decimal(str(amount))
    await db.flush()
    return {
        "message": f"入金 ¥{amount:.2f} 成功",
        "available_balance": float(acc.available_balance),
    }


@router.post("/accounts/{account_id}/withdraw")
async def withdraw(
    account_id: int,
    amount: float = Query(..., gt=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """提取资金"""
    acc = await db.get(SimulatedAccount, account_id)
    if not acc or acc.user_id != user.id:
        raise HTTPException(404, "账户不存在")
    if float(acc.available_balance) < amount:
        raise HTTPException(400, f"可用资金不足: ¥{float(acc.available_balance):.2f}")
    acc.available_balance -= Decimal(str(amount))
    await db.flush()
    return {
        "message": f"提现 ¥{amount:.2f} 成功",
        "available_balance": float(acc.available_balance),
    }


# ─── AI 选股 ─────────────────────────────────────

@router.post("/ai-generate")
async def ai_generate_portfolio(
    prompt: str = Query(..., description="选股需求描述"),
    initial_balance: float = Query(1000000.0, ge=10000),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """AI 选股 — 生成投资组合建议"""
    from app.utils.ai_quota import check_and_increment
    await check_and_increment(user.id, "ai_pick", db)
    from app.services.ai import AIService

    # 获取全部股票数据
    result = await db.execute(
        select(Stock).order_by(Stock.id)
    )
    stocks = list(result.scalars().all())

    ai_svc = AIService()
    suggestion = await ai_svc.ai_select_portfolio(prompt, stocks, db_session=db)

    if "error" in suggestion:
        raise HTTPException(400, suggestion["error"])

    return {
        "prompt": prompt,
        "suggestion": {
            "name": suggestion.get("name", "AI 选股组合"),
            "description": suggestion.get("description", ""),
            "stocks": suggestion.get("stocks", []),
            "estimated_return": suggestion.get("estimated_return", ""),
            "risk_level": suggestion.get("risk_level", "medium"),
            "advice": suggestion.get("advice", ""),
        },
        "initial_balance": initial_balance,
    }


@router.post("/ai-create")
async def ai_create_portfolio(
    prompt: str = Query(..., description="选股需求描述"),
    initial_balance: float = Query(1000000.0, ge=10000),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """AI 选股并直接创建模拟账户+买入"""
    from app.utils.ai_quota import check_and_increment
    await check_and_increment(user.id, "ai_pick", db)

    from app.services.ai import AIService

    result = await db.execute(select(Stock).order_by(Stock.id))
    stocks = list(result.scalars().all())

    ai_svc = AIService()
    suggestion = await ai_svc.ai_select_portfolio(prompt, stocks, db_session=db)

    if "error" in suggestion:
        raise HTTPException(400, suggestion["error"])

    stock_list = suggestion.get("stocks", [])
    if not stock_list:
        raise HTTPException(400, "AI 未选出任何股票")

    name = suggestion.get("name", "AI 选股组合")[:64]

    # 创建模拟账户
    account = SimulatedAccount(
        user_id=user.id,
        name=name,
        initial_balance=Decimal(str(initial_balance)),
        available_balance=Decimal(str(initial_balance)),
        is_ai_generated=True,
        ai_prompt=prompt,
    )
    db.add(account)
    await db.flush()

    # 自动买入
    trades_created = []
    remaining = Decimal(str(initial_balance))
    sorted_stocks = sorted(stock_list, key=lambda x: x.get("weight", 0), reverse=True)

    for i, item in enumerate(sorted_stocks):
        stock_id = item.get("stock_id")
        weight = item.get("weight", 0)
        if not stock_id or weight <= 0:
            continue

        stock = await db.get(Stock, stock_id)
        if not stock:
            continue

        # 获取最新价
        price_result = await db.execute(
            select(Price).where(Price.stock_id == stock_id).order_by(Price.date.desc()).limit(1)
        )
        latest = price_result.scalar_one_or_none()
        if not latest:
            continue

        current_price = float(latest.close)
        slip = float(account.slippage)
        exec_price = current_price * (1 + slip)

        # 计算买入数量
        allocated = float(initial_balance) * weight
        quantity = max(1, int(allocated / exec_price / 100) * 100)  # 取整手
        
        if quantity <= 0:
            continue

        trade_total = round(exec_price * quantity, 2)
        commission_rate = float(account.commission_rate)
        commission = round(trade_total * commission_rate, 2)
        total_cost = round(trade_total + commission, 2)

        if float(account.available_balance) < total_cost:
            # 如果是最后一只，用剩余资金
            if i == len(sorted_stocks) - 1:
                available = float(account.available_balance)
                quantity = max(1, int(available / exec_price / 100) * 100)
                if quantity <= 0:
                    continue
                trade_total = round(exec_price * quantity, 2)
                commission = round(trade_total * commission_rate, 2)
                total_cost = round(trade_total + commission, 2)
            else:
                continue

        trade = SimulatedTrade(
            account_id=account.id,
            stock_id=stock_id,
            side="buy",
            quantity=quantity,
            price=Decimal(str(current_price)),
            total=Decimal(str(trade_total)),
            commission=Decimal(str(commission)),
            order_type="market",
        )
        db.add(trade)
        account.available_balance -= Decimal(str(total_cost))
        await db.flush()

        trades_created.append({
            "stock_id": stock_id,
            "symbol": stock.symbol,
            "name": stock.name,
            "market": stock.market,
            "quantity": quantity,
            "price": current_price,
            "exec_price": round(exec_price, 2),
            "weight": weight,
            "total": trade_total,
            "commission": commission,
        })

    await _log(db, user.id, "ai_pick", "success",
        f'AI选股创建组合 "{name}" ({len(trades_created)}只)',
        {"account_id": account.id, "name": name, "prompt": prompt, "trades": trades_created}
    )

    return {
        "account": {
            "id": account.id,
            "name": account.name,
            "initial_balance": initial_balance,
            "available_balance": float(account.available_balance),
        },
        "suggestion": {
            "name": name,
            "description": suggestion.get("description", ""),
            "estimated_return": suggestion.get("estimated_return", ""),
            "risk_level": suggestion.get("risk_level", "medium"),
            "advice": suggestion.get("advice", ""),
        },
        "trades": trades_created,
        "total_invested": sum(t["total"] for t in trades_created),
    }


# ─── 定时 AI 选股 ─────────────────────────────────

@router.post("/ai-auto-pick")
async def ai_auto_pick(
    prompt: str = Query(..., description="选股需求，如：明日涨幅最高的5只"),
    top_n: int = Query(5, ge=1, le=20),
    initial_balance: float = Query(100000.0, ge=10000),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """AI 自动选股 — 预测全市场选出明日最佳 Top N，自动创建组合并买入"""
    from app.utils.ai_quota import check_and_increment
    await check_and_increment(user.id, "ai_pick", db)

    from app.services.ai import AIService
    from datetime import date

    result = await db.execute(select(Stock).order_by(Stock.id))
    stocks = list(result.scalars().all())

    ai_svc = AIService()
    today = date.today().strftime("%m%d")
    full_prompt = f"{prompt}，最多选{top_n}只"
    suggestion = await ai_svc.ai_select_portfolio(full_prompt, stocks, db_session=db)

    if "error" in suggestion:
        raise HTTPException(400, suggestion["error"])

    stock_list = suggestion.get("stocks", [])
    if not stock_list:
        raise HTTPException(400, "AI 未选出任何股票")

    name = f"AI自动选股-{today}"

    account = SimulatedAccount(
        user_id=user.id,
        name=name,
        initial_balance=Decimal(str(initial_balance)),
        available_balance=Decimal(str(initial_balance)),
        is_ai_generated=True,
        ai_prompt=prompt,
    )
    db.add(account)
    await db.flush()

    # 自动买入
    trades_created = []
    remaining = Decimal(str(initial_balance))
    sorted_stocks = sorted(stock_list, key=lambda x: x.get("weight", 0), reverse=True)

    for i, item in enumerate(sorted_stocks):
        stock_id = item.get("stock_id")
        weight = item.get("weight", 0)
        if not stock_id or weight <= 0:
            continue

        stock = await db.get(Stock, stock_id)
        if not stock:
            continue

        price_result = await db.execute(
            select(Price).where(Price.stock_id == stock_id).order_by(Price.date.desc()).limit(1)
        )
        latest = price_result.scalar_one_or_none()
        if not latest:
            continue

        current_price = float(latest.close)
        slip = float(account.slippage)
        exec_price = current_price * (1 + slip)

        allocated = float(initial_balance) * weight
        quantity = max(1, int(allocated / exec_price / 100) * 100)

        if quantity <= 0:
            continue

        trade_total = round(exec_price * quantity, 2)
        commission_rate = float(account.commission_rate)
        commission = round(trade_total * commission_rate, 2)
        total_cost = round(trade_total + commission, 2)

        trade = SimulatedTrade(
            account_id=account.id,
            stock_id=stock_id,
            side="buy",
            quantity=quantity,
            price=Decimal(str(current_price)),
            total=Decimal(str(trade_total)),
            commission=Decimal(str(commission)),
            order_type="market",
        )
        db.add(trade)
        account.available_balance -= Decimal(str(total_cost))
        await db.flush()

        trades_created.append({
            "stock_id": stock_id,
            "symbol": stock.symbol,
            "name": stock.name,
            "market": stock.market,
            "quantity": quantity,
            "price": current_price,
            "exec_price": round(exec_price, 2),
            "weight": weight,
            "total": trade_total,
            "commission": commission,
        })

    await _log(db, user.id, "ai_pick", "success",
        f'AI自动选股 "{name}" ({len(trades_created)}只)',
        {"account_id": account.id, "name": name, "prompt": prompt, "trades": trades_created}
    )

    return {
        "account": {
            "id": account.id,
            "name": account.name,
            "initial_balance": float(account.initial_balance),
            "available_balance": float(account.available_balance),
        },
        "suggestion": {
            "name": name,
            "description": suggestion.get("description", prompt),
            "estimated_return": suggestion.get("estimated_return", ""),
            "risk_level": suggestion.get("risk_level", "medium"),
        },
        "trades": trades_created,
        "total_invested": sum(t["total"] for t in trades_created),
    }
