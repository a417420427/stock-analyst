"""技术分析引擎 — 指标计算、形态识别、趋势评分"""
from decimal import Decimal
from typing import Optional

import numpy as np
import pandas as pd
from sqlalchemy import select

from app.core.database import async_session_factory
from app.models import Price, TechnicalIndicator


class AnalysisService:
    """技术分析服务"""

    @staticmethod
    def to_series(prices: list[Price]) -> pd.DataFrame:
        """将 Price ORM 列表转为 DataFrame"""
        records = []
        for p in prices:
            records.append({
                "date": p.date,
                "open": float(p.open),
                "high": float(p.high),
                "low": float(p.low),
                "close": float(p.close),
                "volume": int(p.volume),
            })
        df = pd.DataFrame(records)
        if df.empty:
            return df
        df = df.sort_values("date").reset_index(drop=True)
        return df

    # ─── 指标计算 ──────────────────────────────

    @staticmethod
    def calc_ma(df: pd.DataFrame, periods: list[int] = [5, 10, 20, 60]) -> dict:
        """移动平均线"""
        result = {}
        for p in periods:
            result[f"ma{p}"] = df["close"].rolling(window=p).mean().fillna(0).tolist()
        return result

    @staticmethod
    def calc_macd(df: pd.DataFrame) -> dict:
        """MACD"""
        close = df["close"]
        ema12 = close.ewm(span=12).mean()
        ema26 = close.ewm(span=26).mean()
        dif = ema12 - ema26
        dea = dif.ewm(span=9).mean()
        macd = 2 * (dif - dea)
        return {
            "dif": dif.fillna(0).tolist(),
            "dea": dea.fillna(0).tolist(),
            "macd": macd.fillna(0).tolist(),
        }

    @staticmethod
    def calc_rsi(df: pd.DataFrame, period: int = 14) -> list:
        """RSI"""
        close = df["close"]
        delta = close.diff()
        gain = delta.where(delta > 0, 0)
        loss = -delta.where(delta < 0, 0)
        avg_gain = gain.rolling(window=period).mean()
        avg_loss = loss.rolling(window=period).mean()
        rs = avg_gain / avg_loss.replace(0, np.nan)
        rsi = 100 - (100 / (1 + rs))
        return rsi.fillna(50).tolist()

    @staticmethod
    def calc_bollinger(df: pd.DataFrame, period: int = 20) -> dict:
        """布林带"""
        close = df["close"]
        ma = close.rolling(window=period).mean()
        std = close.rolling(window=period).std()
        upper = ma + 2 * std
        lower = ma - 2 * std
        return {
            "boll_mid": ma.fillna(0).tolist(),
            "boll_upper": upper.fillna(0).tolist(),
            "boll_lower": lower.fillna(0).tolist(),
        }

    @staticmethod
    def calc_kdj(df: pd.DataFrame, period: int = 9) -> dict:
        """KDJ"""
        low_min = df["low"].rolling(window=period).min()
        high_max = df["high"].rolling(window=period).max()
        rsv = (df["close"] - low_min) / (high_max - low_min).replace(0, np.nan) * 100
        k = rsv.ewm(com=2).mean()
        d = k.ewm(com=2).mean()
        j = 3 * k - 2 * d
        return {
            "k": k.fillna(50).tolist(),
            "d": d.fillna(50).tolist(),
            "j": j.fillna(50).tolist(),
        }

    # ─── 形态识别 ──────────────────────────────

    @staticmethod
    def detect_patterns(df: pd.DataFrame) -> list[dict]:
        """基础形态识别"""
        patterns = []
        close = df["close"].values
        high = df["high"].values
        low = df["low"].values
        vol = df["volume"].values

        n = len(close)
        if n < 20:
            return patterns

        # 双底 (简单近似: 两个相近低点, 中间一个高点)
        last_20 = close[-20:]
        min_idx = np.argmin(last_20)
        if 4 < min_idx < 16:
            left = last_20[:min_idx]
            right = last_20[min_idx:]
            if len(left) > 3 and len(right) > 3:
                left_min = np.min(left)
                right_min = np.min(right)
                mid_max = np.max(last_20[min_idx-2:min_idx+3]) if min_idx < len(last_20) else 0
                if abs(left_min - right_min) / (left_min + 1) < 0.03:
                    patterns.append({
                        "type": "double_bottom",
                        "confidence": "medium",
                        "price": float(close[-1]),
                    })

        # 头肩顶 (简化检测)
        if close[-1] < np.mean(close[-5:]) and close[-1] < close[-3]:
            peak = np.max(close[-10:])
            peak_idx = np.argmax(close[-10:])
            if 3 < peak_idx < 7:
                left_shoulder = close[-10+peak_idx-2]
                right_shoulder = close[-10+peak_idx+2] if peak_idx + 2 < 10 else close[-1]
                if left_shoulder < peak * 0.95 and right_shoulder < peak * 0.95:
                    patterns.append({
                        "type": "head_and_shoulders_top",
                        "confidence": "low",
                        "price": float(close[-1]),
                    })

        return patterns

    @staticmethod
    def trend_score(df: pd.DataFrame) -> dict:
        """多时间维度趋势一致性评分: -100 ~ +100"""
        scores = {}
        for period, label in [(5, "short"), (20, "medium"), (60, "long")]:
            if len(df) < period:
                scores[label] = 0
                continue
            values = df["close"].values[-period:]
            slope = (values[-1] - values[0]) / values[0]
            # 归一化到 -100 ~ +100
            score = max(-100, min(100, int(slope * 500)))
            scores[label] = score
        scores["composite"] = int(
            scores.get("short", 0) * 0.5 +
            scores.get("medium", 0) * 0.3 +
            scores.get("long", 0) * 0.2
        )
        return scores

    # ─── 批量计算并存储 ────────────────────────

    async def calculate_and_store(self, stock_id: int, prices: list[Price]):
        """计算全部指标并存入数据库"""
        if not prices:
            return
        df = self.to_series(prices)

        indicators = {
            **self.calc_ma(df),
            **self.calc_macd(df),
            **{"rsi14": self.calc_rsi(df)},
            **self.calc_bollinger(df),
            **self.calc_kdj(df),
        }

        async with async_session_factory() as db:
            for i, row in df.iterrows():
                for name, series in indicators.items():
                    if isinstance(series, list):
                        val = series[i] if i < len(series) else 0
                    elif isinstance(series, dict):
                        # MACD 返回 dict of list
                        for sub_name, sub_series in series.items():
                            val = sub_series[i] if i < len(sub_series) else 0
                            indicator = TechnicalIndicator(
                                stock_id=stock_id,
                                date=row["date"],
                                indicator_name=f"{name}_{sub_name}",
                                value=Decimal(str(val)),
                            )
                            db.add(indicator)
                        continue
                    else:
                        val = 0

                    if isinstance(val, (int, float, np.floating)):
                        indicator = TechnicalIndicator(
                            stock_id=stock_id,
                            date=row["date"],
                            indicator_name=name,
                            value=Decimal(str(val)),
                        )
                        db.add(indicator)
            await db.commit()
