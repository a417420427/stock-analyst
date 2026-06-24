"""AI 分析服务 — 自然语言查询、智能摘要、事件解读"""
import json
import logging
from typing import Optional

from sqlalchemy import select

from app.core.config import settings
from app.models import Stock, Price, AISettings
from app.services.analysis.service import AnalysisService

logger = logging.getLogger(__name__)


class AIService:
    """AI 增强分析服务"""

    def __init__(self):
        pass

    @staticmethod
    async def _load_ai_config(db_session=None):
        """从数据库或环境变量加载 AI 配置
        返回 (api_key, model, api_base)
        """
        ai_key = ""
        ai_model = "gpt-4o"
        ai_base = None

        if db_session:
            try:
                result = await db_session.execute(
                    select(AISettings).where(AISettings.is_active == True).limit(1)
                )
                ai_setting = result.scalar_one_or_none()
                if ai_setting and ai_setting.api_key:
                    ai_key = ai_setting.api_key
                    ai_model = ai_setting.model or "gpt-4o"
                    ai_base = ai_setting.api_base
                    logger.info(f"Using AI config: {ai_setting.provider}/{ai_model}")
                    return ai_key, ai_model, ai_base
            except Exception as e:
                logger.warning(f"Error reading AI config from DB: {e}")

        # 环境变量兜底
        if settings.openai_api_key:
            ai_key = settings.openai_api_key
            ai_model = settings.openai_model
            logger.info("Using AI config from environment")

        return ai_key, ai_model, ai_base

    @staticmethod
    def _build_stock_context(stock: Stock, prices: list[Price]) -> str:
        """构建个股上下文文本"""
        if not prices:
            return f"{stock.name}({stock.symbol}) - 暂无数据"

        latest = prices[0]
        df = AnalysisService.to_series(prices)
        analysis = AnalysisService()

        ma = analysis.calc_ma(df, periods=[5, 20])
        rsi = analysis.calc_rsi(df)
        macd = analysis.calc_macd(df)
        trend = analysis.trend_score(df)

        return f"""
## {stock.name} ({stock.symbol}) · {stock.market}
- 行业: {stock.sector or 'N/A'}
- 最新价: {latest.close}
- 涨跌幅: {(float(latest.close) - float(prices[1].close)) / float(prices[1].close) * 100:.2f}%（较昨日）
- 成交量: {latest.volume:,}
- MA5: {ma['ma5'][-1]:.2f} | MA20: {ma['ma20'][-1]:.2f}
- RSI14: {rsi[-1]:.2f}
- MACD: DIF={macd['dif'][-1]:.4f} DEA={macd['dea'][-1]:.4f}
- 趋势评分(短期/中期/长期/综合): {trend['short']}/{trend['medium']}/{trend['long']}/{trend['composite']}
- 数据条数: {len(prices)}
"""

    async def stock_summary(self, stock, prices, db_session=None):
        """生成股票多维度智能分析摘要"""
        context = self._build_stock_context(stock, prices)
        ai_key, ai_model, ai_base = await self._load_ai_config(db_session)

        if ai_key:
            logger.info(f"Calling AI model: {ai_model} at {ai_base or 'default'}")
            try:
                client_kwargs = {"api_key": ai_key}
                if ai_base:
                    client_kwargs["base_url"] = ai_base

                from openai import AsyncOpenAI
                client = AsyncOpenAI(**client_kwargs)

                resp = await client.chat.completions.create(
                    model=ai_model,
                    messages=[
                        {"role": "system", "content": "你是一个专业的股票分析师。请根据提供的个股数据，从以下维度输出中文分析摘要（JSON格式）：1. trend: 趋势判断（看涨/看跌/震荡）2. support: 支撑位 3. resistance: 阻力位 4. risk_warning: 风险提示 5. score: 综合评分 0-100 6. summary: 30字以内一句话总结"},
                        {"role": "user", "content": context},
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.3,
                )
                result = json.loads(resp.choices[0].message.content)
                logger.info(f"AI summary result: {result.get('summary', '')}")
                return result
            except Exception as e:
                logger.warning(f"AI summary call failed: {type(e).__name__}: {e}")
        else:
            logger.info("No AI key configured, using fallback rules")

        return self._fallback_summary(prices)

    @staticmethod
    def _fallback_summary(prices: list[Price]) -> dict:
        """当 AI 不可用时的规则兜底"""
        if not prices:
            return {"summary": "暂无数据", "score": 50, "trend": "unknown"}

        closes = [float(p.close) for p in prices]
        latest = closes[0]
        ma5 = sum(closes[:5]) / min(5, len(closes))
        ma20 = sum(closes[:20]) / min(20, len(closes))

        trend = "看涨" if latest > ma5 > ma20 else ("看跌" if latest < ma5 < ma20 else "震荡")
        score = 60 if trend == "看涨" else (40 if trend == "看跌" else 50)

        return {
            "trend": trend,
            "support": round(min(closes[:5]), 2),
            "resistance": round(max(closes[:5]), 2),
            "risk_warning": "AI 模式未启用，基于简单规则判断",
            "score": score,
            "summary": f"当前价格{latest:.2f}，{trend}趋势，评分{score}",
        }

    async def nl_query(self, query: str, stocks: list[Stock], db_session=None) -> str:
        """自然语言查询入口"""
        ai_key, ai_model, ai_base = await self._load_ai_config(db_session)

        if ai_key:
            try:
                stock_list = "\n".join(
                    [f"- {s.name} ({s.symbol}.{s.market})" for s in stocks[:10]]
                )
                client_kwargs = {"api_key": ai_key}
                if ai_base:
                    client_kwargs["base_url"] = ai_base

                from openai import AsyncOpenAI
                client = AsyncOpenAI(**client_kwargs)

                resp = await client.chat.completions.create(
                    model=ai_model,
                    messages=[
                        {"role": "system", "content": "你是一个股票分析助手，根据用户问题回答。"},
                        {"role": "user", "content": f"用户问题: {query}\n\n拥有的股票:\n{stock_list}"},
                    ],
                    temperature=0.5,
                )
                return resp.choices[0].message.content
            except Exception as e:
                logger.warning(f"NL query failed: {e}")

        return f"收到查询: {query}（AI 模型未配置，无法完整回答）"

    async def generate_digest(self, stocks_data: list[dict]) -> str:
        """生成每日智能简报"""
        stock_lines = "\n".join(
            [f"- {d.get('name','')}({d.get('symbol','')}): {d.get('change','')}%" for d in stocks_data]
        )

        if not settings.openai_api_key:
            return f"今日自选股摘要（AI 未配置）:\n{stock_lines}"

        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=settings.openai_api_key)

            resp = await client.chat.completions.create(
                model=settings.openai_model,
                messages=[
                    {"role": "system", "content": "生成简洁的股票市场每日简报，3-5句话。"},
                    {"role": "user", "content": f"今日自选股:\n{stock_lines}"},
                ],
                temperature=0.4,
            )
            return resp.choices[0].message.content
        except Exception as e:
            logger.warning(f"Digest generation failed: {e}")

        return f"今日自选股摘要（AI 未配置）:\n{stock_lines}"

    async def judge_condition(self, prompt: str, stock, prices: list[Price], db_session=None):
        """AI 条件判断"""
        ai_key, ai_model, ai_base = await self._load_ai_config(db_session)
        if not ai_key:
            return False, "未配置 AI API Key"

        context = self._build_stock_context(stock, prices)

        try:
            client_kwargs = {"api_key": ai_key}
            if ai_base:
                client_kwargs["base_url"] = ai_base

            from openai import AsyncOpenAI
            client = AsyncOpenAI(**client_kwargs)

            resp = await client.chat.completions.create(
                model=ai_model,
                messages=[
                    {"role": "system", "content": "你是一个股票分析助手。根据个股数据和用户的自定义条件，判断是否触发。必须以JSON格式回答：{\"triggered\": true/false, \"reason\": \"简短理由\"}"},
                    {"role": "user", "content": f"## 股票数据\n{context}\n\n## 自定义判断条件\n{prompt}\n\n请判断条件是否满足，以JSON返回。"},
                ],
                temperature=0.3,
                response_format={"type": "json_object"},
            )
            result = json.loads(resp.choices[0].message.content)
            return result.get("triggered", False), result.get("reason", "")
        except Exception as e:
            logger.error(f"AI judge failed: {e}")
            return False, f"AI判断失败: {e}"
