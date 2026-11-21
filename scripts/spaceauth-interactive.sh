#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# fastlane spaceauth —— 手动 2FA 登录，产出 FASTLANE_SESSION
#
# 用法（请在你自己的 Terminal 里跑，这样密码和验证码都不经过任何日志）：
#   cd ~/Documents/HarnessProject/StickiesIOS
#   ./scripts/spaceauth-interactive.sh
#
# 产物：
#   /tmp/spaceauth_session.txt                    ← FASTLANE_SESSION 字符串（chmod 600）
#   ~/.fastlane/spaceship/<email>/cookie          ← fastlane 自动缓存的 cookie
#
# 登录成功后可以：
#   gh secret set FASTLANE_SESSION < /tmp/spaceauth_session.txt   # 存进 GitHub
#   export FASTLANE_SESSION="$(cat /tmp/spaceauth_session.txt)"   # 本机立即使用
#
# 实现要点：
#   - session 从 cookie 文件转换而来，而不是解析 stdout
#     （stdout 那行带 ANSI 颜色码，直接 grep 会污染 session）
#   - 转换逻辑与 fastlane 官方 spaceauth_runner.rb:42-49 完全一致
#   - FASTLANE_USER / FASTLANE_PASSWORD 可跳过用户名密码提问
# ─────────────────────────────────────────────────────────────────────────────
set -u

APPLE_ID="${APPLE_ID:-houyawei@aliyun.com}"
RUBY_HOME="/tmp/pruby/portable-ruby/3.4.6"
SESSION_FILE="/tmp/spaceauth_session.txt"
LOG_FILE="/tmp/spaceauth_log.txt"
COOKIE_FILE="$HOME/.fastlane/spaceship/$APPLE_ID/cookie"

if [ ! -x "$RUBY_HOME/bin/ruby" ]; then
  echo "✗ 找不到 portable-ruby：$RUBY_HOME/bin/ruby"
  echo "  下载：https://github.com/Homebrew/homebrew-portable-ruby/releases/tag/3.4.6"
  echo "  （选 portable-ruby-3.4.6.el_capiton.bottle.tar.gz）"
  exit 1
fi

export PATH="$RUBY_HOME/bin:$PATH"
export GEM_HOME="$RUBY_HOME/lib/ruby/gems/3.4.0"
export GEM_PATH="$GEM_HOME"

echo "======================================================================"
echo " fastlane spaceauth —— 手动 2FA 登录"
echo "======================================================================"
echo
echo "Apple ID : $APPLE_ID"
echo "Ruby     : $("$RUBY_HOME/bin/ruby" -v)"
echo
echo "接下来会提示你输入密码（不回显），以及 2FA 验证码。"
echo "验证码会推送到受信任设备，或以短信形式发送。"
echo "没收到 → https://iforgot.apple.com/password"
echo

# ── 可选：用环境变量提供密码，跳过提问 ───────────────────────────────────
if [ -t 0 ]; then
  read -r -s -p "Apple ID 密码（不回显，直接回车则让 fastlane 自己问）：" FL_PASSWORD
  echo
  if [ -n "$FL_PASSWORD" ]; then
    export FASTLANE_USER="$APPLE_ID"
    export FASTLANE_PASSWORD="$FL_PASSWORD"
    echo "已通过环境变量提供凭据。"
    echo
  fi
fi

# ── 运行 spaceauth ────────────────────────────────────────────────────────
echo "----------------------------------------------------------------------"
echo "开始登录……"
echo "----------------------------------------------------------------------"
echo

# 有 TTY 就直接跑；没有就用 script 分配伪终端（保证 highline 的 ask/choose 能工作）
if [ -t 1 ]; then
  fastlane spaceship spaceauth --copy_to_clipboard false 2>&1 | tee "$LOG_FILE"
else
  script -q /dev/null fastlane spaceship spaceauth --copy_to_clipboard false 2>&1 | tee "$LOG_FILE"
fi

echo
echo "======================================================================"

# ── cookie 文件 → session 字符串 ─────────────────────────────────────────
# 严格复刻 fastlane/spaceship/lib/spaceship/spaceauth_runner.rb:42-49
SESSION=""
if [ -f "$COOKIE_FILE" ]; then
  SESSION=$("$RUBY_HOME/bin/ruby" -ryaml -rhttp-cookie -e '
    content = File.read(ARGV[0])
    cookies = YAML.safe_load(content, permitted_classes: [HTTP::Cookie, Time], aliases: true)
    cookies.select! { |c|
      c.name.start_with?("myacinfo") || c.name == "dqsid" || c.name.start_with?("DES")
    }
    print cookies.to_yaml.gsub("\n", "\\n")
  ' "$COOKIE_FILE" 2>/dev/null)
fi

# 兜底：从 stdout 抓（需要去掉 ANSI 颜色码）
if [ -z "$SESSION" ] || [ ${#SESSION} -lt 50 ]; then
  SESSION=$(sed -e 's/\x1b\[[0-9;]*m//g' "$LOG_FILE" \
            | grep -m1 "export FASTLANE_SESSION=" \
            | sed -e "s/^.*export FASTLANE_SESSION='//" -e "s/'$//")
fi

if [ -z "$SESSION" ] || [ ${#SESSION} -lt 50 ]; then
  echo " ✗ 没有拿到 session。日志： $LOG_FILE"
  echo
  echo "常见原因："
  echo "  · 密码是 app-specific 密码（xxxx-xxxx-xxxx-xxxx）"
  echo "    → Apple 网页登录不接受它，必须用【真实密码】"
  echo "  · 账号没开启 2FA → https://account.apple.com"
  echo "  · 该 Apple ID 没有受信任设备 → 在 iPhone 上登录一次即可"
  echo
  exit 1
fi

printf '%s' "$SESSION" > "$SESSION_FILE"
chmod 600 "$SESSION_FILE"

echo " ✓ 登录成功！"
echo
echo " session 文件  : $SESSION_FILE   (chmod 600, ${#SESSION} 字符)"
echo " cookie 缓存   : $COOKIE_FILE"
echo
echo "======================================================================"
echo " 接下来（在同一台机器的 Terminal 里执行）"
echo "======================================================================"
echo
echo "  # 存进 GitHub Secret（推荐，不经过聊天记录）"
echo "  gh secret set FASTLANE_SESSION < $SESSION_FILE"
echo
echo "  # 本机立即使用"
echo "  export FASTLANE_SESSION=\"\$(cat $SESSION_FILE)\""
echo
