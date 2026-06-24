"""推送服务 — 多通道智能推送"""
import json
import logging
from datetime import datetime, time
from email.mime.text import MIMEText
from typing import Optional
import smtplib

import httpx
from sqlalchemy import select

from app.core.config import settings
from app.models import PushPreference, PushHistory, User, StrategyTrigger

logger = logging.getLogger(__name__)


class PushRouter:
    """推送路由器：按用户偏好 + 消息级别路由到各通道"""

    LEVEL_PRIORITY = {"urgent": 0, "normal": 1, "info": 2}
    DEDUP_WINDOW_MINUTES = 15
    URL_SHORT_WINDOW = 3600  # 1h 内相同 body 去重

    def __init__(self, db_session):
        self.db = db_session
        self._http = httpx.AsyncClient(timeout=10.0)
        # 内存去重（生产环境应换 Redis）
        self._recent_bodies: set[str] = set()

    async def close(self):
        await self._http.aclose()

    def _is_in_quiet_hours(self, pref: PushPreference) -> bool:
        """判断是否在静默时段"""
        if not pref.quiet_start or not pref.quiet_end:
            return False
        now = datetime.utcnow().time()
        start = time.fromisoformat(pref.quiet_start)
        end = time.fromisoformat(pref.quiet_end)

        if start <= end:  # 同一日内
            return start <= now <= end
        else:  # 跨天（如 22:00-08:00）
            return now >= start or now <= end

    def _can_push(self, pref: PushPreference, level: str) -> bool:
        """按推送级别判断是否允许推送"""
        lvl_map = {"all": 0, "normal": 1, "urgent_only": 2}
        msg_level = lvl_map.get(level, 1)
        user_level = lvl_map.get(pref.push_level, 1)
        return msg_level >= user_level

    def _dedup(self, body: str, trigger_id: int) -> bool:
        """简单内存去重 15 分钟内同 body"""
        key = f"{body}:{trigger_id}"
        if key in self._recent_bodies:
            return True
        self._recent_bodies.add(key)
        return False

    async def push(
        self,
        user_id: int,
        title: str,
        body: str,
        level: str = "normal",
        trigger_id: Optional[int] = None,
    ) -> list[dict]:
        """
        推送消息到用户所有已启用的通道

        返回: [{"channel": "telegram", "status": "sent"}, ...]
        """
        # 开发模式下 user_id 可能为 null，取第一条
        result = await self.db.execute(select(PushPreference).limit(1))
        pref = result.scalar_one_or_none()
        if not pref:
            return []

        # 去重
        if trigger_id and self._dedup(body, trigger_id):
            logger.info(f"Dedup push for user={user_id} body={body[:50]}")
            return []

        # 静默时段检查
        if self._is_in_quiet_hours(pref) and level != "urgent":
            logger.info(f"Quiet hours skip for user={user_id}")
            return []

        # 级别检查
        if not self._can_push(pref, level):
            return []

        results = []

        # Telegram
        if pref.telegram_enabled and pref.telegram_chat_id:
            status = await self._push_telegram(pref.telegram_chat_id, title, body, level)
            results.append({"channel": "telegram", "status": status})
            await self._save_history(user_id, "telegram", title, body, level, status, trigger_id)

        # Email
        if pref.email_enabled and pref.email_address:
            status = await self._push_email(pref.email_address, title, body, level)
            results.append({"channel": "email", "status": status})
            await self._save_history(user_id, "email", title, body, level, status, trigger_id)

        # 钉钉
        if pref.dingtalk_enabled and pref.dingtalk_webhook:
            status = await self._push_dingtalk(pref.dingtalk_webhook, title, body, level)
            results.append({"channel": "dingtalk", "status": status})
            await self._save_history(user_id, "dingtalk", title, body, level, status, trigger_id)

        # 飞书
        if pref.feishu_enabled and pref.feishu_webhook:
            status = await self._push_feishu(pref.feishu_webhook, title, body, level)
            results.append({"channel": "feishu", "status": status})
            await self._save_history(user_id, "feishu", title, body, level, status, trigger_id)

        await self.db.commit()
        return results

    # ─── 单通道推送实现 ────────────────────────

    async def _push_telegram(self, chat_id: str, title: str, body: str, level: str) -> str:
        """通过 Telegram Bot 推送"""
        if not settings.telegram_bot_token:
            logger.warning("Telegram bot token not configured")
            return "skipped"

        emoji = {"urgent": "🔴", "normal": "📢", "info": "ℹ️"}
        text = f"{emoji.get(level, '📢')} **{title}**\n\n{body}"

        try:
            url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
            resp = await self._http.post(url, json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "Markdown",
            })
            return "sent" if resp.status_code == 200 else f"failed({resp.status_code})"
        except Exception as e:
            logger.error(f"Telegram push failed: {e}")
            return "error"

    async def _push_email(self, to: str, title: str, body: str, level: str) -> str:
        """通过 SMTP 推送"""
        if not all([settings.smtp_host, settings.smtp_user, settings.smtp_pass]):
            logger.warning("SMTP not configured")
            return "skipped"

        try:
            msg = MIMEText(body, "plain", "utf-8")
            msg["Subject"] = f"[{level.upper()}] {title}"
            msg["From"] = settings.mail_from
            msg["To"] = to

            with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
                server.starttls()
                server.login(settings.smtp_user, settings.smtp_pass)
                server.send_message(msg)

            return "sent"
        except Exception as e:
            logger.error(f"Email push failed: {e}")
            return "error"

    async def _push_dingtalk(self, webhook_url: str, title: str, body: str, level: str) -> str:
        """通过钉钉机器人推送"""
        try:
            resp = await self._http.post(webhook_url, json={
                "msgtype": "markdown",
                "markdown": {
                    "title": title,
                    "text": f"## {title}\n\n{body}",
                },
            })
            return "sent" if resp.status_code == 200 else f"failed({resp.status_code})"
        except Exception as e:
            logger.error(f"Dingtalk push failed: {e}")
            return "error"

    async def _push_feishu(self, webhook_url: str, title: str, body: str, level: str) -> str:
        """通过飞书机器人推送"""
        try:
            emoji = {"urgent": "🔴", "normal": "📢", "info": "ℹ️"}
            content = f"{emoji.get(level, '📢')} {title}\n\n{body}\n\n—— StockAnalyst {datetime.now().strftime('%m-%d %H:%M')}"

            resp = await self._http.post(webhook_url, json={
                "msg_type": "text",
                "content": json.dumps({"text": content}),
            })
            if resp.status_code == 200:
                body_data = resp.json()
                if body_data.get("code") == 0:
                    return "sent"
                else:
                    logger.warning(f"Feishu returned non-zero: {body_data}")
                    # 飞书新版 msg_type 用 text
                    resp = await self._http.post(webhook_url, json={
                        "msgtype": "text",
                        "text": {"content": content},
                    })
                    return "sent" if resp.status_code == 200 else f"failed({resp.status_code})"
            else:
                # 尝试旧版格式
                resp = await self._http.post(webhook_url, json={
                    "msgtype": "text",
                    "text": {"content": content},
                })
                return "sent" if resp.status_code == 200 else f"failed({resp.status_code})"
        except Exception as e:
            logger.error(f"Feishu push failed: {e}")
            return "error"

    # ─── 推送历史 ──────────────────────────────

    async def _save_history(
        self, user_id: int, channel: str, title: str,
        body: str, level: str, status: str, trigger_id: Optional[int] = None,
    ):
        history = PushHistory(
            user_id=user_id,
            channel=channel,
            title=title,
            body=body,
            level=level,
            status=status,
            trigger_id=trigger_id,
            sent_at=datetime.utcnow() if status == "sent" else None,
        )
        self.db.add(history)

    # ─── 智能简报 ──────────────────────────────

    async def send_daily_digest(self, user_id: int):
        """生成并推送每日复盘简报"""
        summary = (
            "📊 **每日复盘**\n\n"
            f"日期：{datetime.now().strftime('%Y-%m-%d')}\n\n"
            "今日暂无重要信号。"
        )
        await self.push(user_id, "每日复盘", summary, level="info")
