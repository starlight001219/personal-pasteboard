import argparse
import os

import paramiko


def shell_quote(value):
    return "'" + value.replace("'", "'\"'\"'") + "'"


def main():
    parser = argparse.ArgumentParser(description="Restore remote data key from latest predeploy backup.")
    parser.add_argument("--host", default="43.133.171.24")
    parser.add_argument("--user", default="ubuntu")
    parser.add_argument("--ssh-password", default=os.environ.get("PASTEBOARD_SSH_PASSWORD"))
    parser.add_argument("--backup", help="Specific predeploy tarball name to restore from.")
    args = parser.parse_args()
    if not args.ssh_password:
        raise SystemExit("缺少 SSH 密码。")

    cmd = r"""
set -e
cd /opt/pasteboard-backups
backup="__BACKUP__"
if [ "$backup" = "__AUTO__" ]; then
  backup=$(ls -1t predeploy-*.tar.gz | sed -n '2p')
fi
if [ -z "$backup" ]; then
  echo "no previous backup" >&2
  exit 2
fi
tmp=$(mktemp -d)
tar -xzf "$backup" -C "$tmp"
old_env="$tmp/personal-pasteboard/.env"
old_key=$(grep '^PASTEBOARD_DATA_KEY=' "$old_env" | cut -d= -f2-)
old_session=$(grep '^PASTEBOARD_SESSION_SECRET=' "$old_env" | cut -d= -f2-)
if [ -z "$old_key" ]; then
  echo "missing old key" >&2
  exit 3
fi
cp /opt/personal-pasteboard/.env "/opt/pasteboard-backups/env-before-data-key-restore-$(date +%Y%m%d-%H%M%S)"
python3 - "$old_key" "$old_session" <<'PY'
from pathlib import Path
import sys
old_key = sys.argv[1]
old_session = sys.argv[2]
p = Path('/opt/personal-pasteboard/.env')
lines = []
for line in p.read_text().splitlines():
    if line.startswith('PASTEBOARD_DATA_KEY='):
        lines.append('PASTEBOARD_DATA_KEY=' + old_key)
    elif line.startswith('PASTEBOARD_SESSION_SECRET=') and old_session:
        lines.append('PASTEBOARD_SESSION_SECRET=' + old_session)
    else:
        lines.append(line)
p.write_text('\n'.join(lines) + '\n')
PY
rm -rf "$tmp"
cd /opt/personal-pasteboard
docker compose up -d --force-recreate pasteboard
echo "restored-from=$backup"
""".replace("__BACKUP__", args.backup or "__AUTO__")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(args.host, 22, args.user, args.ssh_password, timeout=20, allow_agent=False, look_for_keys=False)
    try:
        sudo_cmd = f"printf '%s\\n' {shell_quote(args.ssh_password)} | sudo -S sh -lc {shell_quote(cmd)}"
        stdin, stdout, stderr = ssh.exec_command(sudo_cmd, timeout=300, get_pty=True)
        print(stdout.read().decode("utf-8", errors="replace"))
        err = stderr.read().decode("utf-8", errors="replace")
        if err:
            print(err)
        code = stdout.channel.recv_exit_status()
        if code != 0:
            raise SystemExit(code)
    finally:
        ssh.close()


if __name__ == "__main__":
    main()
