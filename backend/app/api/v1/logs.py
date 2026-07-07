"""操作日志 API"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models import User
from app.models import ActivityLog

router = APIRouter()


@router.get("")
async def list_logs(
    action: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """获取操作日志"""
    stmt = select(ActivityLog).order_by(desc(ActivityLog.created_at)).limit(limit)
    if action:
        stmt = stmt.where(ActivityLog.action == action)

    result = await db.execute(stmt)
    logs = list(result.scalars().all())

    return [
        {
            "id": log.id,
            "action": log.action,
            "level": log.level,
            "title": log.title,
            "detail": log.detail,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]
