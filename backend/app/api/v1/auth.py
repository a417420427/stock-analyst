"""认证相关 API"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
import httpx

from app.core.database import get_db
from app.models import User
from app.schemas import Token, UserCreate, UserLogin, UserOut

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = int(payload.get("sub"))
    except Exception:
        raise HTTPException(status_code=401, detail="无效的令牌")

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user


@router.post("/register", response_model=UserOut)
async def register(body: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == body.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="用户名已存在")

    user = User(
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.post("/login", response_model=Token)
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    token = create_access_token({"sub": str(user.id), "username": user.username})
    return Token(access_token=token)


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user


@router.post("/wx-login")
async def wx_login(code: str, db: AsyncSession = Depends(get_db)):
    """微信小程序登录"""
    # 通过 code 换取 openid
    wx_appid = settings.wx_appid
    wx_secret = settings.wx_secret
    openid = None
    if wx_appid and wx_secret:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://api.weixin.qq.com/sns/jscode2session",
                    params={
                        "appid": wx_appid,
                        "secret": wx_secret,
                        "js_code": code,
                        "grant_type": "authorization_code",
                    }
                )
                data = resp.json()
                if "errcode" not in data or data["errcode"] == 0:
                    openid = data.get("openid")
        except Exception:
            pass
    if not openid:
        # 开发/测试模式：模拟 openid
        openid = f"mock_openid_{code[:16]}"

    # 查找或创建用户
    result = await db.execute(select(User).where(User.openid == openid))
    user = result.scalar_one_or_none()
    if not user:
        # 创建新用户
        user = User(
            username=f"wx_{openid[:12]}",
            hashed_password=hash_password(openid),  # 用 openid 做密码
            openid=openid,
        )
        db.add(user)
        await db.flush()

    token = create_access_token({"sub": str(user.id), "username": user.username})
    has_phone = bool(user.phone)
    return {
        "access_token": token,
        "user": {"id": user.id, "username": user.username, "phone": user.phone},
        "is_new": not has_phone,
        "has_phone": has_phone,
    }


# ─── 短信验证码 ─────────────────────────────────────

# 内存验证码存储（生产环境应换 Redis）
_verify_codes: dict[str, dict] = {}


def _generate_code() -> str:
    import random
    return str(random.randint(100000, 999999))


async def _send_sms(phone: str, code: str) -> bool:
    """通过阿里云短信发送验证码"""
    if not settings.aliyun_access_key_id or not settings.aliyun_access_key_secret:
        return False

    try:
        from alibabacloud_dysmsapi20170525.client import Client as DysmsapiClient
        from alibabacloud_dysmsapi20170525 import models as dysmsapi_models
        from alibabacloud_tea_openapi import models as open_api_models

        config = open_api_models.Config(
            access_key_id=settings.aliyun_access_key_id,
            access_key_secret=settings.aliyun_access_key_secret,
        )
        config.endpoint = "dysmsapi.aliyuncs.com"
        client = DysmsapiClient(config)

        req = dysmsapi_models.SendSmsRequest(
            phone_numbers=phone,
            sign_name=settings.sms_sign_name,
            template_code=settings.sms_template_code,
            template_param=f'{{"code":"{code}","min":"5"}}',
        )
        resp = await client.send_sms_async(req)
        return resp.body.code == "OK"
    except Exception as e:
        print(f"[SMS] 发送失败: {e}")
        return False


@router.post("/send-code")
async def send_code(
    phone: str,
    user: User = Depends(get_current_user),
):
    """发送短信验证码"""
    code = _generate_code()
    _verify_codes[phone] = {"code": code, "expire": datetime.utcnow() + timedelta(minutes=5)}

    sent = await _send_sms(phone, code)
    if not sent:
        # 开发/测试环境：直接返回验证码方便调试
        return {"message": "验证码已发送（测试模式）", "debug_code": code}

    return {"message": "验证码已发送"}


@router.post("/bind-phone")
async def bind_phone(
    phone: str,
    code: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """验证验证码并绑定手机号"""
    stored = _verify_codes.get(phone)
    if not stored:
        raise HTTPException(status_code=400, detail="请先获取验证码")
    if stored["code"] != code:
        raise HTTPException(status_code=400, detail="验证码错误")
    if stored["expire"] < datetime.utcnow():
        raise HTTPException(status_code=400, detail="验证码已过期")

    # 检查手机号是否已被其他用户绑定
    result = await db.execute(select(User).where(User.phone == phone))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该手机号已被绑定")

    user.phone = phone
    await db.flush()
    return {"message": "绑定成功", "phone": phone}
