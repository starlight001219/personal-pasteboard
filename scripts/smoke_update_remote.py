import argparse
import base64
import json
import os

import paramiko


def main():
    parser = argparse.ArgumentParser(description="Create/update/delete a remote test paste.")
    parser.add_argument("--host", default="43.133.171.24")
    parser.add_argument("--user", default="ubuntu")
    parser.add_argument("--ssh-password", default=os.environ.get("PASTEBOARD_SSH_PASSWORD"))
    parser.add_argument("--app-password", required=True)
    args = parser.parse_args()

    if not args.ssh_password:
        raise SystemExit("缺少 SSH 密码。")

    login = base64.b64encode(json.dumps({"password": args.app_password}).encode()).decode()
    create = base64.b64encode(
        json.dumps({"title": "update-smoke", "content": "before", "tags": ["t"], "pinned": False}).encode()
    ).decode()
    update = base64.b64encode(
        json.dumps({"title": "update-smoke-edited", "content": "after", "tags": ["t", "ok"], "pinned": True}).encode()
    ).decode()
    cmd = f"""python3 - <<'PY'
import base64
import http.cookiejar
import json
import urllib.request

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

def req(method, path, body=None, csrf=None):
    data = None if body is None else json.dumps(body).encode()
    headers = {{"content-type": "application/json"}}
    if csrf:
        headers["x-csrf-token"] = csrf
    request = urllib.request.Request("http://127.0.0.1:3088" + path, data=data, headers=headers, method=method)
    try:
        with opener.open(request, timeout=10) as response:
            return response.status, json.loads(response.read().decode())
    except urllib.error.HTTPError as error:
        print("http_error", error.code, error.read().decode())
        raise

_, login = req("POST", "/api/login", json.loads(base64.b64decode("{login}").decode()))
csrf = login["csrfToken"]
_, created = req("POST", "/api/pastes", json.loads(base64.b64decode("{create}").decode()), csrf)
paste_id = created["paste"]["id"]
status, updated = req("PUT", "/api/pastes/" + paste_id, json.loads(base64.b64decode("{update}").decode()), csrf)
_, deleted = req("DELETE", "/api/pastes/" + paste_id, csrf=csrf)
print("update_status", status)
print("updated_title", updated["paste"]["title"])
print("updated_pinned", updated["paste"]["pinned"])
print("deleted", deleted["deleted"])
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
