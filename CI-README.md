# Stickies iOS 版 CI 云构建 — 使用说明

用 **GitHub Actions（macOS runner + 新版 Xcode）** 在云端编译并签名 iOS 27 真机版，绕过本机 Xcode 15.4 的版本限制。

## 快速开始（3 步）

### 第 1 步：推送工程到 GitHub

```bash
cd /Users/houyawei/Documents/HarnessProject/StickiesIOS
bash scripts/push-to-github.sh <你的GitHub用户名> StickiesIOS
# 按脚本提示，在 GitHub 创建同名仓库后：
git push -u origin main
```

### 第 2 步：配置 Secrets（签名证书，可选）

进入仓库 **Settings → Secrets and variables → Actions → New repository secret**，添加：

| Secret 名 | 内容 | 必需? |
|---|---|---|
| `CERTIFICATE_BASE64` | 开发者证书 .p12 的 base64 | 签名需要 |
| `CERTIFICATE_PASSWORD` | .p12 密码 | 签名需要 |
| `PROVISIONING_PROFILE_BASE64` | 描述文件 .mobileprovision 的 base64 | 签名需要 |
| `TEAM_ID` | Apple 开发者 Team ID（如 ABCDE12345） | 签名需要 |

> **获取 .p12**：钥匙串访问 → 导出您的「Apple Development: xxxx」证书为 .p12
> **获取描述文件**：Apple Developer 后台 → Certificates, Identifiers & Profiles → 下载
> base64 生成：`base64 -i cert.p12 | pbcopy`

### 第 3 步：触发构建

- 打开仓库 **Actions** 页
- 左侧选 **Build iOS (Stickies)** → **Run workflow** → 绿色按钮
- 或直接 push 到 main 自动触发

### 拿到产物

构建完成后，Actions 页面打开本次运行 → 底部 **Artifacts** → 下载 **Stickies-ipa**（含签名的 .ipa）

---

## 两种模式

| 场景 | 行为 |
|---|---|
| **未配 Secrets** | 编译**未签名** ipa（验证流程用） |
| **已配 Secrets** | 自动签名（development profile）→ 可直接装到注册过的 iPhone |

## 常见问题

**Q: 报 `No certificate matching...`？**
A: CERTIFICATE_BASE64 或描述文件与设备/Team 不匹配，检查 Secrets 与证书有效期。

**Q: `.ipa` 能装到 iPhone 吗？**
A: 签名版（development）可装到「描述文件包含的 UDID 设备」。真机系统 iOS 18+/27 需 Xcode 16+（runner 是 macOS 15，默认就是新版，无此限制）。

**Q: 想发 App Store / TestFlight？**
A: 改用 `method: app-store-connect`（ExportOptions）+ Application Loader/Transporter 上传；或加一步 `xcrun altool --upload-app`。

## 工程内文件

```
.github/workflows/build-ios.yml   ← CI 主流程
scripts/push-to-github.sh         ← 一键推送脚本
```

## 安全提示

- Certificate 是敏感凭据：只用 GitHub Secrets 传递，不提交进仓库
- `.gitignore` 已排除 node_modules、build、钥匙串相关文件