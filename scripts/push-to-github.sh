#!/bin/bash
# 初始化 Git 仓库并推送到 GitHub（CI 前置步骤）
# 用法: bash scripts/push-to-github.sh <github-username> <repo-name>
set -e

if [ $# -lt 2 ]; then
  echo "用法: bash scripts/push-to-github.sh <github-username> <repo-name>"
  echo "例:   bash scripts/push-to-github.sh houyawei StickiesIOS"
  exit 1
fi

GH_USER=$1
GH_REPO=$2
cd "$(dirname "$0")/.."

# 1. 初始化仓库（若未 init）
if [ ! -d .git ]; then
  git init
  echo "✅ git init"
fi

# 2. .gitignore（忽略构建产物与依赖）
cat > .gitignore <<'EOF'
node_modules/
build/
dist-app/
.npm-cache/
.spm-checkouts/
.swiftpm-cache/
.mod-cache/
.DS_Store
*.xcuserstate
ios/App/App.xcodeproj/xcuserdata/
EOF
echo "✅ .gitignore 已写"

# 3. 提交
git add -A
git commit -m "Stickies iOS: Capacitor 工程 + CI workflow" 2>/dev/null || echo "(无变更可提交)"

# 4. 添加 remote 并推送
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/$GH_USER/$GH_REPO.git"
git branch -M main

echo ""
echo "=============================================="
echo "请在 GitHub 网页创建仓库: https://github.com/new"
echo "  Repository name: $GH_REPO (Public/Private 均可)"
echo "  创建后回到此终端:"
echo ""
echo "git push -u origin main"
echo ""
echo "然后:"
echo "  1. 打开 https://github.com/$GH_USER/$GH_REPO/actions"
echo "  2. 点击 'Build iOS (Stickies)' workflow → Run workflow"
echo "  3. 若未配置证书 Secrets，产出为未签名 ipa；配置后即为签名版"
echo "=============================================="