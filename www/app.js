/**
 * Stickies iOS —— 触屏版便签墙逻辑
 *
 * 复用逆向研究的设计语言（6 色便签、脊部视觉、黄色主体色），
 * 适配 iPhone：单屏便签墙 + 全屏编辑，无桌面版的多窗口/hover。
 *
 * 存储：优先 Capacitor Preferences（原生持久化），
 * 浏览器环境回退 localStorage —— 数据格式与桌面版（XML plist）字段对齐。
 */
(function () {
  'use strict';

  // 6 色 × 命名（与桌面版一致，fnd_5/24）
  const COLORS = {
    yellow: { name: '黄', hex: '#FDAF3C', spine: 'rgba(0,0,0,.15)' },
    blue:   { name: '蓝', hex: '#5AC8FA' },
    green:  { name: '绿', hex: '#63D98A' },
    pink:   { name: '粉', hex: '#FF9EB5' },
    purple: { name: '紫', hex: '#B78EFF' },
    gray:   { name: '灰', hex: '#8E8E93' },
  };

  // 便签数组 [ { uuid, title, text, colorKey, updatedAt } ]
  let notes = [];
  let editingIndex = -1;

  // Capacitor Preferences 可用？
  const hasCapacitor = !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences);

  // ─── DOM ───
  const wall = document.getElementById('wall');
  const empty = document.getElementById('empty');
  const fab = document.getElementById('fab');
  const editor = document.getElementById('editorScreen');
  const editTitle = document.getElementById('editTitle');
  const editText = document.getElementById('editText');
  const colorRow = document.getElementById('colorRow');
  const toast = document.getElementById('toast');
  const searchBtn = document.getElementById('searchBtn');
  const editModeBtn = document.getElementById('editModeBtn');
  let editColor = 'yellow';

  // ─── 存储 ───
  async function load() {
    try {
      if (hasCapacitor) {
        const { value } = await window.Capacitor.Plugins.Preferences.get({ key: 'stickies.notes' });
        notes = value ? JSON.parse(value) : [];
      } else {
        const raw = localStorage.getItem('stickies.notes');
        notes = raw ? JSON.parse(raw) : [];
      }
      if (!Array.isArray(notes)) notes = [];
    } catch { notes = []; }
  }
  async function persist() {
    const data = JSON.stringify(notes);
    try {
      if (hasCapacitor) {
        await window.Capacitor.Plugins.Preferences.set({ key: 'stickies.notes', value: data });
      } else {
        localStorage.setItem('stickies.notes', data);
      }
    } catch (e) { console.warn('persist failed', e); }
  }
  function uid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    }).toUpperCase();
  }
  function toastMsg(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastMsg._t);
    toastMsg._t = setTimeout(() => toast.classList.remove('show'), 1500);
  }

  // ─── 渲染墙 ───
  function stripHtml(html) {
    const t = document.createElement('div');
    t.innerHTML = html || '';
    return t.textContent || '';
  }
  function render() {
    wall.innerHTML = '';
    empty.style.display = notes.length ? 'none' : 'grid';
    notes.forEach((n, i) => {
      const card = document.createElement('div');
      card.className = 'card ' + (COLORS[n.colorKey] ? n.colorKey : 'yellow');
      const preview = stripHtml(n.text).slice(0, 80) || '(空白便签)';
      card.innerHTML = `
        <div class="spine"></div>
        <div class="title">${escapeHtml(n.title || '便签')}</div>
        <div class="preview">${escapeHtml(preview)}</div>
        <div class="del">✕</div>`;
      card.addEventListener('tap', () => openEdit(i));
      card.addEventListener('click', () => openEdit(i));
      card.querySelector('.del').addEventListener('click', e => {
        e.stopPropagation();
        notes.splice(i, 1);
        persist(); render(); toastMsg('已删除');
      });
      wall.appendChild(card);
    });
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ─── 编辑 ───
  function openEdit(i) {
    editingIndex = i;
    const n = notes[i];
    editTitle.value = n.title || '';
    editText.value = stripHtml(n.text);
    editColor = n.colorKey || 'yellow';
    paintColorRow();
    document.body.style.background = COLORS[editColor].hex;
    editor.style.background = COLORS[editColor].hex;
    editor.classList.add('open');
    setTimeout(() => editText.focus(), 250);
  }
  function closeEdit() {
    editor.classList.remove('open');
    document.body.style.background = '';
  }
  function paintColorRow() {
    colorRow.innerHTML = '';
    Object.entries(COLORS).forEach(([k, c]) => {
      const d = document.createElement('div');
      d.className = 'colorDot' + (k === editColor ? ' on' : '');
      d.style.background = c.hex;
      d.dataset.key = k;
      d.addEventListener('click', () => { editColor = k; paintColorRow(); editor.style.background = c.hex; });
      colorRow.appendChild(d);
    });
  }
  function saveEdit() {
    if (editingIndex < 0) return;
    const n = notes[editingIndex];
    n.title = editTitle.value.trim() || '便签';
    n.text = editText.value;
    n.colorKey = editColor;
    n.updatedAt = Date.now();
    persist(); render(); closeEdit(); toastMsg('已保存');
  }
  function addNote() {
    // 默认一张黄色便签，直接进入编辑
    notes.unshift({ uuid: uid(), title: '', text: '', colorKey: 'yellow', updatedAt: Date.now() });
    render();
    openEdit(0);
  }

  // ─── 搜索 ───
  let searchMode = false;
  searchBtn.addEventListener('click', () => {
    const q = prompt('搜索便签内容（回车确认）：');
    if (!q) { render(); return; }
    searchMode = true;
    editModeBtn.textContent = '✔ 完成';
    const kw = q.toLowerCase();
    const results = notes.filter(n =>
      (n.text || '').toLowerCase().includes(kw) || (n.title || '').toLowerCase().includes(kw));
    wall.innerHTML = '';
    if (results.length === 0) {
      wall.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:rgba(0,0,0,.4);padding:40px 0">未找到匹配的便签</div>';
    } else {
      results.forEach(n => {
        const i = notes.indexOf(n);
        const card = document.createElement('div');
        card.className = 'card ' + (COLORS[n.colorKey] ? n.colorKey : 'yellow');
        card.innerHTML = `<div class="spine"></div><div class="title">${escapeHtml(n.title || '便签')}</div><div class="preview">${escapeHtml(stripHtml(n.text).slice(0, 80) || '(空白)')}</div>`;
        card.addEventListener('click', () => { render(); openEdit(i); });
        wall.appendChild(card);
      });
    }
    editModeBtn.textContent = '✏️';  // 搜索结果即点即开，暂不复原按钮文本
    setTimeout(() => { searchMode = false; editModeBtn.textContent = '✏️'; render(); }, 30000); // 30s 后自动退出搜索
  });

  // 编辑/整理模式：长按进入删除（简化说明见 README）
  editModeBtn.addEventListener('click', () => {
    const on = !document.body.classList.contains('editing');
    document.body.classList.toggle('editing', on);
    wall.querySelectorAll('.card').forEach(c => c.classList.toggle('editing', on));
    editModeBtn.textContent = on ? '✔ 完成' : '✏️';
    editModeBtn.classList.toggle('pill', on);
    if (!on) toastMsg('已退出整理模式');
  });

  // ─── 事件绑定 ───
  fab.addEventListener('click', addNote);
  document.getElementById('backBtn').addEventListener('click', closeEdit);
  document.getElementById('saveBtn').addEventListener('click', saveEdit);

  // 返回键（Android 兼容；iOS 无物理返回）
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && editor.classList.contains('open')) closeEdit();
  });

  // ─── 启动 ───
  (async function init() {
    await load();
    // 首次启动示例便签
    if (notes.length === 0) {
      notes = [
        { uuid: uid(), title: '欢迎使用便签 🎉', text: '这是 iOS 版 Stickies。\n\n• 点 ➕ 新建便签\n• 点便签编辑\n• 顶部 ✏️ 进入整理（删除）\n• 🔍 搜索内容\n\n数据保存在本机。', colorKey: 'yellow', updatedAt: Date.now() },
        { uuid: uid(), title: '灵感记录', text: '每一个好想法\n都值得一张\n醒目的便签 📌', colorKey: 'blue', updatedAt: Date.now() },
      ];
      await persist();
    }
    render();
  })();
})();