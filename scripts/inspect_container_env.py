import argparse
import os

import paramiko


def main():
    parser = argparse.ArgumentParser(description="Inspect pasteboard hash inside the running container.")
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
        cmd = (
            "cd /opt/personal-pasteboard && "
            "docker compose exec -T pasteboard node -e "
            "\"const v=process.env.PASTEBOARD_PASSWORD_HASH||'';"
            "console.log('len',v.length);"
            "console.log('prefix',v.slice(0,80));"
            "console.log('dollars',(v.match(/\\\\$/g)||[]).length);"
            "console.log('raw',v);\""
        )
        stdin, stdout, stderr = ssh.exec_command(cmd, timeout=60)
        print(stdout.read().decode("utf-8", errors="replace"))
        err = stderr.read().decode("utf-8", errors="replace")
        if err:
            print(err)
    finally:
        ssh.close()


if __name__ == "__main__":
    main()
