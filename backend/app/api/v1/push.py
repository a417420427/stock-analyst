"""推送相关 API"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import PushPreference, PushHistory
from app.schemas import PushPreferenceOut, PushPreferenceUpdate, PushHistoryOut

router = APIRouter()


@router.get("/preferences", response_model=PushPreferenceOut)
async def get_preferences(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PushPreference).limit(1))
    pref = result.scalar_one_or_none()
    if not pref:
        pref = PushPreference()
        db.add(pref)
        await db.flush()
    return PushPreferenceOut.model_validate(pref)


@router.patch("/preferences", response_model=PushPreferenceOut)
async def update_preferences(body: PushPreferenceUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PushPreference).limit(1))
    pref = result.scalar_one_or_none()
    if not pref:
        pref = PushPreference()
        db.add(pref)

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(pref, key, value)
    await db.flush()
    return PushPreferenceOut.model_validate(pref)


@router.get("/history", response_model=list[PushHistoryOut])
async def get_push_history(limit: int = 20, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PushHistory).order_by(desc(PushHistory.created_at)).limit(limit)
    )
    return [PushHistoryOut.model_validate(h) for h in result.scalars().all()]


@router.post("/test")
async def send_push_test(db: AsyncSession = Depends(get_db)):
    """发送测试推送"""
    from app.services.push import PushRouter

    router = PushRouter(db)
    results = await router.push(
        user_id=1,
        title="🔔 测试推送",
        body="这是一条来自 StockAnalyst 的测试消息。\n\n如果看到这条消息，说明推送配置正常！",
        level="normal",
    )
    return {"results": results}
