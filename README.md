# 个人粘贴板

一个零运行时第三方依赖的个人粘贴板服务。后端使用 Node.js 内置模块，数据用 AES-256-GCM 加密保存到 `data/pastes.json.enc`，登录使用 PBKDF2 密码哈希、HttpOnly SameSite 会话 Cookie 和 CSRF token。

## 本地启动

```powershell
node scripts\generate-secrets.js "换成至少12位的强密码"
npm start
```

默认监听 `http://127.0.0.1:3088`。

## Docker 部署

```bash
cd /opt/personal-pasteboard
node scripts/generate-secrets.js '换成至少12位的强密码'
docker compose up -d --build
```

`docker-compose.yml` 只绑定 `127.0.0.1:3088`，建议前面放 Nginx/Caddy 并开启 HTTPS。
当前默认适配 SSH 隧道访问，因此容器里设置了 `PASTEBOARD_SECURE_COOKIES=false`。如果后续改成公网 HTTPS 域名访问，把它改为 `true` 后重启。

生产安全基线写在 `SECURITY.md`：默认只绑定 `127.0.0.1:3088`，通过 SSH 隧道、VPN 或 HTTPS 反代访问；`.env` 和 `data/` 不进入公开仓库。

## 维护

- `scripts/backup.sh`：备份加密数据和 `.env`，默认保留 30 天。
- `scripts/keepalive.sh`：健康检查失败时执行 `docker compose up -d --remove-orphans`。
- `deploy/systemd/*.timer`：每天备份，每 5 分钟保活。

## 安全要点

- `.env` 里的 `PASTEBOARD_DATA_KEY` 是数据解密关键，丢失后无法解密旧数据。
- 不要把 `.env` 或 `data/` 上传到公开仓库。
- 传重要数据前务必给域名配置 HTTPS，并限制服务器 SSH 登录。
