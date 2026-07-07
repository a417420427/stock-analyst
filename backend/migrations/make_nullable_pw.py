"""迁移：将 users.hashed_password 改为 nullable

背景：
- WeChat 小程序用户通过 openid 登录，不需要密码
- 之前会用 openid[:72] 做 bcrypt 密码，实属浪费
- bcrypt>=5.0.0 破坏了 passlib 兼容性，再哈希 openid 反而报错

执行：python3 migrations/make_nullable_pw.py
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import create_engine, text
from app.core.config import settings


def main():
    engine = create_engine(settings.database_url_sync)
    with engine.connect() as conn:
        # SQLite 不支持 ALTER COLUMN, 需要重建表
        conn.exec_driver_sql("PRAGMA foreign_keys=OFF;")

        # 1. 把已有 WeChat 用户的 hashed_password 置为 NULL (写死一个标记)
        conn.execute(text("""
            UPDATE users
            SET hashed_password = NULL
            WHERE openid IS NOT NULL
              AND hashed_password IS NOT NULL
        """))

        # 2. 建新表（带 nullable 的 hashed_password）
        conn.exec_driver_sql("""
            CREATE TABLE users_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username VARCHAR(64) NOT NULL UNIQUE,
                email VARCHAR(128) UNIQUE,
                hashed_password VARCHAR(256),
                openid VARCHAR(128) UNIQUE,
                phone VARCHAR(16),
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 3. 迁移数据
        conn.exec_driver_sql("""
            INSERT INTO users_new
            SELECT id, username, email, hashed_password, openid, phone,
                   is_active, created_at, updated_at
            FROM users
        """)

        # 4. 切换表
        conn.exec_driver_sql("DROP TABLE users")
        conn.exec_driver_sql("ALTER TABLE users_new RENAME TO users")

        # 5. 重建索引
        conn.exec_driver_sql("CREATE UNIQUE INDEX ix_users_username ON users (username)")
        conn.exec_driver_sql("CREATE INDEX ix_users_openid ON users (openid)")

        conn.exec_driver_sql("PRAGMA foreign_keys=ON;")
        conn.commit()

    print("✅ 迁移完成：users.hashed_password 已改为 nullable")


if __name__ == "__main__":
    main()
