/**
 * 构建脚本 —— 把 src 的便签渲染层素材复制进 www（Capacitor webDir）
 * 用 node 完成，避免额外构建工具依赖
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src');
const www = path.join(__dirname, '..', 'www');

// 确保 www 存在
fs.mkdirSync(www, { recursive: true });

// 复制静态素材（保留作为参考源，实际 UI 由 www/index.html + www/app.js 提供）
for (const f of ['source-stickie.html', 'source-stickie.js']) {
  const from = path.join(src, f);
  const to = path.join(www, f);
  if (fs.existsSync(from)) {
    fs.copyFileSync(from, to);
    console.log('copied:', f);
  }
}

console.log('✅ www 构建完成');