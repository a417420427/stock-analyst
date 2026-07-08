"""迁移：创建 ai_usage 表"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import create_engine, text
from app.core.config import settings


def main():
    engine = create_engine(settings.database_url_sync)
    with engine.connect() as conn:
        conn.exec_driver_sql("PRAGMA foreign_keys=OFF;")

        conn.exec_driver_sql("""
            CREATE TABLE ai_usage (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER REFERENCES users(id),
                date VARCHAR(10) NOT NULL,
                action VARCHAR(32) NOT NULL,
                count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, date, action)
            )
        """)
        conn.exec_driver_sql("CREATE INDEX ix_ai_usage_user_date ON ai_usage (user_id, date)")

        conn.exec_driver_sql("PRAGMA foreign_keys=ON;")
        conn.commit()

    print("✅ 迁移完成：已创建 ai_usage 表")


if __name__ == "__main__":
    main()
