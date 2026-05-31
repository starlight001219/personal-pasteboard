import argparse
import os

import paramiko


def shell_quote(value):
    return "'" + value.replace("'", "'\"'\"'") + "'"


def main():
    parser = argparse.ArgumentParser(description="Reset remote pasteboard settings to bundled defaults.")
    parser.add_argument("--host", default="43.133.171.24")
    parser.add_argument("--user", default="ubuntu")
    parser.add_argument("--ssh-password", default=os.environ.get("PASTEBOARD_SSH_PASSWORD"))
    args = parser.parse_args()
    if not args.ssh_password:
        raise SystemExit("缺少 SSH 密码。")

    cmd = r"""
cd /opt/personal-pasteboard
docker compose exec -T pasteboard node - <<'NODE'
const { createStore } = require('./src/storage');
const store = createStore({
  file: '/app/data/pastes.json.enc',
  dataKey: process.env.PASTEBOARD_DATA_KEY
});
store.updateSettings({
  backgroundUrl: '/assets/background.png',
  musicUrl: '/assets/music.mp3'
}).then((settings) => {
  console.log(JSON.stringify(settings));
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
docker compose restart pasteboard >/dev/null
"""

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
