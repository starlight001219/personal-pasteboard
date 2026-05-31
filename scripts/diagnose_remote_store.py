import argparse
import os

import paramiko


def main():
    parser = argparse.ArgumentParser(description="Diagnose encrypted store with available backup keys.")
    parser.add_argument("--host", default="43.133.171.24")
    parser.add_argument("--user", default="ubuntu")
    parser.add_argument("--ssh-password", default=os.environ.get("PASTEBOARD_SSH_PASSWORD"))
    args = parser.parse_args()
    if not args.ssh_password:
        raise SystemExit("缺少 SSH 密码。")

    inner = r"""
set -e
echo '--- logs ---'
docker logs personal-pasteboard --tail 80 || true
echo '--- key candidates ---'
python3 - <<'PY'
from pathlib import Path
import base64, json, tarfile
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

current = Path('/opt/personal-pasteboard/data/pastes.json.enc')
print('store_exists', current.exists(), 'size', current.stat().st_size if current.exists() else 0)
envs = []
for p in sorted(Path('/opt/pasteboard-backups').glob('env-*')):
    envs.append((str(p), p.read_text(errors='replace')))
for p in sorted(Path('/opt/pasteboard-backups').glob('predeploy-*.tar.gz')):
    try:
        with tarfile.open(p) as t:
            f = t.extractfile('personal-pasteboard/.env')
            if f:
                envs.append((str(p), f.read().decode('utf-8', errors='replace')))
    except Exception as e:
        print('tar_read_error', p, e)

seen = set()
for name, text in envs:
    key = None
    for line in text.splitlines():
        if line.startswith('PASTEBOARD_DATA_KEY='):
            key = line.split('=',1)[1]
    if not key or key in seen:
        continue
    seen.add(key)
    ok = False
    count = None
    try:
        env = json.loads(current.read_text())
        aes = AESGCM(base64.b64decode(key))
        plain = aes.decrypt(base64.b64decode(env['iv']), base64.b64decode(env['ciphertext']) + base64.b64decode(env['tag']), None)
        count = len(json.loads(plain)['pastes'])
        ok = True
    except Exception as e:
        count = type(e).__name__
    print('candidate', name, 'key_prefix', key[:8], 'len', len(key), 'decrypt', ok, 'detail', count)
PY
"""
    cmd = "printf '%s\\n' '" + args.ssh_password.replace("'", "'\"'\"'") + "' | sudo -S sh -lc '" + inner.replace("'", "'\"'\"'") + "'"

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(args.host, 22, args.user, args.ssh_password, timeout=20, allow_agent=False, look_for_keys=False)
    try:
        stdin, stdout, stderr = ssh.exec_command(cmd, timeout=120, get_pty=True)
        print(stdout.read().decode("utf-8", errors="replace"))
        err = stderr.read().decode("utf-8", errors="replace")
        if err:
            print(err)
    finally:
        ssh.close()


if __name__ == "__main__":
    main()
