import argparse
import base64
import os
import posixpath
import secrets
import shutil
import stat
import subprocess
import sys
from pathlib import Path

try:
    import paramiko
except ImportError as exc:
    raise SystemExit("缺少 paramiko，无法自动 SSH 部署。") from exc


ROOT = Path(__file__).resolve().parents[1]
REMOTE_DIR = "/opt/personal-pasteboard"
DEFAULT_HOST = "43.133.171.24"
DEFAULT_USER = "ubuntu"
SECRETS_FILE = ROOT / "DEPLOYMENT-SECRETS.txt"


def run_local(args, cwd=ROOT):
    completed = subprocess.run(args, cwd=cwd, check=True, capture_output=True, text=True)
    return completed.stdout.strip()


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


def remote(ssh, command, password=None, timeout=180):
    if password:
        command = f"printf '%s\\n' {shell_quote(password)} | sudo -S {command}"
    stdin, stdout, stderr = ssh.exec_command(command, timeout=timeout, get_pty=bool(password))
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if code != 0:
        raise RuntimeError(f"remote command failed ({code}): {command}\nSTDOUT:\n{out}\nSTDERR:\n{err}")
    return out


def shell_quote(value):
    return "'" + value.replace("'", "'\"'\"'") + "'"


def ensure_parent(sftp, remote_file):
    parts = posixpath.dirname(remote_file).split("/")
    current = ""
    for part in parts:
        if not part:
            current = "/"
            continue
        current = posixpath.join(current, part)
        try:
            sftp.stat(current)
        except FileNotFoundError:
            sftp.mkdir(current)


def upload_dir(sftp, local_dir, remote_dir):
    for path in local_dir.rglob("*"):
        if ".git" in path.parts or "data" in path.parts or "node_modules" in path.parts:
            continue
        rel = path.relative_to(local_dir).as_posix()
        target = posixpath.join(remote_dir, rel)
        if path.is_dir():
            try:
                sftp.mkdir(target)
            except OSError:
                pass
            continue
        ensure_parent(sftp, target)
        sftp.put(str(path), target)
        if path.suffix == ".sh":
            sftp.chmod(target, stat.S_IRUSR | stat.S_IWUSR | stat.S_IXUSR | stat.S_IRGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IXOTH)


def make_env(password, existing_env=None):
    existing = {}
    if existing_env:
        for line in existing_env.splitlines():
            if "=" in line and not line.strip().startswith("#"):
                key, value = line.split("=", 1)
                existing[key] = value
    hash_value = run_local(["node", "src/server.js", "--hash-password", password])
    return "\n".join(
        [
            f"PASTEBOARD_PASSWORD_HASH={hash_value}",
            f"PASTEBOARD_DATA_KEY={existing.get('PASTEBOARD_DATA_KEY') or base64.b64encode(secrets.token_bytes(32)).decode('ascii')}",
            f"PASTEBOARD_SESSION_SECRET={existing.get('PASTEBOARD_SESSION_SECRET') or base64.b64encode(secrets.token_bytes(32)).decode('ascii')}",
            "",
        ]
    )


def read_remote_text(sftp, remote_file):
    try:
        with sftp.open(remote_file, "r") as fh:
            return fh.read().decode("utf-8", errors="replace")
    except FileNotFoundError:
        return None


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
    parser = argparse.ArgumentParser(description="Deploy personal pasteboard to a Linux server.")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--user", default=DEFAULT_USER)
    parser.add_argument("--password", default=os.environ.get("PASTEBOARD_SSH_PASSWORD"))
    parser.add_argument("--port", type=int, default=22)
    parser.add_argument("--app-password", default=os.environ.get("PASTEBOARD_APP_PASSWORD"))
    args = parser.parse_args()

    if not args.password:
        raise SystemExit("缺少 SSH 密码：设置 PASTEBOARD_SSH_PASSWORD 或传 --password。")
    if args.app_password and len(args.app_password) < 12:
        raise SystemExit("访问密码至少 12 位。")
    app_password = args.app_password or f"pb-{secrets.token_urlsafe(24)}"
    if not shutil.which("node"):
        raise SystemExit("本机缺少 node。")

    write_secret_note(args.host, args.user, app_password)
    ssh = connect(args.host, args.user, args.password, args.port)
    try:
        remote(
            ssh,
            "sh -lc "
            + shell_quote(
                f"mkdir -p {shell_quote(REMOTE_DIR)} {shell_quote(posixpath.join(REMOTE_DIR, 'data'))} "
                f"&& chown -R {shell_quote(args.user)}:{shell_quote(args.user)} {shell_quote(REMOTE_DIR)}"
            ),
            args.password,
        )
        remote(
            ssh,
            "sh -lc "
            + shell_quote(
                "mkdir -p /opt/pasteboard-backups && "
                f"if [ -d {shell_quote(REMOTE_DIR)} ] && [ \"$(ls -A {shell_quote(REMOTE_DIR)} 2>/dev/null)\" ]; "
                f"then tar -czf /opt/pasteboard-backups/predeploy-$(date +%Y%m%d-%H%M%S).tar.gz -C {shell_quote(posixpath.dirname(REMOTE_DIR))} {shell_quote(posixpath.basename(REMOTE_DIR))}; "
                "fi"
            ),
            args.password,
            timeout=120,
        )
        sftp = ssh.open_sftp()
        try:
            existing_env = read_remote_text(sftp, posixpath.join(REMOTE_DIR, ".env"))
            env_content = make_env(app_password, existing_env)
            upload_dir(sftp, ROOT, REMOTE_DIR)
            env_remote = posixpath.join(REMOTE_DIR, ".env")
            with sftp.open(env_remote, "w") as fh:
                fh.write(env_content)
            sftp.chmod(env_remote, stat.S_IRUSR | stat.S_IWUSR)
        finally:
            sftp.close()

        remote(
            ssh,
            "sh -lc "
            + shell_quote(
                f"cd {REMOTE_DIR} && "
                f"mkdir -p data && chown -R {args.user}:{args.user} data && "
                "docker compose up -d --build && "
                "cp deploy/systemd/personal-pasteboard-*.service /etc/systemd/system/ && "
                "cp deploy/systemd/personal-pasteboard-*.timer /etc/systemd/system/ && "
                "systemctl daemon-reload && "
                "systemctl enable --now personal-pasteboard-backup.timer personal-pasteboard-keepalive.timer && "
                "systemctl restart personal-pasteboard-keepalive.service"
            ),
            args.password,
            timeout=600,
        )
        health = remote(ssh, "curl -fsS http://127.0.0.1:3088/healthz", timeout=30)
        print(health)
        print(f"deployed http://{args.host}:3088 (local service is bound behind server loopback; expose through nginx/https)")
    finally:
        ssh.close()


if __name__ == "__main__":
    main()
