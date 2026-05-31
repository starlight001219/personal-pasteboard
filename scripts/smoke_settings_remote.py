import argparse
import base64
import json
import os

import paramiko


def main():
    parser = argparse.ArgumentParser(description="Verify remote settings uploads.")
    parser.add_argument("--host", default="43.133.171.24")
    parser.add_argument("--user", default="ubuntu")
    parser.add_argument("--ssh-password", default=os.environ.get("PASTEBOARD_SSH_PASSWORD"))
    parser.add_argument("--app-password", required=True)
    args = parser.parse_args()
    if not args.ssh_password:
        raise SystemExit("缺少 SSH 密码。")

    login = base64.b64encode(json.dumps({"password": args.app_password}).encode()).decode()
    bg = base64.b64encode(
        json.dumps(
            {
                "filename": "test.png",
                "contentType": "image/png",
                "data": base64.b64encode(b"png-test").decode(),
            }
        ).encode()
    ).decode()
    music = base64.b64encode(
        json.dumps(
            {
                "filename": "test.mp3",
                "contentType": "audio/mpeg",
                "data": base64.b64encode(b"mp3-test").decode(),
            }
        ).encode()
    ).decode()
    cmd = f"""python3 - <<'PY'
import base64, http.cookiejar, json, urllib.request

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

def req(method, path, body=None, csrf=None):
    data = None if body is None else json.dumps(body).encode()
    headers = {{"content-type": "application/json"}}
    if csrf:
        headers["x-csrf-token"] = csrf
    request = urllib.request.Request("http://127.0.0.1:3088" + path, data=data, headers=headers, method=method)
    with opener.open(request, timeout=10) as response:
        text = response.read().decode()
        return response.status, json.loads(text) if text else {{}}

_, login = req("POST", "/api/login", json.loads(base64.b64decode("{login}").decode()))
csrf = login["csrfToken"]
status, before = req("GET", "/api/settings")
status, bg = req("POST", "/api/settings/background", json.loads(base64.b64decode("{bg}").decode()), csrf)
status, music = req("POST", "/api/settings/music", json.loads(base64.b64decode("{music}").decode()), csrf)
with opener.open("http://127.0.0.1:3088" + bg["settings"]["backgroundUrl"], timeout=10) as response:
    bg_status = response.status
with opener.open("http://127.0.0.1:3088" + music["settings"]["musicUrl"], timeout=10) as response:
    music_status = response.status
print("settings_before", before["settings"])
print("background_url", bg["settings"]["backgroundUrl"], "asset_status", bg_status)
print("music_url", music["settings"]["musicUrl"], "asset_status", music_status)
PY"""

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(args.host, 22, args.user, args.ssh_password, timeout=20, allow_agent=False, look_for_keys=False)
    try:
        stdin, stdout, stderr = ssh.exec_command(cmd, timeout=60)
        print(stdout.read().decode("utf-8", errors="replace"))
        err = stderr.read().decode("utf-8", errors="replace")
        if err:
            print(err)
    finally:
        ssh.close()


if __name__ == "__main__":
    main()
