import argparse
import os
import secrets
import subprocess
from pathlib import Path

import paramiko


ROOT = Path(__file__).resolve().parents[1]
SECRETS_FILE = ROOT / "DEPLOYMENT-SECRETS.txt"


def shell_quote(value):
    return "'" + value.replace("'", "'\"'\"'") + "'"


def run_local(args):
    completed = subprocess.run(args, cwd=ROOT, check=True, capture_output=True, text=True)
    return completed.stdout.strip()


def connect(host, user, password):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, 22, user, password, timeout=20, allow_agent=False, look_for_keys=False)
    return ssh


def remote(ssh, command, sudo_password=None, timeout=180):
    if sudo_password:
        command = f"printf '%s\\n' {shell_quote(sudo_password)} | sudo -S sh -lc {shell_quote(command)}"
    stdin, stdout, stderr = ssh.exec_command(command, timeout=timeout, get_pty=bool(sudo_password))
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if code != 0:
        raise RuntimeError(f"remote command failed ({code})\n{out}\n{err}")
    return out


def read_remote_file(ssh, path):
    sftp = ssh.open_sftp()
    try:
        with sftp.open(path, "r") as fh:
            return fh.read().decode("utf-8")
    finally:
        sftp.close()


def write_remote_file(ssh, path, content):
    sftp = ssh.open_sftp()
    try:
        with sftp.open(path, "w") as fh:
            fh.write(content)
    finally:
        sftp.close()


def write_secret_note(host, user, app_password):
    content = "\n".join(
        [
            "个人粘贴板部署信息",
            f"服务器: {user}@{host}",
            f"访问密码: {app_password}",
            "",
            "安全访问方式:",
            f"ssh -L 3088:127.0.0.1:3088 {user}@{host}",
            "然后打开 http://127.0.0.1:3088",
            "",
            "说明: 服务在服务器上仅绑定 127.0.0.1:3088，未直接暴露公网。",
        ]
    )
    SECRETS_FILE.write_text(content, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Reset remote pasteboard app password.")
    parser.add_argument("--host", default="43.133.171.24")
    parser.add_argument("--user", default="ubuntu")
    parser.add_argument("--ssh-password", default=os.environ.get("PASTEBOARD_SSH_PASSWORD"))
    parser.add_argument("--app-password", default=os.environ.get("PASTEBOARD_APP_PASSWORD"))
    args = parser.parse_args()

    if not args.ssh_password:
        raise SystemExit("缺少 SSH 密码。")
    app_password = args.app_password or f"pb-{secrets.token_urlsafe(24)}"
    if len(app_password) < 12:
        raise SystemExit("访问密码至少 12 位。")

    new_hash = run_local(["node", "src/server.js", "--hash-password", app_password])
    ssh = connect(args.host, args.user, args.ssh_password)
    try:
        remote(
            ssh,
            "mkdir -p /opt/pasteboard-backups && "
            "cp /opt/personal-pasteboard/.env /opt/pasteboard-backups/env-before-password-reset-$(date +%Y%m%d-%H%M%S)",
            args.ssh_password,
        )
        env_path = "/opt/personal-pasteboard/.env"
        env_text = read_remote_file(ssh, env_path)
        lines = [
            f"PASTEBOARD_PASSWORD_HASH={new_hash}" if line.startswith("PASTEBOARD_PASSWORD_HASH=") else line
            for line in env_text.splitlines()
        ]
        write_remote_file(ssh, env_path, "\n".join(lines) + "\n")
        remote(
            ssh,
            "cd /opt/personal-pasteboard && docker compose up -d --force-recreate pasteboard",
            args.ssh_password,
            timeout=300,
        )
        write_secret_note(args.host, args.user, app_password)
        print(app_password)
    finally:
        ssh.close()


if __name__ == "__main__":
    main()
