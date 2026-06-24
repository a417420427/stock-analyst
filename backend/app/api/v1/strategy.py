"""策略相关 API"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import Strategy, StrategyTemplate, StrategyTrigger
from app.schemas import StrategyCreate, StrategyOut, StrategyTriggerOut, StrategyUpdate

router = APIRouter()


@router.get("/", response_model=list[StrategyOut])
async def list_strategies(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Strategy))
    return [StrategyOut.model_validate(s) for s in result.scalars().all()]


@router.post("/", response_model=StrategyOut)
async def create_strategy(body: StrategyCreate, db: AsyncSession = Depends(get_db)):
    strategy = Strategy(
        name=body.name,
        description=body.description,
        definition=body.definition.model_dump(),
        scan_schedule=body.scan_schedule,
        scan_interval=body.scan_interval,
        is_active=True,
    )
    db.add(strategy)
    await db.flush()
    return StrategyOut.model_validate(strategy)


@router.get("/{strategy_id}", response_model=StrategyOut)
async def get_strategy(strategy_id: int, db: AsyncSession = Depends(get_db)):
    strategy = await db.get(Strategy, strategy_id)
    if not strategy:
        raise HTTPException(404, "策略不存在")
    return StrategyOut.model_validate(strategy)


@router.patch("/{strategy_id}", response_model=StrategyOut)
async def update_strategy(strategy_id: int, body: StrategyUpdate, db: AsyncSession = Depends(get_db)):
    strategy = await db.get(Strategy, strategy_id)
    if not strategy:
        raise HTTPException(404, "策略不存在")

    update_data = body.model_dump(exclude_unset=True)
    if "definition" in update_data and update_data["definition"] is not None:
        update_data["definition"] = body.definition.model_dump()

    for key, value in update_data.items():
        setattr(strategy, key, value)

    await db.flush()
    return StrategyOut.model_validate(strategy)


@router.delete("/{strategy_id}")
async def delete_strategy(strategy_id: int, db: AsyncSession = Depends(get_db)):
    strategy = await db.get(Strategy, strategy_id)
    if not strategy:
        raise HTTPException(404, "策略不存在")
    await db.delete(strategy)
    return {"message": "删除成功"}


@router.get("/{strategy_id}/triggers", response_model=list[StrategyTriggerOut])
async def get_triggers(strategy_id: int, limit: int = 20, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(StrategyTrigger)
        .where(StrategyTrigger.strategy_id == strategy_id)
        .order_by(StrategyTrigger.triggered_at.desc())
        .limit(limit)
    )
    return [StrategyTriggerOut.model_validate(t) for t in result.scalars().all()]


# ─── 策略模板 ──────────────────────────────────

@router.get("/templates/all")
async def list_templates(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StrategyTemplate))
    return [
        {
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "category": t.category,
        }
        for t in result.scalars().all()
    ]


@router.post("/templates")
async def init_default_templates(db: AsyncSession = Depends(get_db)):
    """初始化内置策略模板"""
    templates = [
        StrategyTemplate(
            name="双均线金叉",
            description="短期均线上穿长期均线时买入信号",
            category="trend",
            definition={
                "conditions": [{
                    "type": "ma_cross",
                    "params": {"fast_period": 5, "slow_period": 20, "direction": "golden"}
                }],
                "logic": "AND",
                "actions": [{"type": "notify", "channel": "feishu"}],
                "cooldown_minutes": 60,
            },
        ),
        StrategyTemplate(
            name="MACD 金叉",
            description="MACD DIF 上穿 DEA 时触发",
            category="trend",
            definition={
                "conditions": [{
                    "type": "macd_cross",
                    "params": {"direction": "golden"}
                }],
                "logic": "AND",
                "actions": [{"type": "notify", "channel": "feishu"}],
                "cooldown_minutes": 60,
            },
        ),
        StrategyTemplate(
            name="RSI 超卖反弹",
            description="RSI 低于 30 后回升至 35 以上时触发",
            category="mean_reversion",
            definition={
                "conditions": [{
                    "type": "rsi_threshold",
                    "params": {"direction": "oversold", "threshold": 30}
                }],
                "logic": "AND",
                "actions": [{"type": "notify", "channel": "feishu"}],
                "cooldown_minutes": 120,
            },
        ),
        StrategyTemplate(
            name="放量突破",
            description="价格突破 20 日均线且成交量放大 2 倍以上",
            category="momentum",
            definition={
                "conditions": [
                    {"type": "indicator_cross", "params": {"indicator": "price", "target": "ma20", "direction": "above"}},
                    {"type": "volume_surge", "params": {"ratio": 2.0, "lookback": 20}},
                ],
                "logic": "AND",
                "actions": [{"type": "notify", "channel": "telegram"}],
                "cooldown_minutes": 60,
            },
        ),
        StrategyTemplate(
            name="每日复盘推送",
            description="收盘后推送每日总结",
            category="info",
            definition={
                "conditions": [{"type": "always", "params": {}}],
                "logic": "AND",
                "actions": [{"type": "notify", "channel": "telegram"}],
                "cooldown_minutes": 0,
            },
        ),
    ]

    for t in templates:
        db.add(t)
    await db.flush()
    return {"message": f"已创建 {len(templates)} 个默认模板"}
