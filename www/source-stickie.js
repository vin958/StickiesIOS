/* ============================================================
 * 便签渲染进程 —— 每张便签窗口加载此页面
 * 交互复刻（对照逆向研究报告）：
 * - 脊部：双击折叠/展开（fnd_9/14）、单击拖拽移动窗口
 * - 三按钮：close/zoom(折叠切换)/collapse（fnd_13）
 * - 失焦透脊：窗口失去焦点时脊部透明 + 按钮隐藏（fnd_15）
 * - 颜色：6 色 × 4 态（fnd_5/24）
 * - 置顶/半透明（fnd_8）
 * - 模板：编辑 → 防抖保存到 <uuid>.rtfd/TXT.rtf（fnd_3）
 * - 查找/替换：⌘F 面板（fnd_16/19）、跨窗口高亮
 * ============================================================ */
const params = new URLSearchParams(location.search);
const UUID = params.get('uuid') || 'UNDEFINED';
const initialColor = params.get('color') || 'yellow';
const initialContent = (params.get('content') || '').replace(/\\n/g, '\n');
const translucent = params.get('translucent') === '1';

const COLORS = {
  yellow: { key:'yellow', name:'黄',  sticky:'#FDAF3C', spine:'#FFEDBE', highlight:'#FFE9C9', control:'#f8d67a' },
  blue:   { key:'blue',   name:'蓝',  sticky:'#5AC8FA', spine:'#B9E9FF', highlight:'#A0DCFF', control:'#7FD4FF' },
  green:  { key:'green',  name:'绿',  sticky:'#63D98A', spine:'#CEF5D9', highlight:'#B9EFC8', control:'#8FE6A8' },
  pink:   { key:'pink',   name:'粉',  sticky:'#FF9EB5', spine:'#FFD9E0', highlight:'#FFC7D2', control:'#FFB3C2' },
  purple: { key:'purple', name:'紫',  sticky:'#B78EFF', spine:'#E0D1FF', highlight:'#D3BCFF', control:'#C5A6FF' },
  gray:   { key:'gray',   name:'灰',  sticky:'#8E8E93', spine:'#D8D8DC', highlight:'#C7C7CC', control:'#AFB0B5' },
};

let currentColor = initialColor;
let saveTimer = null;

// 主体元素
const root = document.getElementById('stickie');
const spine = document.getElementById('spine');
const body = document.getElementById('body');
const editor = document.getElementById('editor');
const titleInput = document.getElementById('title');
const closeBtn = document.getElementById('btnClose');
const zoomBtn = document.getElementById('btnZoom');
const collapseBtn = document.getElementById('btnCollapse');
const toolbar = document.getElementById('toolbar');

// 查找面板
const findPanel = document.getElementById('findPanel');
const findInput = document.getElementById('findInput');
const replaceInput = document.getElementById('replaceInput');
const findPrevBtn = document.getElementById('findPrev');
const findNextBtn = document.getElementById('findNext');
const findReplaceBtn = document.getElementById('findReplace');
const findReplaceAllBtn = document.getElementById('findReplaceAll');
const findCloseBtn = document.getElementById('findClose');
const findScopeAll = document.getElementById('findScopeAll');
const findStatus = document.getElementById('findStatus');

// ─── 初始化 ─────────────────────────────────
applyColor(currentColor);
if (initialContent) editor.innerHTML = initialContent;
titleInput.textContent = '便签 ' + (UUID.slice(0, 4) || '');
document.title = '便签';
window.stickie.titleChanged(titleInput.textContent);

if (translucent) {
  document.body.classList.add('translucent');
  document.getElementById('btnGlass').classList.add('on');
}

// 失焦处理（fnd_15）
window.addEventListener('blur', () => { document.body.classList.add('inactive'); spine.classList.add('inactive'); });
window.addEventListener('focus', () => {
  document.body.classList.remove('inactive');
  spine.classList.remove('inactive');
});
setTimeout(() => { if (!document.hasFocus()) document.body.classList.add('inactive'); }, 400);

// ─── 颜色 ───────────────────────────────────
function applyColor(key) {
  const c = COLORS[key] || COLORS.yellow;
  currentColor = c.key;
  root.style.background = c.sticky;
  spine.style.background = c.spine;
  editor.style.background = c.highlight;
  document.documentElement.style.setProperty('--ctl', c.control);
  document.querySelectorAll('.swatch').forEach(s => s.classList.toggle('on', s.dataset.color === key));
  window.stickie.changeColor({ uuid: UUID, colorKey: key });
}

const swatches = document.getElementById('swatches');
Object.entries(COLORS).forEach(([key, c]) => {
  const s = document.createElement('div');
  s.className = 'swatch' + (key === currentColor ? ' on' : '');
  s.style.background = c.sticky;
  s.dataset.color = key;
  s.title = c.name;
  s.addEventListener('click', () => applyColor(key));
  swatches.appendChild(s);
});

// ─── 折叠（fnd_14）──────────────────────────
function isCollapsed() { return document.body.classList.contains('collapsed'); }
function toggleCollapse() {
  document.body.classList.toggle('collapsed');
  window.resizeTo(window.outerWidth, isCollapsed() ? 34 : 260);
}
spine.addEventListener('dblclick', e => {
  if (e.target.closest('.ctrl') || e.target.closest('button')) return;
  toggleCollapse();
});

closeBtn.addEventListener('click', () => { saveNow(); window.close(); });
zoomBtn.addEventListener('click', toggleCollapse);
collapseBtn.addEventListener('click', toggleCollapse);

// ─── 工具栏 ─────────────────────────────────
toolbar.addEventListener('mouseenter', () => toolbar.classList.add('show'));
toolbar.addEventListener('mouseleave', () => toolbar.classList.remove('show'));

document.getElementById('btnPin').addEventListener('click', e => {
  const on = e.currentTarget.classList.toggle('on');
  window.stickie.setFloating({ uuid: UUID, floating: on });
});
document.getElementById('btnGlass').addEventListener('click', e => {
  const on = e.currentTarget.classList.toggle('on');
  window.stickie.setTranslucent({ uuid: UUID, translucent: on });
});
document.getElementById('btnStrike').addEventListener('click', () => {
  const sel = window.getSelection();
  if (!sel.rangeCount || !editor.contains(sel.anchorNode)) return;
  const range = sel.getRangeAt(0);
  const span = document.createElement('span');
  span.style.textDecoration = 'line-through';
  try { range.surroundContents(span); } catch {}
});

// ─── 拖拽移动 ───────────────────────────────
let dragging = false, dragOff = { x: 0, y: 0 };
spine.addEventListener('mousedown', e => {
  if (e.target.closest('.ctrl') || e.target.closest('button') || e.target.closest('input')) return;
  dragging = true;
  dragOff = { x: e.screenX - window.screenX, y: e.screenY - window.screenY };
  e.preventDefault();
});
window.addEventListener('mousemove', e => {
  if (!dragging) return;
  window.moveTo(e.screenX - dragOff.x, e.screenY - dragOff.y);
  window.stickie.moved({ x: window.screenX, y: window.screenY, width: window.outerWidth, height: window.outerHeight });
});
window.addEventListener('mouseup', () => dragging = false);

// ─── 编辑保存（防抖，fnd_3）─────────────────
function saveNow() {
  const html = editor.innerHTML;
  window.stickie.save({ uuid: UUID, content: html });
}
editor.addEventListener('input', () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 600);
});
window.addEventListener('beforeunload', saveNow);

// ─── 查找/替换（fnd_16/19）─────────────────
function openFindPanel() {
  findPanel.classList.add('open');
  if (!findScopeAll.checked) {
    const sel = window.getSelection() + '';
    if (sel.trim()) findInput.value = sel.trim();
  }
  findInput.focus();
  findStatus.textContent = '';
}
function closeFindPanel() {
  findPanel.classList.remove('open');
  clearHighlights();
  findStatus.textContent = '';
}

function plainText() { return editor.textContent || ''; }

function highlightTerm(termRaw) {
  clearHighlights();
  const term = termRaw.trim();
  if (!term) return 0;
  const text = plainText();
  let count = 0;
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
  let node;
  const ranges = [];
  while (node = walker.nextNode()) {
    const hay = findScopeAll.checked === false ? node.textContent : node.textContent;
    // 精确匹配所有出现
    const lower = hay.toLowerCase();
    const t = term.toLowerCase();
    let idx = 0;
    while ((idx = lower.indexOf(t, idx)) >= 0) {
      const r = document.createRange();
      r.setStart(node, idx);
      r.setEnd(node, idx + t.length);
      ranges.push(r);
      count++;
      idx += t.length;
    }
  }
  if (count) {
    const mark = document.createElement('mark');
    mark.style.background = '#ffe08a'; mark.style.color = '#333'; mark.style.borderRadius = '2px';
    for (const r of ranges) {
      try { r.surroundContents(mark.cloneNode(false)); } catch {}
    }
    editor.querySelectorAll('mark').forEach(m => m.scrollIntoView({ block: 'center' }));
  }
  return count;
}

function clearHighlights() {
  editor.querySelectorAll('mark').forEach(m => {
    const parent = m.parentNode;
    if (parent) { parent.replaceChild(document.createTextNode(m.textContent), m); parent.normalize(); }
  });
}

function localFind(term) {
  const count = highlightTerm(term);
  findStatus.textContent = count ? `找到 ${count} 处` : '未找到';
  return count > 0;
}

function replaceCurrent() {
  const term = findInput.value.trim();
  if (!term) return;
  const firstMark = editor.querySelector('mark');
  if (!firstMark) { localFind(term); return; }
  firstMark.replaceWith(document.createTextNode(replaceInput.value));
  findStatus.textContent = '已替换 1 处';
  localFind(term);
}

function replaceAllLocal() {
  const term = findInput.value.trim();
  if (!term) return;
  const count = highlightTerm(term);
  if (!count) { findStatus.textContent = '未找到'; return; }
  editor.querySelectorAll('mark').forEach(m => m.replaceWith(document.createTextNode(replaceInput.value)));
  findStatus.textContent = `已替换 ${count} 处`;
  clearHighlights();
  saveNow();
}

findPrevBtn.addEventListener('click', () => {
  const term = findInput.value.trim();
  // 定位第一个 highlight（简化：全部高亮）
  localFind(term);
});
findNextBtn.addEventListener('click', () => {
  const term = findInput.value.trim();
  if (findScopeAll.checked) {
    // 跨窗口查找：让主进程广播到所有窗口
    window.stickie.listWindows().then(() => {
      // 主进程收到后将本窗口置前
    });
    localFind(term);
  } else {
    localFind(term);
  }
});
findReplaceBtn.addEventListener('click', replaceCurrent);
findReplaceAllBtn.addEventListener('click', replaceAllLocal);
findCloseBtn.addEventListener('click', closeFindPanel);

// 主进程广播来的查找命令：先清旧高亮再找
window.stickie.on('find-in-window', ({ term }) => { localFind(term); });
window.stickie.on('highlight-find', ({ term }) => { localFind(term); });
window.stickie.on('open-find', () => openFindPanel());
window.stickie.on('open-export', () => {
  window.stickie.exportAll(null).then(res => {
    if (res?.ok) alert(`已导出 ${res.exported} 张便签\nSummary: ${res.summaryPath}`);
    else if (res?.reason === 'no-dir') { /* 用户取消 */ }
    else alert('导出失败: ' + (res?.reason || '未知'));
  });
});
window.stickie.on('arrange-cmd', (mode) => {
  window.stickie.arrange(mode).then(n => console.log('arranged', n));
});
window.stickie.on('force-color', ({ colorKey }) => { applyColor(colorKey); });

// ─── 快捷键 ─────────────────────────────────
document.addEventListener('keydown', e => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'f') { e.preventDefault(); openFindPanel(); }
  if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); window.stickie.newStickie(); }
  if (mod && e.key.toLowerCase() === 'w') { e.preventDefault(); closeBtn.click(); }
  if (e.key === 'Escape' && findPanel.classList.contains('open')) closeFindPanel();
});