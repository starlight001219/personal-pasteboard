#!/usr/bin/env python3
"""
Claude Skill Merger
每天自动合并所有 GitHub Trending skill 文件为一个统一的 Claude skill
"""

import os
import json
from datetime import datetime
from pathlib import Path
import re

# 配置
SKILLS_DIR = Path(__file__).parent.parent.parent / "Claude_技能_Skills" / "github_trending"
OUTPUT_DIR = Path(__file__).parent.parent.parent / "Claude_技能_Skills"
MERGED_SKILL_FILE = OUTPUT_DIR / "github_trending_merged.md"
CLAUDE_SKILL_FILE = OUTPUT_DIR / "claude_github_trending_skill.md"

def read_skill_file(filepath):
    """读取 skill 文件内容"""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return ""

def extract_projects(content):
    """从 skill 内容中提取项目信息"""
    projects = []
    
    # 匹配项目块
    pattern = r"### \d+\. \[(.+?)\]\((.+?)\)\s*\n\n⭐ \*\*(.+?)\*\* stars \| 🍴 (.+?) forks \| 💻 (.+?)\s*\n\n📝 \*\*描述\*\*: (.+?)\s*\n\n🏷️ \*\*标签\*\*: (.+?)\s*\n\n📅 \*\*最后更新\*\*: (.+?)\s*\n\n---"
    
    matches = re.findall(pattern, content, re.DOTALL)
    
    for match in matches:
        project = {
            "name": match[0],
            "url": match[1],
            "stars": match[2],
            "forks": match[3],
            "language": match[4],
            "description": match[5],
            "topics": match[6],
            "updated": match[7]
        }
        projects.append(project)
    
    return projects

def merge_skills():
    """合并所有 skill 文件"""
    print("🔄 开始合并 Claude skill 文件...")
    
    all_projects = {}
    categories = {}
    
    # 扫描所有 skill 文件
    for skill_file in SKILLS_DIR.glob("github_trending_*.md"):
        print(f"  📄 读取: {skill_file.name}")
        
        content = read_skill_file(skill_file)
        projects = extract_projects(content)
        
        # 提取类别名称
        category = skill_file.stem.replace("github_trending_", "")
        categories[category] = len(projects)
        
        # 去重并添加项目
        for project in projects:
            if project["url"] not in all_projects:
                all_projects[project["url"]] = project
    
    print(f"  📊 总计: {len(all_projects)} 个唯一项目")
    
    # 按 star 数排序
    sorted_projects = sorted(
        all_projects.values(),
        key=lambda x: int(x["stars"].replace(",", "")),
        reverse=True
    )
    
    # 生成合并后的 skill 文件
    merged_content = generate_merged_skill(sorted_projects, categories)
    
    # 生成 Claude 专用 skill 文件
    claude_content = generate_claude_skill(sorted_projects, categories)
    
    # 保存文件
    save_file(MERGED_SKILL_FILE, merged_content)
    save_file(CLAUDE_SKILL_FILE, claude_content)
    
    # 生成统计信息
    stats = {
        "merged_at": datetime.now().isoformat(),
        "total_projects": len(sorted_projects),
        "categories": categories,
        "files_merged": [str(f) for f in SKILLS_DIR.glob("github_trending_*.md")],
        "output_files": [str(MERGED_SKILL_FILE), str(CLAUDE_SKILL_FILE)]
    }
    
    stats_file = OUTPUT_DIR / "merge_stats.json"
    save_file(stats_file, json.dumps(stats, indent=2, ensure_ascii=False))
    
    print(f"\n✅ 合并完成！")
    print(f"📊 合并了 {len(sorted_projects)} 个项目")
    print(f"📁 生成文件:")
    print(f"   - {MERGED_SKILL_FILE}")
    print(f"   - {CLAUDE_SKILL_FILE}")
    print(f"   - {stats_file}")
    
    return stats

def generate_merged_skill(projects, categories):
    """生成合并后的 skill 内容"""
    content = f"""# 🌟 GitHub 热门项目汇总

> 自动合并时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
> 项目总数: {len(projects)}
> 分类: {", ".join(categories.keys())}

## 📊 分类统计

"""
    
    for category, count in categories.items():
        emoji = "💻" if "software" in category else "🔒" if "cyber" in category else "⚙️"
        content += f"- {emoji} **{category.replace('_', ' ').title()}**: {count} 个项目\n"
    
    content += f"""

## 🏆 Top {min(20, len(projects))} 热门项目

| # | 项目 | Star | 语言 | 说明 |
|---|------|------|------|------|
"""
    
    for i, project in enumerate(projects[:20], 1):
        content += f"| {i} | [{project['name']}]({project['url']}) | ⭐ {project['stars']} | {project['language']} | {project['description'][:50]}... |\n"
    
    content += f"""

## 📋 完整项目列表

"""
    
    for i, project in enumerate(projects, 1):
        content += f"""### {i}. [{project['name']}]({project['url']})

⭐ **{project['stars']}** stars | 🍴 {project['forks']} forks | 💻 {project['language']}

📝 {project['description']}

🏷️ {project['topics']}

📅 更新: {project['updated']}

---

"""
    
    content += f"""
## 📚 学习建议

### 快速入门路径

1. **选择方向**: 软件开发 / 网络安全 / DevOps
2. **从 Top 5 开始**: 选择 star 数最高的项目
3. **阅读文档**: 仔细阅读 README 和文档
4. **动手实践**: 克隆项目，运行示例代码
5. **贡献代码**: 尝试提交 PR

### 推荐学习顺序

#### 网络安全
1. OWASP/CheatSheetSeries (安全基础)
2. mitmproxy/mitmproxy (Web 安全)
3. sherlock-project/sherlock (信息收集)
4. x64dbg/x64dbg (逆向工程)
5. KeygraphHQ/shannon (渗透测试)

#### 软件开发
1. EbookFoundation/free-programming-books (学习资源)
2. vinta/awesome-python (Python 生态)
3. facebook/react (前端开发)
4. trekhleb/javascript-algorithms (算法)
5. public-apis/public-apis (API 集成)

---

*此文件由 Claude Skill Merger 自动生成*
"""
    
    return content

def generate_claude_skill(projects, categories):
    """生成 Claude 专用 skill 内容"""
    content = f"""# Claude GitHub Trending Skill

## 概述

这是一个自动更新的 Claude skill，包含 GitHub 上最热门的开源项目信息。

**最后更新**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
**项目总数**: {len(projects)}

## 使用方法

### 网络安全相关问题

当用户询问网络安全相关问题时，可以参考以下项目：

"""
    
    # 网络安全项目
    cyber_projects = [p for p in projects if any(t in p["topics"].lower() for t in ["security", "cyber", "pentest", "ctf", "forensic"])]
    
    for project in cyber_projects[:10]:
        content += f"""#### {project['name']} (⭐ {project['stars']})
- **用途**: {project['description']}
- **语言**: {project['language']}
- **链接**: {project['url']}

"""
    
    content += """### 软件开发相关问题

当用户询问软件开发相关问题时，可以参考以下项目：

"""
    
    # 软件开发项目
    dev_projects = [p for p in projects if any(t in p["topics"].lower() for t in ["web", "api", "framework", "library", "python", "javascript"])]
    
    for project in dev_projects[:10]:
        content += f"""#### {project['name']} (⭐ {project['stars']})
- **用途**: {project['description']}
- **语言**: {project['language']}
- **链接**: {project['url']}

"""
    
    content += f"""## 项目分类

### 按 Star 数排序 (Top 10)

"""
    
    for i, project in enumerate(projects[:10], 1):
        content += f"{i}. **{project['name']}** - ⭐ {project['stars']} stars\n"
    
    content += f"""

### 按类别统计

"""
    
    for category, count in categories.items():
        content += f"- **{category.replace('_', ' ').title()}**: {count} 个项目\n"
    
    content += f"""

## 常见问题解答

### Q: 如何开始学习网络安全？

**A**: 建议从以下项目开始：
1. 阅读 OWASP/CheatSheetSeries 了解安全基础
2. 安装 mitmproxy 学习 Web 安全测试
3. 使用 sherlock 练习信息收集
4. 参加 CTF 比赛 (参考 x64dbg)

### Q: 如何开始学习 Python Web 开发？

**A**: 建议学习路径：
1. 阅读 vinta/awesome-python 了解 Python 生态
2. 学习 FastAPI 或 Django 框架
3. 使用 public-apis 练习 API 集成
4. 构建自己的 Web 项目

### Q: 有哪些好的免费学习资源？

**A**: 推荐：
- EbookFoundation/free-programming-books (编程书籍)
- public-apis/public-apis (API 学习)
- trekhleb/javascript-algorithms (算法学习)

## 更新频率

此 skill 每天自动更新，包含最新的 GitHub 热门项目。

---

*此文件由 Claude Skill Merger 自动生成，供 Claude Code 使用*
"""
    
    return content

def save_file(filepath, content):
    """保存文件"""
    try:
        filepath.parent.mkdir(parents=True, exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"  ✅ 已保存: {filepath}")
    except Exception as e:
        print(f"  ❌ 保存失败 {filepath}: {e}")

def main():
    """主函数"""
    print("=" * 60)
    print("🤖 Claude Skill Merger")
    print("=" * 60)
    print()
    
    stats = merge_skills()
    
    print("\n" + "=" * 60)
    print("📊 合并统计")
    print("=" * 60)
    print(f"✅ 总项目数: {stats['total_projects']}")
    print(f"📁 合并文件数: {len(stats['files_merged'])}")
    print(f"📄 输出文件数: {len(stats['output_files'])}")
    print(f"⏰ 合并时间: {stats['merged_at']}")
    
    return stats

if __name__ == "__main__":
    main()
