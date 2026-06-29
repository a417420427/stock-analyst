#!/bin/bash
# 确保后端 uvicorn 运行，没跑就启动
if ! curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo 后端未运行，启动中...
    cd /root/workspace/stock-analyst/backend
    nohup python3.11 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > /tmp/uvicorn.log 2>&1 &
    sleep 3
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        echo ✅ 后端已启动
    else
        echo ❌ 后端启动失败，查看日志: cat /tmp/uvicorn.log
    fi
else
    echo ✅ 后端运行中
fi
