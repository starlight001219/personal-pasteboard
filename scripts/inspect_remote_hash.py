import argparse
import os

import paramiko


def main():
    parser = argparse.ArgumentParser(description="Inspect remote pasteboard hash shape.")
    parser.add_argument("--host", default="43.133.171.24")
    parser.add_argument("--user", default="ubuntu")
    parser.add_argument("--ssh-password", default=os.environ.get("PASTEBOARD_SSH_PASSWORD"))
    args = parser.parse_args()
    if not args.ssh_password:
        raise SystemExit("缺少 SSH 密码。")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(args.host, 22, args.user, args.ssh_password, timeout=20, allow_agent=False, look_for_keys=False)
    try:
        cmd = "python3 - <<'PY'\nfrom pathlib import Path\nfor line in Path('/opt/personal-pasteboard/.env').read_text().splitlines():\n    if line.startswith('PASTEBOARD_PASSWORD_HASH='):\n        v=line.split('=',1)[1]\n        print('len', len(v))\n        print('prefix', v[:80])\n        print('dollars', v.count('$'))\nPY"
        stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
        print(stdout.read().decode("utf-8", errors="replace"))
        err = stderr.read().decode("utf-8", errors="replace")
        if err:
            print(err)
    finally:
        ssh.close()


if __name__ == "__main__":
    main()
