import argparse
import json
import os

import paramiko


def shell_quote(value):
    return "'" + value.replace("'", "'\"'\"'") + "'"


def main():
    parser = argparse.ArgumentParser(description="Check remote pasteboard login password.")
    parser.add_argument("--host", default="43.133.171.24")
    parser.add_argument("--user", default="ubuntu")
    parser.add_argument("--ssh-password", default=os.environ.get("PASTEBOARD_SSH_PASSWORD"))
    parser.add_argument("--app-password", required=True)
    args = parser.parse_args()

    if not args.ssh_password:
        raise SystemExit("缺少 SSH 密码。")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(
        args.host,
        22,
        args.user,
        args.ssh_password,
        timeout=20,
        allow_agent=False,
        look_for_keys=False,
    )
    try:
        payload = json.dumps({"password": args.app_password}, ensure_ascii=False)
        cmd = (
            "curl -sS -i -X POST http://127.0.0.1:3088/api/login "
            "-H 'content-type: application/json' "
            f"--data {shell_quote(payload)}"
        )
        stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        print(out)
        if err:
            print(err)
    finally:
        ssh.close()


if __name__ == "__main__":
    main()
