"""
JALgorithm Tunnel Bridge
------------------------
Run this to expose your local LM Studio to the Vercel site.

Steps:
  1. Open LM Studio and start the server (port 1234)
  2. Run this script: python tunnel_bridge.py
  3. Open your Vercel site — chat will work automatically

Requires:
  - cloudflared  (free, no account): https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
  - Python 3
  - pip install requests python-dotenv
"""

import subprocess
import threading
import time
import re
import sys
import os
import requests

# ── config ────────────────────────────────────────────────────────────────────

LM_STUDIO_PORT = 1234
SUPABASE_TABLE = "tunnel_config"
ENV_FILE = ".env.local"

# ── load .env.local ───────────────────────────────────────────────────────────

def load_env():
    env = {}
    if not os.path.exists(ENV_FILE):
        print(f"ERROR: {ENV_FILE} not found. Copy .env.example to {ENV_FILE} and fill in your Supabase keys.")
        sys.exit(1)
    with open(ENV_FILE) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    return env

# ── supabase helpers ──────────────────────────────────────────────────────────

def push_url(supabase_url, service_key, tunnel_url):
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    payload = {"id": 1, "lm_studio_url": tunnel_url}
    r = requests.post(
        f"{supabase_url}/rest/v1/{SUPABASE_TABLE}",
        json=payload,
        headers=headers,
        timeout=10,
    )
    r.raise_for_status()


def clear_url(supabase_url, service_key):
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }
    payload = {"lm_studio_url": None}
    r = requests.patch(
        f"{supabase_url}/rest/v1/{SUPABASE_TABLE}?id=eq.1",
        json=payload,
        headers=headers,
        timeout=10,
    )
    r.raise_for_status()

# ── cloudflared ───────────────────────────────────────────────────────────────

def get_cloudflared_cmd():
    # try global install first
    try:
        subprocess.run(["cloudflared", "--version"], capture_output=True, check=True)
        return ["cloudflared"]
    except (FileNotFoundError, subprocess.CalledProcessError):
        pass
    # fall back to npx
    return ["npx", "cloudflared"]


def run_tunnel():
    cmd = get_cloudflared_cmd() + ["tunnel", "--url", f"http://localhost:{LM_STUDIO_PORT}"]
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    url_pattern = re.compile(r"https://[a-zA-Z0-9\-]+\.trycloudflare\.com")
    tunnel_url = None

    for line in process.stdout:
        print(f"  [cloudflared] {line.strip()}")
        if not tunnel_url:
            match = url_pattern.search(line)
            if match:
                tunnel_url = match.group(0)
                # signal main thread via shared state
                _state["url"] = tunnel_url
                _state["ready"].set()

    process.wait()
    _state["done"].set()


_state = {
    "url": None,
    "ready": threading.Event(),
    "done": threading.Event(),
}

# ── lm studio health check ────────────────────────────────────────────────────

def check_lm_studio():
    try:
        r = requests.get(f"http://localhost:{LM_STUDIO_PORT}/v1/models", timeout=3)
        return r.status_code == 200
    except Exception:
        return False

# ── main ──────────────────────────────────────────────────────────────────────

def main():
    env = load_env()
    supabase_url = env.get("VITE_SUPABASE_URL")
    service_key = env.get("SUPABASE_SERVICE_KEY")

    if not supabase_url or not service_key:
        print("ERROR: VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY are required in .env.local")
        print("Get your service_role key from: Supabase → Project Settings → API → service_role")
        sys.exit(1)

    print("=" * 55)
    print("  JALgorithm Tunnel Bridge")
    print("=" * 55)

    # check LM Studio
    if check_lm_studio():
        print(f"  LM Studio: RUNNING on port {LM_STUDIO_PORT}")
    else:
        print(f"  WARNING: LM Studio not detected on port {LM_STUDIO_PORT}")
        print("  Make sure LM Studio server is started before chatting.")

    print("  Starting Cloudflare tunnel...")

    # start tunnel in background thread
    t = threading.Thread(target=run_tunnel, daemon=True)
    t.start()

    # wait for URL (up to 30s)
    if not _state["ready"].wait(timeout=30):
        print("ERROR: Tunnel did not start within 30 seconds.")
        print("Make sure cloudflared is installed: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/")
        sys.exit(1)

    tunnel_url = _state["url"]
    print(f"\n  Tunnel URL : {tunnel_url}")
    print(f"  LM Studio  : {tunnel_url}/v1/chat/completions")

    # push to Supabase
    print("  Pushing URL to Supabase...")
    try:
        push_url(supabase_url, service_key, tunnel_url)
        print("  Supabase   : URL saved — Vercel site is now live!")
    except Exception as e:
        print(f"  ERROR pushing to Supabase: {e}")
        sys.exit(1)

    print("\n  Chatbot is ONLINE. Keep this window open.")
    print("  Press Ctrl+C to stop.\n")

    # health monitor loop
    try:
        while not _state["done"].is_set():
            time.sleep(30)
            if not check_lm_studio():
                print("  WARNING: LM Studio appears to be offline. Chat may not work.")
    except KeyboardInterrupt:
        pass
    finally:
        print("\n  Shutting down — clearing URL from Supabase...")
        try:
            clear_url(supabase_url, service_key)
            print("  Done. Chatbot is now OFFLINE on Vercel.")
        except Exception as e:
            print(f"  Could not clear URL: {e}")


if __name__ == "__main__":
    main()
