# 🤖 GitHub Trending Skills Scanner

自动搜索 GitHub 上软件开发和网络安全的高星项目，生成 Claude Code skill。

## 📋 功能特性

### 搜索类别

1. **💻 软件开发**
   - Web 开发
   - API 开发
   - 框架
   - Python/JavaScript/TypeScript 项目

2. **🔒 网络安全**
   - 安全工具
   - 渗透测试
   - CTF 资源
   - 漏洞研究

3. **⚙️ DevOps**
   - Docker
   - Kubernetes
   - CI/CD
   - 基础设施

### 自动化流程

```
每天 UTC 00:00 (北京时间 08:00)
        ↓
搜索 GitHub 高星项目 (最小 500 stars)
        ↓
生成 Claude Code skill 文件
        ↓
创建 Pull Request
        ↓
合并到 main 分支
        ↓
Claude Code 自动加载新 skill
```

## 🚀 使用方法

### 自动运行

工作流会每天自动运行，无需手动操作。

### 手动触发

1. 访问 [Actions](../../actions/workflows/trending-skills.yml)
2. 点击 "Run workflow"
3. 可选：调整最小 star 数阈值
4. 点击 "Run workflow" 按钮

### 本地运行

```bash
cd scripts/github-skills

# 安装依赖
pip install -r requirements.txt

# 设置 GitHub Token (可选，提高 API 限额)
export GITHUB_TOKEN=your_token_here

# 运行扫描
python search_trending.py
```

## 📁 输出文件

扫描结果保存在：

```
Claude_技能_Skills/
└── github_trending/
    ├── github_trending_software_development.md
    ├── github_trending_cybersecurity.md
    ├── github_trending_devops.md
    └── scan_summary.json
```

### Skill 文件格式

每个 skill 文件包含：

- 📊 项目列表（名称、star 数、描述）
- 🏷️ 项目标签
- 📅 更新时间
- 📚 学习建议
- 🔗 相关资源

## ⚙️ 配置

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `GITHUB_TOKEN` | GitHub API Token | 空（可选） |

### 参数调整

编辑 `search_trending.py` 中的配置：

```python
MIN_STARS = 500  # 最小 star 数
MAX_PROJECTS_PER_CATEGORY = 10  # 每个类别最多项目数
```

## 📊 示例输出

### 扫描摘要

```json
{
  "generated_at": "2026-06-01T00:00:00",
  "categories": {
    "software_development": 10,
    "cybersecurity": 10,
    "devops": 10
  },
  "total_projects": 30,
  "files_created": [
    "Claude_技能_Skills/github_trending/github_trending_software_development.md",
    "Claude_技能_Skills/github_trending/github_trending_cybersecurity.md",
    "Claude_技能_Skills/github_trending/github_trending_devops.md"
  ]
}
```

## 🔧 GitHub Token

虽然不强制要求，但设置 GitHub Token 可以：

- ✅ 提高 API 请求限额（从 10 次/分钟到 30 次/分钟）
- ✅ 访问私有仓库（如果需要）
- ✅ 避免速率限制

### 如何获取 Token

1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token"
3. 选择权限：
   - ✅ `repo` (如果需要访问私有仓库)
   - ✅ `read:org` (可选)
4. 复制 token

### 添加到 GitHub Secrets

1. 访问仓库 Settings → Secrets and variables → Actions
2. 点击 "New repository secret"
3. 名称：`GITHUB_TOKEN`
4. 值：你的 token
5. 点击 "Add secret"

**注意**: GitHub Actions 会自动提供 `GITHUB_TOKEN`，通常无需手动设置。

## 📈 使用场景

### 1. 学习新技术

- 发现热门开源项目
- 学习最佳实践
- 了解行业趋势

### 2. 项目灵感

- 寻找项目创意
- 学习项目架构
- 分析代码质量

### 3. 贡献开源

- 找到 "Good First Issues"
- 学习贡献流程
- 建立开源履历

### 4. 技术面试

- 研究常见项目
- 学习设计模式
- 准备技术讨论

## 🎯 下一步

1. **添加更多类别**: 机器学习、区块链、移动开发等
2. **智能推荐**: 基于用户兴趣推荐项目
3. **自动摘要**: 使用 AI 生成项目摘要
4. **趋势分析**: 跟踪项目热度变化

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

*自动更新，每天为你发现最优质的开源项目！* 🚀
