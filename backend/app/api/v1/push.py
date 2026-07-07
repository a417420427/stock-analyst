"""推送相关 API"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import PushPreference, PushHistory, User
from app.schemas import PushPreferenceOut, PushPreferenceUpdate, PushHistoryOut
from app.api.v1.auth import get_current_user

router = APIRouter()


@router.get("/preferences", response_model=PushPreferenceOut)
async def get_preferences(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PushPreference).where(PushPreference.user_id == user.id)
    )
    pref = result.scalar_one_or_none()
    if not pref:
        pref = PushPreference(user_id=user.id)
        db.add(pref)
        await db.flush()
    return PushPreferenceOut.model_validate(pref)


@router.patch("/preferences", response_model=PushPreferenceOut)
async def update_preferences(
    body: PushPreferenceUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PushPreference).where(PushPreference.user_id == user.id)
    )
    pref = result.scalar_one_or_none()
    if not pref:
        pref = PushPreference(user_id=user.id)
        db.add(pref)

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(pref, key, value)
    await db.flush()
    return PushPreferenceOut.model_validate(pref)


@router.get("/history", response_model=list[PushHistoryOut])
async def get_push_history(
    limit: int = 20,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PushHistory)
        .where(PushHistory.user_id == user.id)
        .order_by(desc(PushHistory.created_at))
        .limit(limit)
    )
    return [PushHistoryOut.model_validate(h) for h in result.scalars().all()]


@router.post("/test")
async def send_push_test(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """发送测试推送"""
    from app.services.push import PushRouter

    router = PushRouter(db)
    results = await router.push(
        user_id=user.id,
        title="🔔 测试推送",
        body="这是一条来自 StockAnalyst 的测试消息。\n\n如果看到这条消息，说明推送配置正常！",
        level="normal",
    )
    return {"results": results}
