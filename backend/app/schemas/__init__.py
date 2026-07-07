"""Pydantic schemas — API 请求/响应模型"""
from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, Field


# ─── 用户 ────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    email: Optional[str] = None
    password: str = Field(min_length=6)


class UserLogin(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ─── 股票 ────────────────────────────────────────────

class StockBase(BaseModel):
    symbol: str
    market: str  # A / HK / US
    name: str
    name_en: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None


class StockOut(StockBase):
    id: int
    pe_ttm: Optional[Decimal] = None
    pb: Optional[Decimal] = None
    market_cap: Optional[Decimal] = None
    dividend_yield: Optional[Decimal] = None
    revenue_growth: Optional[Decimal] = None
    profit_margin: Optional[Decimal] = None

    model_config = {"from_attributes": True}


# ─── K 线 ────────────────────────────────────────────

class PriceOut(BaseModel):
    date: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: int
    amount: Optional[Decimal] = None

    model_config = {"from_attributes": True}


# ─── 技术指标 ────────────────────────────────────────

class IndicatorOut(BaseModel):
    date: datetime
    indicator_name: str
    value: Decimal


# ─── 自选股 ──────────────────────────────────────────

class WatchlistCreate(BaseModel):
    name: str = "默认分组"


class WatchlistItemAdd(BaseModel):
    stock_id: int


class WatchlistOut(BaseModel):
    id: int
    name: str
    items: list[StockOut] = []

    model_config = {"from_attributes": True}


# ─── 策略 ────────────────────────────────────────────

class ConditionDef(BaseModel):
    type: str  # price_breakout / volume_surge / indicator_cross / ...
    params: dict[str, Any]


class ActionDef(BaseModel):
    type: str  # notify / webhook / sim_trade / log
    channel: Optional[str] = None  # telegram / email / dingtalk
    url: Optional[str] = None  # webhook url
    message_template: Optional[str] = None


class StrategyDef(BaseModel):
    conditions: list[ConditionDef]
    logic: str = "AND"  # AND / OR
    actions: list[ActionDef]
    cooldown_minutes: int = 15


class StrategyCreate(BaseModel):
    name: str
    description: Optional[str] = None
    definition: StrategyDef
    scan_schedule: str = "intraday"
    scan_interval: int = 300


class StrategyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    definition: Optional[StrategyDef] = None
    is_active: Optional[bool] = None
    scan_schedule: Optional[str] = None
    scan_interval: Optional[int] = None


class StrategyOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    name: str
    description: Optional[str] = None
    is_active: bool
    definition: dict
    scan_schedule: str
    scan_interval: int
    last_triggered_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StrategyTriggerOut(BaseModel):
    id: int
    strategy_id: int
    stock_id: int
    trigger_data: Optional[dict] = None
    pushed: bool
    triggered_at: datetime

    model_config = {"from_attributes": True}


# ─── 推送 ────────────────────────────────────────────

class PushPreferenceUpdate(BaseModel):
    telegram_enabled: Optional[bool] = None
    telegram_chat_id: Optional[str] = None
    email_enabled: Optional[bool] = None
    email_address: Optional[str] = None
    dingtalk_enabled: Optional[bool] = None
    dingtalk_webhook: Optional[str] = None
    feishu_enabled: Optional[bool] = None
    feishu_webhook: Optional[str] = None
    push_level: Optional[str] = None
    quiet_start: Optional[str] = None
    quiet_end: Optional[str] = None
    daily_digest: Optional[bool] = None
    weekly_digest: Optional[bool] = None


class PushPreferenceOut(BaseModel):
    telegram_enabled: bool
    email_enabled: bool
    dingtalk_enabled: bool
    feishu_enabled: bool
    websocket_enabled: bool
    push_level: str
    quiet_start: Optional[str] = None
    quiet_end: Optional[str] = None
    daily_digest: bool
    weekly_digest: bool

    model_config = {"from_attributes": True}


class PushHistoryOut(BaseModel):
    id: int
    channel: str
    title: Optional[str] = None
    body: str
    level: str
    status: str
    sent_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── 模拟账户 ────────────────────────────────────────

class AccountCreate(BaseModel):
    name: str = "默认组合"
    initial_balance: float = 1000000.0
    strategy_id: Optional[int] = None


# ─── 模拟交易 ────────────────────────────────────────

class SimTradeOut(BaseModel):
    id: int
    stock_id: int
    strategy_id: Optional[int] = None
    side: str
    quantity: int
    price: Decimal
    total: Decimal
    traded_at: datetime

    model_config = {"from_attributes": True}


# ─── 通用 ────────────────────────────────────────────

class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[Any]


class MessageResponse(BaseModel):
    message: str


# ─── AI 设置 ────────────────────────────────────────────

class AISettingsCreate(BaseModel):
    provider: str = "openai"
    model: str = "gpt-4o"
    api_key: str
    api_base: Optional[str] = None


class AISettingsOut(BaseModel):
    id: int
    provider: str
    model: str
    api_key: str  # 打码后返回
    api_base: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obj):
        data = super().model_validate(obj)
        # 打码 API Key
        if data.api_key and len(data.api_key) > 8:
            data.api_key = data.api_key[:4] + "****" + data.api_key[-4:]
        return data
