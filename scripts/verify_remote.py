import argparse
import os

import paramiko


def connect(host, user, password, port):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(
        host,
        port,
        user,
        password,
        timeout=20,
        allow_agent=False,
        look_for_keys=False,
    )
    return ssh


def run(ssh, command):
    stdin, stdout, stderr = ssh.exec_command(command, timeout=90, get_pty=True)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    return code, out, err


def main():
    parser = argparse.ArgumentParser(description="Verify remote personal pasteboard deployment.")
    parser.add_argument("--host", default="43.133.171.24")
    parser.add_argument("--user", default="ubuntu")
    parser.add_argument("--password", default=os.environ.get("PASTEBOARD_SSH_PASSWORD"))
    parser.add_argument("--port", type=int, default=22)
    args = parser.parse_args()

    if not args.password:
        raise SystemExit("缺少 SSH 密码：设置 PASTEBOARD_SSH_PASSWORD 或传 --password。")

    checks = [
        ("docker", "docker ps --filter name=personal-pasteboard --format '{{.Names}} {{.Status}} {{.Ports}}'"),
        ("timers", "systemctl list-timers --all 'personal-pasteboard-*' --no-pager --no-legend || true"),
        ("listen", "ss -ltnp | grep 3088 || true"),
        ("backups", "ls -la /opt/pasteboard-backups 2>/dev/null || true"),
        ("health", "curl -fsS http://127.0.0.1:3088/healthz"),
    ]

    ssh = connect(args.host, args.user, args.password, args.port)
    try:
        for label, command in checks:
            code, out, err = run(ssh, command)
            print(f"--- {label} code={code} ---")
            print(out.strip())
            if err.strip():
                print(err.strip())
    finally:
        ssh.close()


if __name__ == "__main__":
    main()
