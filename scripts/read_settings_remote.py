import argparse
import base64
import json
import os

import paramiko


def main():
    parser = argparse.ArgumentParser(description="Read remote pasteboard settings.")
    parser.add_argument("--host", default="43.133.171.24")
    parser.add_argument("--user", default="ubuntu")
    parser.add_argument("--ssh-password", default=os.environ.get("PASTEBOARD_SSH_PASSWORD"))
    parser.add_argument("--app-password", required=True)
    args = parser.parse_args()
    if not args.ssh_password:
        raise SystemExit("缺少 SSH 密码。")

    login = base64.b64encode(json.dumps({"password": args.app_password}).encode()).decode()
    cmd = f"""python3 - <<'PY'
import base64, http.cookiejar, json, urllib.request
jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def req(method, path, body=None):
    data = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request("http://127.0.0.1:3088" + path, data=data, headers={{"content-type":"application/json"}}, method=method)
    with opener.open(request, timeout=10) as response:
        return json.loads(response.read().decode())
opener.open(urllib.request.Request("http://127.0.0.1:3088/api/login", data=json.dumps(json.loads(base64.b64decode("{login}").decode())).encode(), headers={{"content-type":"application/json"}}, method="POST"), timeout=10).read()
print(json.dumps(req("GET", "/api/settings"), ensure_ascii=False))
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
