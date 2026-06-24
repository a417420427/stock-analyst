"""策略引擎 — 条件评估、触发执行、冷却控制"""
import json
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Optional

import numpy as np
import pandas as pd
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Strategy, StrategyTrigger, Stock, Price, WatchlistItem
from app.services.analysis import AnalysisService

logger = logging.getLogger(__name__)


class StrategyEngine:
    """策略引擎：评估条件、执行动作"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._analysis = AnalysisService()

    # ─── 条件评估器 ────────────────────────────

    async def evaluate_condition(
        self, condition: dict, stock_id: int
    ) -> tuple[bool, Optional[dict]]:
        """
        评估单条条件

        返回值: (是否触发, 触发快照数据)
        """
        cond_type = condition.get("type")
        params = condition.get("params", {})
        lookback = params.get("lookback", 60)

        # 获取价格数据
        result = await self.db.execute(
            select(Price)
            .where(Price.stock_id == stock_id)
            .order_by(Price.date.desc())
            .limit(lookback)
        )
        prices = list(result.scalars().all())
        if not prices:
            return False, None

        prices.reverse()
        df = self._analysis.to_series(prices)
        current_price = float(prices[-1].close)

        snapshot = {
            "price": current_price,
            "volume": int(prices[-1].volume),
            "timestamp": datetime.utcnow().isoformat(),
        }

        try:
            if cond_type == "price_above":
                threshold = float(params.get("threshold", 0))
                return current_price > threshold, snapshot

            elif cond_type == "price_below":
                threshold = float(params.get("threshold", 0))
                return current_price < threshold, snapshot

            elif cond_type == "price_change_pct":
                """涨跌幅超过阈值"""
                days = int(params.get("days", 1))
                if len(prices) <= days:
                    return False, None
                prev_close = float(prices[-1 - days].close)
                change_pct = (current_price - prev_close) / prev_close * 100
                direction = params.get("direction", "above")
                threshold = float(params.get("threshold", 5))
                snapshot["change_pct"] = round(change_pct, 2)
                if direction == "above":
                    return change_pct >= threshold, snapshot
                else:
                    return change_pct <= -threshold, snapshot

            elif cond_type == "volume_surge":
                """成交量异常放大"""
                volumes = [float(p.volume) for p in prices]
                if len(volumes) < 5:
                    return False, None
                avg_vol = float(np.mean(volumes[:-1]))
                ratio = float(params.get("ratio", 2.0))
                snapshot["volume_ratio"] = round(volumes[-1] / avg_vol, 2) if avg_vol > 0 else 1
                return volumes[-1] > avg_vol * ratio, snapshot

            elif cond_type == "ma_cross":
                """均线交叉：短期均线上穿/下穿长期均线"""
                fast = int(params.get("fast_period", 5))
                slow = int(params.get("slow_period", 20))
                direction = params.get("direction", "golden")  # golden=金叉, dead=死叉

                if len(df) < slow + 1:
                    return False, None

                ma_fast = df["close"].rolling(window=fast).mean().values
                ma_slow = df["close"].rolling(window=slow).mean().values

                if direction == "golden":
                    # 金叉：短期从下方上穿长期
                    triggered = ma_fast[-2] <= ma_slow[-2] and ma_fast[-1] > ma_slow[-1]
                else:
                    # 死叉：短期从上方下穿长期
                    triggered = ma_fast[-2] >= ma_slow[-2] and ma_fast[-1] < ma_slow[-1]

                if triggered:
                    snapshot["ma_fast"] = round(float(ma_fast[-1]), 2)
                    snapshot["ma_slow"] = round(float(ma_slow[-1]), 2)
                return triggered, snapshot

            elif cond_type == "macd_cross":
                """MACD 金叉/死叉"""
                direction = params.get("direction", "golden")
                macd = self._analysis.calc_macd(df)
                dif = np.array(macd["dif"])
                dea = np.array(macd["dea"])

                if len(dif) < 3:
                    return False, None

                if direction == "golden":
                    triggered = dif[-2] <= dea[-2] and dif[-1] > dea[-1]
                else:
                    triggered = dif[-2] >= dea[-2] and dif[-1] < dea[-1]

                if triggered:
                    snapshot["dif"] = round(float(dif[-1]), 4)
                    snapshot["dea"] = round(float(dea[-1]), 4)
                return triggered, snapshot

            elif cond_type == "rsi_threshold":
                """RSI 超买/超卖"""
                direction = params.get("direction", "oversold")  # oversold=超卖, overbought=超买
                threshold = float(params.get("threshold", 30))
                rsi = np.array(self._analysis.calc_rsi(df))

                if len(rsi) < 2:
                    return False, None

                if direction == "oversold":
                    triggered = rsi[-2] <= threshold and rsi[-1] > threshold  # 从超卖回升
                else:
                    triggered = rsi[-2] >= (100 - threshold) and rsi[-1] < (100 - threshold)  # 从超买回落

                snapshot["rsi"] = round(float(rsi[-1]), 2)
                return triggered, snapshot

            elif cond_type == "bollinger_break":
                """布林带突破"""
                direction = params.get("direction", "upper")  # upper=突破上轨, lower=跌破下轨
                boll = self._analysis.calc_bollinger(df)
                upper = np.array(boll["boll_upper"])
                lower = np.array(boll["boll_lower"])
                mid = np.array(boll["boll_mid"])

                if len(upper) < 2:
                    return False, None

                close = df["close"].values
                if direction == "upper":
                    triggered = close[-2] <= upper[-2] and close[-1] > upper[-1]
                else:
                    triggered = close[-2] >= lower[-2] and close[-1] < lower[-1]

                if triggered:
                    snapshot["boll_upper"] = round(float(upper[-1]), 2)
                    snapshot["boll_lower"] = round(float(lower[-1]), 2)
                    snapshot["boll_mid"] = round(float(mid[-1]), 2)
                return triggered, snapshot

            elif cond_type == "trend_score":
                """趋势评分超过阈值"""
                score = self._analysis.trend_score(df)
                composite = score.get("composite", 0)
                direction = params.get("direction", "above")
                threshold = int(params.get("threshold", 60))
                snapshot["trend"] = score
                if direction == "above":
                    return composite >= threshold, snapshot
                else:
                    return composite <= -threshold, snapshot

            elif cond_type == "always":
                return True, snapshot

            elif cond_type == "ai_judge":
                """AI 自定义条件判断"""
                prompt = params.get("prompt", "")
                if not prompt:
                    return False, snapshot

                from app.services.ai import AIService
                ai_svc = AIService()
                triggered, reason = await ai_svc.judge_condition(
                    prompt, None, prices, db_session=self.db
                )
                if reason:
                    snapshot["ai_reason"] = reason
                return triggered, snapshot

        except Exception as e:
            logger.error(f"Evaluate condition error: {cond_type} -> {e}")
            return False, None

        return False, None

    # ─── 策略扫描 ──────────────────────────────

    async def scan_strategy(self, strategy: Strategy) -> list[StrategyTrigger]:
        """扫描单个策略，返回新触发的记录"""
        definition = strategy.definition
        conditions = definition.get("conditions", [])
        logic = definition.get("logic", "AND")
        cooldown_minutes = definition.get("cooldown_minutes", 15)
        stock_filter = definition.get("stock_ids", [])  # 可选：指定要监控的股票

        # 冷却检查
        if strategy.last_triggered_at:
            cooldown_end = strategy.last_triggered_at + timedelta(minutes=cooldown_minutes)
            if datetime.utcnow() < cooldown_end:
                return []

        # 获取要扫描的股票
        if stock_filter:
            stock_ids = stock_filter
        else:
            # 默认扫描用户自选股
            result = await self.db.execute(
                select(WatchlistItem).join(WatchlistItem.watchlist)
                .where(WatchlistItem.watchlist.has(user_id=strategy.user_id))
            )
            watchlist_items = list(result.scalars().all())
            stock_ids = list(set(item.stock_id for item in watchlist_items))

        if not stock_ids:
            return []

        triggers = []
        for stock_id in stock_ids:
            results = []
            snapshots = []
            for condition in conditions:
                triggered, snapshot = await self.evaluate_condition(condition, stock_id)
                results.append(triggered)
                snapshots.append(snapshot)

            final = all(results) if logic == "AND" else any(results)

            if final:
                trigger_data = {
                    "stock_id": stock_id,
                    "conditions_summary": [
                        {"type": c.get("type"), "triggered": r}
                        for c, r in zip(conditions, results)
                    ],
                    "snapshots": snapshots,
                }
                trigger = StrategyTrigger(
                    strategy_id=strategy.id,
                    stock_id=stock_id,
                    trigger_data=trigger_data,
                )
                self.db.add(trigger)
                triggers.append(trigger)

        if triggers:
            strategy.last_triggered_at = datetime.utcnow()
            await self.db.flush()

        return triggers

    # ─── 扫描全部策略 ─────────────────────────

    async def scan_all_active(self) -> list[StrategyTrigger]:
        """扫描所有活跃策略"""
        result = await self.db.execute(
            select(Strategy).where(Strategy.is_active == True)
        )
        strategies = list(result.scalars().all())

        all_triggers = []
        for strategy in strategies:
            try:
                triggers = await self.scan_strategy(strategy)
                all_triggers.extend(triggers)
            except Exception as e:
                logger.error(f"Scan strategy {strategy.id} failed: {e}")

        await self.db.commit()
        return all_triggers

    # ─── 执行策略动作 ──────────────────────────

    async def execute_actions(self, trigger: StrategyTrigger):
        """执行策略定义的动作"""
        result = await self.db.execute(
            select(Strategy).where(Strategy.id == trigger.strategy_id)
        )
        strategy = result.scalar_one_or_none()
        if not strategy:
            return

        actions = strategy.definition.get("actions", [])

        for action in actions:
            channel = action.get("channel")
            trigger.pushed = True
            if channel:
                pushed_channels = trigger.pushed_channels or []
                if channel not in pushed_channels:
                    pushed_channels.append(channel)
                trigger.pushed_channels = pushed_channels

            if action.get("type") == "log":
                logger.info(
                    f"[Strategy Trigger] strategy={strategy.name} "
                    f"trigger={trigger.id} data={json.dumps(trigger.trigger_data or {}, default=str)}"
                )
