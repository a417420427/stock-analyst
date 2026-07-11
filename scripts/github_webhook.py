#!/usr/bin/env python3
"""
GitHub Webhook 服务端脚本
监听 push 事件，自动拉取最新代码并重启后端
"""
import json, os, subprocess, sys, hmac, hashlib, time, threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

PROJECT_DIR = os.path.expanduser("~/workspace/stock-analyst")
LISTEN_HOST = "0.0.0.0"
LISTEN_PORT = 9000
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")

def log(msg):
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)

def run_cmd(cmd, cwd=PROJECT_DIR, timeout=120):
    try:
        r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        return r.returncode == 0, (r.stdout + r.stderr).strip()
    except Exception as e:
        return False, str(e)

def verify_sig(body, header):
    if not WEBHOOK_SECRET or not header:
        return True
    algo, sig = header.split("=", 1) if "=" in header else ("sha1", header)
    h = hmac.new(WEBHOOK_SECRET.encode(), body, hashlib.sha256 if algo == "sha256" else hashlib.sha1)
    return hmac.compare_digest(h.hexdigest(), sig)

def do_deploy(event):
    branch = event.get("ref", "").replace("refs/heads/", "")
    if branch not in ("main", "master"):
        log(f"skip branch: {branch}"); return
    repo = event.get("repository", {}).get("full_name", "?")
    pusher = event.get("pusher", {}).get("name", "?")
    commits = event.get("commits", [])
    msg = (commits[0].get("message", "").split("\n")[0] if commits else "?")
    cid = event.get("after", "")[:8]
    log(f"DEPLOY {repo} {branch} {cid} '{msg}' by {pusher}")
    # 1 git pull
    log("[1/4] git pull --autostash")
    ok, out = run_cmd(["git", "pull", "--autostash"])
    if not ok: log(f"FAIL git pull: {out}"); return
    log(f"OK: {out[:200]}")
    # 2 pip
    log("[2/4] pip install")
    req = os.path.join(PROJECT_DIR, "backend", "requirements.txt")
    if os.path.exists(req):
        run_cmd([sys.executable, "-m", "pip", "install", "-r", req, "--quiet"],
                cwd=os.path.join(PROJECT_DIR, "backend"))
    else:
        log("no requirements.txt")
    # 3 restart
    log("[3/4] restart backend")
    run_cmd(["pkill", "-f", "uvicorn.*app.main"])
    time.sleep(2)
    with open("/tmp/uvicorn_webhook.log", "w") as f:
        p = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "app.main:app",
             "--host", "0.0.0.0", "--port", "8000", "--workers", "1"],
            cwd=os.path.join(PROJECT_DIR, "backend"),
            stdout=f, stderr=f, start_new_session=True)
    time.sleep(3)
    ok, out = run_cmd(["curl", "-sf", "http://localhost:8000/health"])
    if ok: log(f"backend OK (pid={p.pid})")
    else:
        with open("/tmp/uvicorn_webhook.log") as f:
            log(f"backend FAIL, log: {f.read()[-300:]}")
    # 4 frontend
    log("[4/4] frontend")
    fdir = os.path.join(PROJECT_DIR, "frontend")
    if os.path.exists(os.path.join(fdir, "package.json")):
        run_cmd(["npm", "ci", "--production"], cwd=fdir, timeout=60)
    else:
        log("skip frontend")
    log("DONE\n")

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self._ok({"status": "running"})
    def do_POST(self):
        if urlparse(self.path).path != "/webhook":
            return self.send_error(404)
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        sig = self.headers.get("X-Hub-Signature", "") or self.headers.get("X-Hub-Signature-256", "")
        if not verify_sig(body, sig):
            log("bad signature"); return self._err(403, "bad signature")
        ev = self.headers.get("X-GitHub-Event", "")
        try:
            data = json.loads(body)
        except Exception:
            return self._err(400, "bad json")
        self._ok({"status": "accepted"})
        if ev == "push":
            threading.Thread(target=do_deploy, args=(data,), daemon=True).start()
        elif ev == "ping":
            log("ping")
    def _ok(self, d):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(d).encode())
    def _err(self, code, msg):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"error": msg}).encode())
    def log_message(self, *a): pass

if __name__ == "__main__":
    log(f"Webhook: {LISTEN_HOST}:{LISTEN_PORT}/webhook")
    log(f"Project: {PROJECT_DIR}")
    log(f"Secret: {'ON' if WEBHOOK_SECRET else 'OFF'}")
    HTTPServer((LISTEN_HOST, LISTEN_PORT), Handler).serve_forever()
