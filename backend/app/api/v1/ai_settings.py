"""AI 设置 API — 管理模型和 Key"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import AISettings
from app.schemas import AISettingsCreate, AISettingsOut

router = APIRouter()

# 默认 API 地址
DEFAULT_API_BASES = {
    "openai": "https://api.openai.com/v1",
    "deepseek": "https://api.deepseek.com/v1",
    "together": "https://api.together.xyz/v1",
}


@router.get("/settings", response_model=Optional[AISettingsOut])
async def get_ai_settings(db: AsyncSession = Depends(get_db)):
    """获取当前 AI 配置"""
    result = await db.execute(select(AISettings).where(AISettings.is_active == True).limit(1))
    setting = result.scalar_one_or_none()
    if not setting:
        return None
    return AISettingsOut.model_validate(setting)


@router.post("/settings", response_model=AISettingsOut)
async def save_ai_settings(body: AISettingsCreate, db: AsyncSession = Depends(get_db)):
    """保存 AI 配置（替换旧的活跃配置）"""
    # 停用旧的
    result = await db.execute(select(AISettings).where(AISettings.is_active == True))
    for old in result.scalars().all():
        old.is_active = False

    # 自动补全 api_base
    api_base = body.api_base
    if not api_base and body.provider in DEFAULT_API_BASES:
        api_base = DEFAULT_API_BASES[body.provider]

    setting = AISettings(
        provider=body.provider,
        model=body.model,
        api_key=body.api_key,
        api_base=api_base,
    )
    db.add(setting)
    await db.flush()
    return AISettingsOut.model_validate(setting)


@router.delete("/settings/{setting_id}")
async def delete_ai_setting(setting_id: int, db: AsyncSession = Depends(get_db)):
    setting = await db.get(AISettings, setting_id)
    if not setting:
        raise HTTPException(404, "配置不存在")
    await db.delete(setting)
    return {"message": "删除成功"}
