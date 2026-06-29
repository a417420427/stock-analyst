#!/bin/bash
# Daily update script - runs after market close

PROJECT=/root/workspace/stock-analyst
LOG_DIR=/tmp
DATE_TAG=$(date '+%Y%m%d_%H%M')

echo "[$(date)] Daily Update Start"

echo "[$(date)] Step 1: Sync prices..."
cd $PROJECT && python3.11 -u scripts/sync_prices_daily.py > $LOG_DIR/daily_prices_$DATE_TAG.log 2>&1
tail -3 $LOG_DIR/daily_prices_$DATE_TAG.log

echo "[$(date)] Step 2: Sync fundamentals..."
cd $PROJECT && python3.11 -u scripts/sync_fundamentals.py > $LOG_DIR/daily_fund_$DATE_TAG.log 2>&1
tail -3 $LOG_DIR/daily_fund_$DATE_TAG.log

echo "[$(date)] Step 3: Restart backend..."
OLD_PID=$(ps aux | grep 'uvicorn.*app.main' | grep -v grep | awk '{print $2}')
if [ -n "$OLD_PID" ]; then
    kill $OLD_PID 2>/dev/null
    sleep 2
fi
cd $PROJECT/backend && nohup python3.11 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 > /tmp/uvicorn.log 2>&1 &
sleep 3
curl -s http://localhost:8000/health

echo "[$(date)] Daily Update Complete"
