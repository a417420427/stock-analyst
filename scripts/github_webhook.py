#!/usr/bin/env python3
"""
GitHub Webhook 服务端脚本
监听 push 事件，自动拉取最新代码并重启后端
"""
import json
import os
import subprocess
import sys
import hmac
import hashlib
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

PROJECT_DIR = os.path.expanduser("~/workspace/stock-analyst")
LISTEN_HOST = "0.0.0.0"
LISTEN_PORT = 9000

# 从环境变量读取 Secret（建议设置，不设置则跳过校验）
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")


def run_cmd(cmd, cwd=PROJECT_DIR, timeout=120):
    """执行命令并返回 (success, output)"""
    try:
        r = subprocess.run(
            cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout
        )
        out = r.stdout + r.stderr
        return r.returncode == 0, out
    except subprocess.TimeoutExpired:
        return False, "命令超时"
    except Exception as e:
        return False, str(e)


def verify_signature(payload_body, signature_header):
    """校验 GitHub 签名"""
    if not WEBHOOK_SECRET or not signature_header:
        return True  # 未配置 secret 时跳过校验
    algo, sig = signature_header.split("=", 1) if "=" in signature_header else ("sha1", signature_header)
    h = hmac.new(WEBHOOK_SECRET.encode(), payload_body, hashlib.sha1 if algo == "sha1" else hashlib.sha256)
    return hmac.compare_digest(h.hexdigest(), sig)


def handle_push(event):
    """处理 push 事件"""
    ref = event.get("ref", "")
    repo_name = event.get("repository", {}).get("full_name", "unknown")
    pusher = event.get("pusher", {}).get("name", "unknown")
    commits = event.get("commits", [])
    branch = ref.replace("refs/heads/", "")
    msg = commits[0].get("message", "").split("\n")[0] if commits else ""
    commit_id = event.get("after", "")[:8]

    print(f"\n{'='*60}")
    print(f"收到 Push: {repo_name}")
    print(f"  分支: {branch}")
    print(f"  提交: {commit_id} {msg}")
    print(f"  推送者: {pusher}")
    print(f"{'='*60}")

    # 只处理 main/master 分支
    if branch not in ("main", "master"):
        print(f"⏭️  跳过非主干分支: {branch}")
        return {"status": "skipped", "reason": f"not main/master branch: {branch}"}

    steps = []

    # 1. 拉取最新代码
    print("\n[1/4] git pull...")
    ok, out = run_cmd(["git", "pull"])
    steps.append({"step": "git_pull", "success": ok, "output": out.strip()})
    if not ok:
        print(f"❌ git pull 失败:\n{out}")
        return {"status": "fail", "steps": steps}
    print(f"✅ git pull 成功")
    print(out[:500])

    # 2. 安装依赖（如果有变动）
    print("\n[2/4] pip install -r requirements.txt...")
    req_path = os.path.join(PROJECT_DIR, "backend", "requirements.txt")
    if os.path.exists(req_path):
        ok, out = run_cmd(
            [sys.executable, "-m", "pip", "install", "-r", req_path, "--quiet"],
            cwd=os.path.join(PROJECT_DIR, "backend"),
        )
        steps.append({"step": "pip_install", "success": ok, "output": out.strip()})
        if not ok:
            print(f"⚠️  pip install 有警告/错误:\n{out}")
        else:
            print(f"✅ 依赖安装完成")
    else:
        steps.append({"step": "pip_install", "success": True, "output": "无 requirements.txt"})
        print(f"⏭️  无 requirements.txt，跳过")

    # 3. 重启后端
    print("\n[3/4] 重启后端服务...")
    kill_ok, kill_out = run_cmd([
        "sh", "-c",
        "ps aux | grep 'uvicorn.*app.main' | grep -v grep | awk '{print $2}' | xargs -r kill"
    ])
    # 等待旧进程退出
    import time
    time.sleep(2)
    start_ok, start_out = run_cmd(
        [
            "nohup", sys.executable, "-m", "uvicorn", "app.main:app",
            "--host", "0.0.0.0", "--port", "8000", "--workers", "1",
        ],
        cwd=os.path.join(PROJECT_DIR, "backend"),
    )
    # nohup 会立即返回，等几秒检查健康
    time.sleep(3)
    health_ok, health_out = run_cmd(
        ["curl", "-sf", "http://localhost:8000/health"]
    )
    steps.append({
        "step": "restart_backend",
        "success": health_ok,
        "output": f"kill: {kill_out.strip()}\nstart: {start_out.strip()}\nhealth: {health_out.strip()}" if health_ok else f"health check failed: {health_out.strip()}",
    })
    if health_ok:
        print(f"✅ 后端重启成功，健康检查通过")
    else:
        print(f"❌ 后端健康检查失败:\n{health_out}")

    # 4. 更新静态文件/前端（如果有）
    print("\n[4/4] 前端构建（如有需要）...")
    frontend_dir = os.path.join(PROJECT_DIR, "frontend")
    pkg_json = os.path.join(frontend_dir, "package.json")
    if os.path.exists(pkg_json):
        ok, out = run_cmd(["npm", "ci", "--production"], cwd=frontend_dir)
        steps.append({"step": "frontend_build", "success": ok, "output": out.strip()})
        if ok:
            print(f"✅ 前端依赖安装完成")
        else:
            print(f"⚠️ 前端构建有问题:\n{out}")
    else:
        steps.append({"step": "frontend_build", "success": True, "output": "无前端项目"})
        print(f"⏭️  无前端项目，跳过")

    print(f"\n{'='*60}")
    all_ok = all(s["success"] for s in steps)
    status = "success" if all_ok else "partial_fail"
    print(f"🎉 部署完成 [{status}]")
    print(f"{'='*60}")

    return {"status": status, "steps": steps}


class WebhookHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        path = urlparse(self.path).path
        if path != "/webhook":
            self.send_error(404)
            return

        # 读取 body
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        # 校验签名
        sig = self.headers.get("X-Hub-Signature", "") or self.headers.get("X-Hub-Signature-256", "")
        if not verify_signature(body, sig):
            print("❌ 签名校验失败")
            self.send_response(403)
            self.end_headers()
            self.wfile.write(b'{"error":"signature mismatch"}')
            return

        # 解析事件
        event_type = self.headers.get("X-GitHub-Event", "")
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            self.send_response(400)
            self.end_headers()
            return

        if event_type == "push":
            result = handle_push(data)
        elif event_type == "ping":
            result = {"status": "pong"}
        else:
            result = {"status": "ignored", "event": event_type}

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(result).encode())

    def log_message(self, format, *args):
        # 用 print 代替系统 logger
        print(f"[{self.log_date_time_string()}] {args[0]} {args[1]} {args[2]}")


def main():
    print(f"🚀 GitHub Webhook Server")
    print(f"   监听: {LISTEN_HOST}:{LISTEN_PORT}")
    print(f"   Endpoint: POST /webhook")
    print(f"   项目: {PROJECT_DIR}")
    print(f"   Secret 校验: {'已启用' if WEBHOOK_SECRET else '已禁用'}")
    print()

    server = HTTPServer((LISTEN_HOST, LISTEN_PORT), WebhookHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 停止服务")
        server.server_close()


if __name__ == "__main__":
    main()
