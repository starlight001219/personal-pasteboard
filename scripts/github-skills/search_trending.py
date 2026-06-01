#!/usr/bin/env python3
"""
GitHub Trending Projects Scanner
每天搜索 GitHub 上软件开发和网络安全的高星项目，生成 Claude Code skill
"""

import os
import json
import requests
from datetime import datetime, timedelta
from pathlib import Path

# 配置
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
OUTPUT_DIR = Path(__file__).parent.parent.parent / "Claude_技能_Skills" / "github_trending"
MIN_STARS = 500
MAX_PROJECTS_PER_CATEGORY = 10

# 搜索类别
CATEGORIES = {
    "software_development": {
        "name": "软件开发",
        "queries": [
            "stars:>500 topic:web-development",
            "stars:>500 topic:api",
            "stars:>500 topic:framework",
            "stars:>500 language:python stars:>1000",
            "stars:>500 language:javascript stars:>1000",
        ],
        "topics": ["web-development", "api", "framework", "backend", "frontend"]
    },
    "cybersecurity": {
        "name": "网络安全",
        "queries": [
            "stars:>500 topic:security",
            "stars:>500 topic:cybersecurity",
            "stars:>500 topic:penetration-testing",
            "stars:>500 topic:ctf",
        ],
        "topics": ["security", "cybersecurity", "penetration-testing", "ctf"]
    },
    "devops": {
        "name": "DevOps",
        "queries": [
            "stars:>500 topic:devops",
            "stars:>500 topic:docker",
            "stars:>500 topic:kubernetes",
        ],
        "topics": ["devops", "docker", "kubernetes"]
    }
}

def get_headers():
    """获取 GitHub API 请求头"""
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "GitHub-Trending-Scanner"
    }
    if GITHUB_TOKEN:
        headers["Authorization"] = f"token {GITHUB_TOKEN}"
    return headers

def search_repos(query, sort="stars", order="desc", per_page=20):
    """搜索 GitHub 仓库"""
    url = "https://api.github.com/search/repositories"
    params = {
        "q": query,
        "sort": sort,
        "order": order,
        "per_page": per_page
    }
    
    try:
        response = requests.get(url, headers=get_headers(), params=params, timeout=30)
        response.raise_for_status()
        return response.json().get("items", [])
    except Exception as e:
        print(f"Search failed: {query} - {e}")
        return []

def get_trending_repos(category, days_back=7):
    """获取某个类别的热门项目"""
    all_repos = {}
    date_from = (datetime.now() - timedelta(days=days_back)).strftime("%Y-%m-%d")
    
    for query in CATEGORIES[category]["queries"]:
        full_query = f"{query} pushed:>{date_from}"
        repos = search_repos(full_query)
        
        for repo in repos:
            repo_id = repo["id"]
            if repo_id not in all_repos:
                all_repos[repo_id] = repo
    
    sorted_repos = sorted(all_repos.values(), key=lambda x: x["stargazers_count"], reverse=True)
    return sorted_repos[:MAX_PROJECTS_PER_CATEGORY]

def generate_skill_content(category, repos):
    """生成 skill 文件内容"""
    category_info = CATEGORIES[category]
    
    content = f"""# 🌟 GitHub 热门项目 - {category_info["name"]}

> 自动生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
> 最小 Star 数: {MIN_STARS}
> 更新周期: 每天

## 📊 热门项目列表

"""
    
    for i, repo in enumerate(repos, 1):
        stars = repo["stargazers_count"]
        forks = repo["forks_count"]
        language = repo.get("language", "N/A")
        description = repo.get("description", "暂无描述") or "暂无描述"
        topics = ", ".join(repo.get("topics", [])[:5]) or "N/A"
        url = repo["html_url"]
        updated_at = repo["updated_at"][:10]
        
        content += f"""### {i}. [{repo["full_name"]}]({url})

⭐ **{stars:,}** stars | 🍴 {forks:,} forks | 💻 {language}

📝 **描述**: {description}

🏷️ **标签**: {topics}

📅 **最后更新**: {updated_at}

---

"""
    
    content += f"""
## 📚 学习建议

### 如何使用这些项目

1. **阅读源代码**: 克隆仓库，仔细阅读项目结构和核心代码
2. **查看文档**: 阅读 README、Wiki 和项目文档
3. **运行示例**: 尝试运行项目中的示例代码
4. **贡献代码**: 尝试提交 PR，修复 bug 或添加功能
5. **学习模式**: 分析项目的设计模式和架构

### 推荐学习路径

#### {category_info["name"]} 入门
1. 从 star 数最高的项目开始
2. 查看项目的 "Good First Issues"
3. 阅读项目的贡献指南
4. 参与社区讨论

## 🔗 相关资源

- [GitHub Topics](https://github.com/topics)
- [GitHub Trending](https://github.com/trending)

## 📖 更新日志

- {datetime.now().strftime("%Y-%m-%d")}: 自动更新 {len(repos)} 个项目

---

*此文件由 GitHub Trending Scanner 自动生成*
"""
    
    return content

def create_skill_file(category, content):
    """创建 skill 文件"""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    filename = f"github_trending_{category}.md"
    filepath = OUTPUT_DIR / filename
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    
    print(f"✅ Created: {filepath}")
    return filepath

def main():
    """主函数"""
    print("🔍 开始搜索 GitHub 热门项目...")
    print(f"📊 最小 Star 数: {MIN_STARS}")
    print(f"📁 输出目录: {OUTPUT_DIR}")
    print()
    
    all_results = {}
    
    for category in CATEGORIES:
        cat_name = CATEGORIES[category]["name"]
        print(f"\n🔎 搜索类别: {cat_name}")
        repos = get_trending_repos(category)
        
        if repos:
            all_results[category] = {
                "repos": repos,
                "content": generate_skill_content(category, repos)
            }
            print(f"  找到 {len(repos)} 个项目")
        else:
            print(f"  ⚠️ 未找到符合条件的项目")
    
    print("\n📝 生成 skill 文件...")
    
    created_files = []
    for category, data in all_results.items():
        filepath = create_skill_file(category, data["content"])
        created_files.append(filepath)
    
    summary = {
        "generated_at": datetime.now().isoformat(),
        "categories": {cat: len(data["repos"]) for cat, data in all_results.items()},
        "total_projects": sum(len(data["repos"]) for data in all_results.values()),
        "files_created": [str(f) for f in created_files]
    }
    
    summary_file = OUTPUT_DIR / "scan_summary.json"
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ 扫描完成！")
    print(f"📊 共找到 {summary["total_projects"]} 个热门项目")
    print(f"📁 生成 {len(created_files)} 个 skill 文件")
    print(f"📄 汇总报告: {summary_file}")
    
    return summary

if __name__ == "__main__":
    main()
