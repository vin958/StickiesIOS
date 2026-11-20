#!/bin/bash
# 签名材料准备脚本：把本地证书/描述文件转换成 GitHub Secrets 需要的格式
# 用法:
#   bash scripts/signing-setup.sh cert      # 导出证书为 .p12 并生成 base64
#   bash scripts/signing-setup.sh profile   # 描述文件转 base64
#   bash scripts/signing-setup.sh teamid    # 从描述文件提取 TEAM_ID
set -e
cd "$(dirname "$0")/.."
mkdir -p build/signing

case "${1:-help}" in
  cert)
    echo "=============================================="
    echo "步骤 1/3: 导出 Apple 开发证书为 .p12"
    echo "=============================================="
    echo "请先在钥匙串访问(App)中:"
    echo "  1. 打开 钥匙串访问"
    echo "  2. 登录 钥匙串 → 我的证书"
    echo "  3. 找到 'Apple Development: 你的名字 (XXXX)'"
    echo "  4. 右键 → 导出 'Apple Development...'"
    echo "  5. 保存为 build/signing/developer.p12（设一个密码）"
    echo ""
    read -p "已完成导出？输入 .p12 文件路径（回车默认 build/signing/developer.p12）: " P12
    P12="${P12:-build/signing/developer.p12}"
    if [ ! -f "$P12" ]; then echo "❌ 找不到 $P12"; exit 1; fi
    read -s -p "输入 .p12 的密码: " P12PW; echo ""
    # 生成 base64
    base64 -i "$P12" > build/signing/CERTIFICATE_BASE64.txt
    echo "CERTIFICATE_PASSWORD: $P12PW" > build/signing/secrets-note.txt
    echo ""
    echo "✅ 已生成: build/signing/CERTIFICATE_BASE64.txt (内容即 CERTIFICATE_BASE64)"
    echo "✅ 密码见:  build/signing/secrets-note.txt (CERTIFICATE_PASSWORD)"
    ;;
  profile)
    echo "=============================================="
    echo "步骤 2/3: 描述文件转 base64"
    echo "=============================================="
    echo "请在 Apple Developer 后台下载描述文件(Development):"
    echo "  https://developer.apple.com/account/resources/profiles"
    echo "  或 Xcode: Window → Devices → 右键设备 → Show Provisioning Profiles"
    read -p "描述文件 .mobileprovision 路径: " PROF
    if [ ! -f "$PROF" ]; then echo "❌ 找不到 $PROF"; exit 1; fi
    base64 -i "$PROF" > build/signing/PROVISIONING_PROFILE_BASE64.txt
    echo "✅ 已生成: build/signing/PROVISIONING_PROFILE_BASE64.txt"
    ;;
  teamid)
    echo "=============================================="
    echo "步骤 3/3: 提取 TEAM_ID（可自动）"
    echo "=============================================="
    read -p "描述文件路径: " PROF
    PROF="${PROF:-build/signing/Stickies.mobileprovision}"
    if [ ! -f "$PROF" ]; then echo "❌ 找不到 $PROF"; exit 1; fi
    # 描述文件是 CMS 签名，解出 plist
    security cms -D -i "$PROF" > build/signing/profile.plist 2>/dev/null || \
      openssl smime -inform DER -verify -noverify -in "$PROF" -out build/signing/profile.plist 2>/dev/null
    TEAM=$(/usr/libexec/PlistBuddy -c "Print :TeamIdentifier:0" build/signing/profile.plist 2>/dev/null || \
           /usr/libexec/PlistBuddy -c "Print :TeamName" build/signing/profile.plist 2>/dev/null || echo "N/A")
    echo "✅ TEAM_ID: $TEAM"
    echo "TEAM_ID: $TEAM" >> build/signing/secrets-note.txt
    ;;
  help|*)
    echo "用法: bash scripts/signing-setup.sh [cert|profile|teamid]"
    echo "  cert    → 导出证书为 p12 并生成 CERTIFICATE_BASE64"
    echo "  profile → 描述文件转 PROVISIONING_PROFILE_BASE64"
    echo "  teamid  → 从描述文件提取 TEAM_ID"
    ;;
esac
echo ""
echo "生成后到 GitHub 仓库 Settings → Secrets and variables → Actions → New repository secret 添加:"