"""SQLAlchemy ORM 模型"""
from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean, Column, DateTime, DECIMAL, Enum, ForeignKey, Integer,
    JSON, String, Text, Float, BigInteger, UniqueConstraint, Index,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    email = Column(String(128), unique=True, nullable=True)
    hashed_password = Column(String(256), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    watchlists = relationship("Watchlist", back_populates="user")
    strategies = relationship("Strategy", back_populates="user")
    push_prefs = relationship("PushPreference", back_populates="user", uselist=False)


# ─── 股票 / 行情 ─────────────────────────────────────

class Stock(Base):
    """统一股票主数据表——跨市场"""
    __tablename__ = "stocks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(16), nullable=False)  # eg. 600519 / 00700 / AAPL
    market = Column(String(4), nullable=False)    # A / HK / US
    name = Column(String(128), nullable=False)
    name_en = Column(String(128), nullable=True)
    sector = Column(String(64), nullable=True)
    industry = Column(String(64), nullable=True)
    is_active = Column(Boolean, default=True)
    listed_date = Column(DateTime, nullable=True)
    # 基本面
    pe_ttm = Column(DECIMAL(12, 4), nullable=True)
    pb = Column(DECIMAL(12, 4), nullable=True)
    market_cap = Column(DECIMAL(20, 4), nullable=True)
    dividend_yield = Column(DECIMAL(8, 4), nullable=True)
    revenue_growth = Column(DECIMAL(8, 4), nullable=True)
    profit_margin = Column(DECIMAL(8, 4), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("symbol", "market", name="uq_stock_symbol_market"),
        Index("ix_stock_market", "market"),
    )

    prices = relationship("Price", back_populates="stock", lazy="dynamic")


class Price(Base):
    """日 K 线数据"""
    __tablename__ = "prices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False, index=True)
    date = Column(DateTime, nullable=False, index=True)
    open = Column(DECIMAL(12, 4), nullable=False)
    high = Column(DECIMAL(12, 4), nullable=False)
    low = Column(DECIMAL(12, 4), nullable=False)
    close = Column(DECIMAL(12, 4), nullable=False)
    volume = Column(BigInteger, nullable=False)
    amount = Column(DECIMAL(16, 2), nullable=True)  # 成交额
    adj_factor = Column(DECIMAL(10, 6), nullable=True)

    stock = relationship("Stock", back_populates="prices")

    __table_args__ = (
        UniqueConstraint("stock_id", "date", name="uq_price_stock_date"),
        Index("ix_price_date_desc", "date", "stock_id"),
    )


class MinutePrice(Base):
    """分钟级 K 线"""
    __tablename__ = "minute_prices"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False, index=True)
    time = Column(DateTime, nullable=False, index=True)
    open = Column(DECIMAL(12, 4), nullable=False)
    high = Column(DECIMAL(12, 4), nullable=False)
    low = Column(DECIMAL(12, 4), nullable=False)
    close = Column(DECIMAL(12, 4), nullable=False)
    volume = Column(BigInteger, nullable=False)
    interval = Column(String(4), nullable=False, default="5m")  # 1m / 5m / 15m / 30m / 60m

    __table_args__ = (
        UniqueConstraint("stock_id", "time", "interval", name="uq_minute_stock_time_interval"),
    )


# ─── 自选股 ─────────────────────────────────────────

class Watchlist(Base):
    __tablename__ = "watchlists"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String(64), default="默认分组")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="watchlists")
    items = relationship("WatchlistItem", back_populates="watchlist", cascade="all, delete-orphan")


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    watchlist_id = Column(Integer, ForeignKey("watchlists.id"), nullable=False, index=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False)
    added_at = Column(DateTime, default=datetime.utcnow)

    watchlist = relationship("Watchlist", back_populates="items")
    stock = relationship("Stock")


# ─── 技术指标 ───────────────────────────────────────

class TechnicalIndicator(Base):
    """预计算的技术指标"""
    __tablename__ = "technical_indicators"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False, index=True)
    date = Column(DateTime, nullable=False, index=True)
    indicator_name = Column(String(32), nullable=False)  # ma5, ma20, macd, rsi14, boll_upper...
    value = Column(DECIMAL(16, 6), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_tech_indicator_lookup", "stock_id", "indicator_name", "date"),
    )


# ─── 策略 ────────────────────────────────────────────

class Strategy(Base):
    """用户自定义策略"""
    __tablename__ = "strategies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

    # 策略定义体 (JSON)
    # {
    #   "conditions": [{ "type": "price_breakout", "params": {"threshold": 10.0, "direction": "above"} }],
    #   "logic": "AND",
    #   "actions": [{"type": "notify", "channel": "telegram"}, {"type": "webhook", "url": "..."}],
    #   "cooldown_minutes": 15
    # }
    definition = Column(JSON, nullable=False)

    # 扫描配置
    scan_schedule = Column(String(32), default="intraday")  # pre_market / intraday / post_market / daily
    scan_interval = Column(Integer, default=300)  # 秒
    last_triggered_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="strategies")
    triggers = relationship("StrategyTrigger", back_populates="strategy", cascade="all, delete-orphan")
    account = relationship("SimulatedAccount", back_populates="strategy", uselist=False)

    __table_args__ = (
        Index("ix_strategy_user_active", "user_id", "is_active"),
    )


class StrategyTemplate(Base):
    """内置策略模板"""
    __tablename__ = "strategy_templates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(128), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    category = Column(String(32), nullable=False)  # trend / momentum / mean_reversion / arbitrage
    definition = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class StrategyTrigger(Base):
    """策略触发记录"""
    __tablename__ = "strategy_triggers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    strategy_id = Column(Integer, ForeignKey("strategies.id"), nullable=False, index=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False)
    trigger_data = Column(JSON, nullable=True)  # 触发时的快照数据
    pushed = Column(Boolean, default=False)
    pushed_channels = Column(JSON, default=list)
    triggered_at = Column(DateTime, default=datetime.utcnow)

    strategy = relationship("Strategy", back_populates="triggers")
    stock = relationship("Stock")


# ─── 推送 ────────────────────────────────────────────

class PushPreference(Base):
    """用户推送偏好"""
    __tablename__ = "push_preferences"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=True, index=True)

    # 通道启用状态
    telegram_enabled = Column(Boolean, default=False)
    telegram_chat_id = Column(String(64), nullable=True)
    email_enabled = Column(Boolean, default=False)
    email_address = Column(String(128), nullable=True)
    dingtalk_enabled = Column(Boolean, default=False)
    dingtalk_webhook = Column(String(256), nullable=True)
    feishu_enabled = Column(Boolean, default=False)
    feishu_webhook = Column(String(256), nullable=True)
    websocket_enabled = Column(Boolean, default=True)

    # 推送级别
    push_level = Column(String(8), default="normal")  # all / normal / urgent_only

    # 静默时段 (例: 22:00-08:00)
    quiet_start = Column(String(5), nullable=True)
    quiet_end = Column(String(5), nullable=True)

    # 简报订阅
    daily_digest = Column(Boolean, default=True)
    weekly_digest = Column(Boolean, default=True)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="push_prefs")


class PushHistory(Base):
    """推送历史"""
    __tablename__ = "push_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    channel = Column(String(32), nullable=False)
    title = Column(String(256), nullable=True)
    body = Column(Text, nullable=False)
    level = Column(String(8), nullable=False, default="normal")  # urgent / normal / info
    status = Column(String(16), default="pending")  # pending / sent / failed
    error_msg = Column(Text, nullable=True)
    trigger_id = Column(BigInteger, ForeignKey("strategy_triggers.id"), nullable=True)
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_push_history_user_time", "user_id", "created_at"),
    )


# ─── 模拟交易 ────────────────────────────────────────

class SimulatedAccount(Base):
    """模拟账户 -- 每个账户对应一个策略组合"""
    __tablename__ = "simulated_accounts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String(64), nullable=False, default="默认组合")
    strategy_id = Column(Integer, ForeignKey("strategies.id"), nullable=True)
    initial_balance = Column(DECIMAL(16, 2), nullable=False, default=1000000.00)
    available_balance = Column(DECIMAL(16, 2), nullable=False, default=1000000.00)
    frozen_balance = Column(DECIMAL(16, 2), nullable=False, default=0.00)
    commission_rate = Column(DECIMAL(8, 6), nullable=False, default=0.00015)
    slippage = Column(DECIMAL(8, 6), nullable=False, default=0.001)
    is_active = Column(Boolean, default=True)
    is_ai_generated = Column(Boolean, default=False)  # AI 选股创建
    ai_prompt = Column(Text, nullable=True)  # AI 选股时的用户描述
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    strategy = relationship("Strategy", back_populates="account")


class Financial(Base):
    """季度财务数据"""
    __tablename__ = "financials"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False, index=True)
    quarter = Column(String(8), nullable=False)
    revenue = Column(DECIMAL(20, 4), nullable=True)
    net_profit = Column(DECIMAL(20, 4), nullable=True)
    eps = Column(DECIMAL(12, 4), nullable=True)
    roe = Column(DECIMAL(8, 4), nullable=True)
    gross_margin = Column(DECIMAL(8, 4), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("stock_id", "quarter", name="uq_financial_stock_quarter"),
    )


class SimulatedTrade(Base):
    """模拟交易记录"""
    __tablename__ = "simulated_trades"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    account_id = Column(Integer, ForeignKey("simulated_accounts.id"), nullable=True, index=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), nullable=False)
    strategy_id = Column(Integer, ForeignKey("strategies.id"), nullable=True)
    side = Column(String(4), nullable=False)
    quantity = Column(Integer, nullable=False)
    price = Column(DECIMAL(12, 4), nullable=False)
    total = Column(DECIMAL(16, 2), nullable=False)
    commission = Column(DECIMAL(12, 4), nullable=False, default=0.00)
    order_type = Column(String(16), nullable=False, default="market")
    traded_at = Column(DateTime, default=datetime.utcnow)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ─── AI 设置 ──────────────────────────────────────────

class AISettings(Base):
    """AI 模型配置（API Key 等）"""
    __tablename__ = "ai_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    provider = Column(String(32), nullable=False, default="openai")  # openai / deepseek / together
    model = Column(String(64), nullable=False, default="gpt-4o")
    api_key = Column(String(256), nullable=False)  # 明文存储（开发环境）
    api_base = Column(String(256), nullable=True)  # 自定义 API 地址
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
