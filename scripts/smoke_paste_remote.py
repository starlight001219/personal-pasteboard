import argparse
import base64
import json
import os

import paramiko


def shell_quote(value):
    return "'" + value.replace("'", "'\"'\"'") + "'"


def main():
    parser = argparse.ArgumentParser(description="Create/list/delete a remote test paste.")
    parser.add_argument("--host", default="43.133.171.24")
    parser.add_argument("--user", default="ubuntu")
    parser.add_argument("--ssh-password", default=os.environ.get("PASTEBOARD_SSH_PASSWORD"))
    parser.add_argument("--app-password", required=True)
    args = parser.parse_args()

    if not args.ssh_password:
        raise SystemExit("缺少 SSH 密码。")

    login_payload = base64.b64encode(json.dumps({"password": args.app_password}, ensure_ascii=False).encode()).decode()
    paste_payload = base64.b64encode(json.dumps(
        {
            "title": "smoke-test",
            "content": "temporary paste smoke test",
            "tags": ["test"],
            "pinned": False,
        },
        ensure_ascii=False,
    ).encode()).decode()
    cmd = f"""python3 - <<'PY'
import http.cookiejar
import base64
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
    with opener.open(request, timeout=10) as response:
        return response.status, json.loads(response.read().decode())

status, login = req("POST", "/api/login", json.loads(base64.b64decode("{login_payload}").decode()))
csrf = login["csrfToken"]
status, created = req("POST", "/api/pastes", json.loads(base64.b64decode("{paste_payload}").decode()), csrf)
paste_id = created["paste"]["id"]
status, listed = req("GET", "/api/pastes")
status, deleted = req("DELETE", "/api/pastes/" + paste_id, csrf=csrf)
print("created_status", 201)
print("created_title", created["paste"]["title"])
print("list_count_after_create", len(listed["pastes"]))
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
