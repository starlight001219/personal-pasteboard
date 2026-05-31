# GitHub Actions Workflows

This directory contains automated CI/CD workflows for Personal Pasteboard.

## Workflows

### 1. CI (`ci.yml`)
**Trigger**: Push to `main`/`develop`, Pull Requests to `main`

- ✅ JavaScript syntax checking (all source files)
- ✅ Unit tests with Node.js test runner
- ✅ Multi-version testing (Node.js 20.x, 22.x)
- 🐳 Docker build verification

### 2. Docker Publish (`docker-publish.yml`)
**Trigger**: Push version tags (`v*`), Manual dispatch

- 🐳 Builds production Docker image
- 📦 Pushes to GitHub Container Registry (ghcr.io)
- 🏷️ Tags: `latest`, `v1.0.0`, `1.0`

**Usage**:
```bash
git tag v1.0.0
git push origin v1.0.0
```

### 3. Deploy (`deploy.yml`)
**Trigger**: Manual dispatch, GitHub Release published

- 🚀 Deploys to production server via SSH
- 🔄 Pulls latest code, rebuilds containers
- ❤️ Health check verification

## Setup Required

### For Docker Publish
1. Go to **Settings** → **Actions** → **General**
2. Set **Workflow permissions** to "Read and write permissions"
3. Images will be published to: `ghcr.io/starlight001219/personal-pasteboard`

### For Auto-Deploy
Add these secrets in **Settings** → **Secrets and variables** → **Actions**:

| Secret | Description |
|--------|-------------|
| `DEPLOY_HOST` | Server IP or hostname |
| `DEPLOY_USER` | SSH username |
| `DEPLOY_SSH_KEY` | SSH private key |
| `DEPLOY_PORT` | SSH port (default: 22) |
| `DOMAIN` | Your domain for health check |

## Local Testing

Test the CI workflow locally:
```bash
# Run syntax check
npm run check

# Run tests
npm test

# Build Docker image
docker build -t personal-pasteboard:test .
```

## Manual Deployment

Trigger deployment manually:
1. Go to **Actions** tab
2. Select **Deploy** workflow
3. Click **Run workflow**
4. Select `main` branch
5. Click **Run workflow** button
