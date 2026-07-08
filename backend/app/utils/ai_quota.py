"""AI 配额检查 — 按用户+日期+动作限制调用次数"""
from datetime import datetime

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models import AIUsage


async def check_ai_quota(
    user_id: int,
    action: str,
    db: AsyncSession,
) -> bool:
    """检查配额是否未超限。超限返回 False，不抛异常。"""
    limit = settings.ai_quota.get(action, 0)
    if limit <= 0:
        return True  # 不限

    today = datetime.utcnow().strftime("%Y-%m-%d")

    result = await db.execute(
        select(AIUsage).where(
            AIUsage.user_id == user_id,
            AIUsage.date == today,
            AIUsage.action == action,
        )
    )
    usage = result.scalar_one_or_none()

    if usage and usage.count >= limit:
        return False

    return True


async def increment_ai_quota(
    user_id: int,
    action: str,
    db: AsyncSession,
) -> None:
    """增加一次调用计数"""
    today = datetime.utcnow().strftime("%Y-%m-%d")

    result = await db.execute(
        select(AIUsage).where(
            AIUsage.user_id == user_id,
            AIUsage.date == today,
            AIUsage.action == action,
        )
    )
    usage = result.scalar_one_or_none()

    if usage:
        usage.count += 1
    else:
        usage = AIUsage(
            user_id=user_id,
            date=today,
            action=action,
            count=1,
        )
        db.add(usage)


async def check_and_increment(
    user_id: int,
    action: str,
    db: AsyncSession,
) -> None:
    """检查配额，未超限则计数+1；超限则抛出 429"""
    ok = await check_ai_quota(user_id, action, db)
    if not ok:
        limit = settings.ai_quota.get(action, 0)
        raise HTTPException(
            status_code=429,
            detail=f"今日 AI {action} 调用已达上限（{limit}次），请明天再试或升级套餐",
        )
    await increment_ai_quota(user_id, action, db)
