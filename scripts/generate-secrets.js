const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { hashPassword } = require('../src/security');

const password = process.argv[2];
if (!password || password.length < 12) {
  process.stderr.write('用法: node scripts/generate-secrets.js <至少12位访问密码>\n');
  process.exit(1);
}

const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  process.stderr.write('.env 已存在，为避免覆盖密钥已停止。\n');
  process.exit(2);
}

const lines = [
  `PASTEBOARD_PASSWORD_HASH=${hashPassword(password)}`,
  `PASTEBOARD_DATA_KEY=${crypto.randomBytes(32).toString('base64')}`,
  `PASTEBOARD_SESSION_SECRET=${crypto.randomBytes(32).toString('base64')}`
];

fs.writeFileSync(envFile, `${lines.join('\n')}\n`, { mode: 0o600 });
process.stdout.write(`已生成 ${envFile}\n`);
