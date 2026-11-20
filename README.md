# Stickies iOS 版（Capacitor）

基于 [Stickies 逆向研究报告](../Stickies-逆向研究报告.md) 触屏适配的 iPhone 便签应用。
复用桌面版（Electron）的渲染层视觉语言（6 色便签、脊部、黄色主体），改造为 iPhone 单屏交互。

## ⚠️ 当前环境限制（诚实声明）

**本机无完整 Xcode**（仅 Command Line Tools），因此：
- ✅ 已完成：完整可编译的 **Capacitor iOS 工程源码**
- ✅ 已完成：iOS 原生工程（`ios/App/App.xcodeproj`）生成 + Web 资源同步
- ❌ 未完成：**实际编译出 .ipa**（需要装有 Xcode 的 Mac 执行编译；本机无法验证真机运行）

> 需要一台装有 Xcode 的 Mac（或 CI 云编译如 GitHub Actions + macOS runner）来完成 .ipa 构建与上真机。

## 在装有 Xcode 的 Mac 上运行

```bash
cd StickiesIOS
npm install
# 1. 构建 web 资源 + 同步到 iOS 工程
npm run sync
# 2. 打开 Xcode 工程
npm run open:ios
#    用 Xcode 打开 ios/App/App.xcodeproj
#    选择你的开发团队（Signing & Capabilities）→ 选真机或模拟器 → Cmd+R
```

## 编译成 .ipa（分发）

```bash
# 在 Xcode 中选择 "Any iOS Device (arm64)" → Product > Archive
# 或用命令行：
xcodebuild -workspace ios/App/App.xcworkspace \
  -scheme App -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath build/Stickies.xcarchive archive
# 导出 .ipa（需 Apple Developer 证书）
```

## 部署方式选择

| 方式 | 要求 | 说明 |
|---|---|---|
| **Xcode 真机调试** | 免费 Apple ID + 数据线 | 最快上手，覆约 7 天签名期 |
| **TestFlight** | 付费开发者账号 (¥688/年) | 内测分发，最多 90 天外部测试 |
| **App Store** | 付费账号 + 审核 | 正式发布 |

## 工程结构

```
StickiesIOS/
├── capacitor.config.json     Capacitor 配置（appId/appName/webDir）
├── www/                       触屏版便签墙 web 资源
│   ├── index.html             便签墙 + 全屏编辑 UI
│   └── app.js                 便签 CRUD + Capacitor Preferences 存储
├── src/                       从 Electron 复刻拷贝的源素材（参考）
├── scripts/build-www.js       web 构建脚本
└── ios/                       Capacitor 生成的 Xcode 工程
    └── App/App.xcodeproj       ← 用 Xcode 打开这个
```

## iOS 版功能（触屏适配）

| 功能 | 实现 |
|---|---|
| 便签墙（双列网格） | 卡片式展示，6 色区分 |
| 新建便签 | 底部 ➕ 浮动按钮 |
| 编辑便签 | 全屏编辑器 + 颜色选择 + 标题/正文 |
| 删除 | 顶部 ✏️ 进入整理模式 → 卡片右上 ✕ |
| 搜索 | 顶部 🔍 按标题/内容过滤 |
| 持久化 | Capacitor Preferences（原生存储） |

## 与桌面版关系

- **共享设计语言**：6 色 × 命名、脊部视觉、便签卡片（fnd_5/24）
- **交互差异**：桌面有窗口/折叠/置顶/半透明（鼠标隐喻）；iPhone 改为卡片墙 + 全屏编辑（触屏隐喻）
- **数据格式**：字段对齐（uuid/colorKey/title/text），JSON 存储（iOS 无沙盒外 plist 路径，可用 Preferences 键值对）

## 后续可做

- [ ] 在 Xcode 环境编译验证 + 真机测试
- [ ] iCloud 同步（NSUbiquitousKeyValueStore / Capacitor 社区插件）
- [ ] 通知/小组件
- [ ] iPad 适配（多列）
- [ ] 桌面↔iOS 数据互通（同一格式 JSON/plist）