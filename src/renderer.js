/**
 * renderer.js — 实况窗交互逻辑（iOS 27 Liquid Glass · 真实功能版 v2）
 *  - 触顶下拉、拖拽、固定、隐藏、区域感知穿透
 *  - 真实功能：正在播放媒体(封面+控制) / 番茄钟 / 系统监控 / 天气 / 电池
 *  - AI 问答：多厂商 Key 配置 + 流式输出到右侧结果面板 + 本地文件搜索
 *  - 卡片显示可在设置中开关
 */
(function () {
  'use strict';

  const isElectron = !!(window.electronAPI && window.electronAPI.platform === 'electron');
  if (isElectron) document.body.classList.add('electron');
  const t = (...args) => window.I18N.t(...args);

  // ---------- DOM ----------
  const island = document.getElementById('island');
  const islandIcon = document.getElementById('islandIcon');
  const islandTitle = document.getElementById('islandTitle');
  const islandSub = document.getElementById('islandSub');
  const pinBtn = document.getElementById('pinBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const panels = document.getElementById('panels');
  const panel = document.getElementById('panel');
  const activitiesEl = document.getElementById('activities');
  const footClock = document.getElementById('footClock');
  const askInput = document.getElementById('askInput');
  const askSend = document.getElementById('askSend');
  const askAnswer = document.getElementById('askAnswer');
  const chat = document.getElementById('chat');
  const chatBody = document.getElementById('chatBody');
  const chatStatus = document.getElementById('chatStatus');
  const chatModel = document.getElementById('chatModel');
  const chatClear = document.getElementById('chatClear');
  const chatHistoryBtn = document.getElementById('chatHistoryBtn');
  const chatExportBtn = document.getElementById('chatExportBtn');
  const chatHistoryEl = document.getElementById('chatHistory');
  const chatToggleBtn = document.getElementById('chatToggleBtn');
  const chatToggleUse = document.getElementById('chatToggleUse');
  const chatSettingsBtn = document.getElementById('chatSettingsBtn');
  const chatFontMinus = document.getElementById('chatFontMinus');
  const chatFontPlus = document.getElementById('chatFontPlus');
  const chatInput = document.getElementById('chatInput');
  const chatSend = document.getElementById('chatSend');
  const chatSendUse = document.getElementById('chatSendUse');
  const settingsModal = document.getElementById('settings');
  const settingsClose = document.getElementById('settingsClose');
  const optHidden = document.getElementById('optHidden');
  const optGlass = document.getElementById('optGlass');
  const optGlassVal = document.getElementById('optGlassVal');
  const optAmbient = document.getElementById('optAmbient');
  const optAmbOp = document.getElementById('optAmbOp');
  const optAmbOpVal = document.getElementById('optAmbOpVal');
  const optTheme = document.getElementById('optTheme');
  const optEdge = document.getElementById('optEdge');
  const optEdgeVal = document.getElementById('optEdgeVal');
  const optReset = document.getElementById('optReset');
  const optQuit = document.getElementById('optQuit');
  const aiProvider = document.getElementById('aiProvider');
  const aiKey = document.getElementById('aiKey');
  const aiBase = document.getElementById('aiBase');
  const aiModel = document.getElementById('aiModel');
  const aiSave = document.getElementById('aiSave');
  const aiTip = document.getElementById('aiTip');
  const cardToggleEls = Array.from(document.querySelectorAll('#cardToggles input[type=checkbox]'));
  const ocrBtn = document.getElementById('ocrBtn');
  const translateBtn = document.getElementById('translateBtn');
  const fileBtn = document.getElementById('fileBtn');
  const optAutoTranslate = document.getElementById('optAutoTranslate');
  const aiVisionModel = document.getElementById('aiVisionModel');
  const optOcrEngine = document.getElementById('optOcrEngine');
  const optLang = document.getElementById('optLang');
  const optAutoStart = document.getElementById('optAutoStart');
  const screenshotEl = document.getElementById('screenshot');
  const ssBox = document.getElementById('ssBox');
  const timerFloatEl = document.getElementById('timerFloat');
  const tfTime = document.getElementById('tfTime');
  const tfPause = document.getElementById('tfPause');
  const tfAdd = document.getElementById('tfAdd');
  const tfProg = document.getElementById('tfProg');
  const tfPauseUse = document.getElementById('tfPauseUse');
  const nbStack = document.getElementById('nbStack');
  const ncPanel = document.getElementById('ncPanel');
  const ncList = document.getElementById('ncList');
  const ncClear = document.getElementById('ncClear');
  const ncDnd = document.getElementById('ncDnd');
  const optNotif = document.getElementById('optNotif');
  const ncModeHint = document.getElementById('ncModeHint');
  const notifBtn = document.getElementById('notifBtn');
  const nbBadge = document.getElementById('nbBadge');

  // 本窗口所在的显示器 id（主进程通过 query 注入）；多屏时通知/自动翻译只由主屏窗口执行
  const myDid = (() => { try { return new URLSearchParams(location.search).get('did'); } catch (_) { return null; } })();
  function isPrimaryView() {
    if (!isElectron || !myDid) return true;
    const p = live.primaryId;
    return p == null || String(p) === myDid;
  }

  // 番茄钟悬浮小岛状态
  let tfVisible = false, tfReturning = false, hoveringFloat = false;

  // ---------- 状态 ----------
  const LS = { pos: 'lw_pos', hidden: 'lw_hidden', theme: 'lw_theme', edge: 'lw_edge', glass: 'lw_glass', ambient: 'lw_ambient', ambOp: 'lw_amb_op', timer: 'lw_timer', cards: 'lw_cards', ai: 'lw_ai', chat: 'lw_chat_history', autoTranslate: 'lw_auto_translate', ocrEngine: 'lw_ocr_engine', sessions: 'lw_chat_sessions', chatFont: 'lw_chat_font', panelHidden: 'lw_panel_hidden', notif: 'lw_notif', notifLog: 'lw_notif_log' };
  const state = {
    x: readPos('x'), y: readPos('y'),
    hidden: localStorage.getItem(LS.hidden) === '1',
    theme: localStorage.getItem(LS.theme) || 'auto',
    edge: parseInt(localStorage.getItem(LS.edge) || '8', 10),
    glass: parseInt(localStorage.getItem(LS.glass) || '26', 10),
    ambient: localStorage.getItem(LS.ambient) !== '0',
    ambOp: Math.max(10, Math.min(100, parseInt(localStorage.getItem(LS.ambOp) || '55', 10) || 55)),
    pinned: false,
    expanded: false,
    dragging: false,
    settingsOpen: false,
    screenshot: false,
    mxPx: -9999, myPx: -9999,
    cards: loadCards(),
    ai: loadAI(),
    ocrEngine: localStorage.getItem(LS.ocrEngine) || 'auto',
    notif: (localStorage.getItem(LS.notif) === 'digest' || localStorage.getItem(LS.notif) === 'off')
      ? localStorage.getItem(LS.notif) : 'on',
  };
  // 通知中心历史（localStorage 持久化，最多 60 条）
  const notifLog = [];
  try {
    const raw = JSON.parse(localStorage.getItem(LS.notifLog) || '[]');
    if (Array.isArray(raw)) for (const n of raw.slice(0, 60)) {
      notifLog.push({ id: n.id || String(Math.random()), app: String(n.app || 'system'), title: String(n.title || ''), body: String(n.body || ''), ts: Number(n.ts) || Date.now(), icon: n.icon || null });
    }
  } catch (_) {}
  function saveNotifLog() {
    try { localStorage.setItem(LS.notifLog, JSON.stringify(notifLog.slice(0, 60))); } catch (_) {}
  }
  function readPos(k) {
    try { return JSON.parse(localStorage.getItem(LS.pos) || 'null')?.[k] ?? null; }
    catch { return null; }
  }
  if (state.x == null) state.x = Math.round(window.innerWidth / 2);
  if (state.y == null) state.y = 10;

  function loadCards() {
    const def = { media: true, timer: true, weather: true, system: true, battery: true };
    try { return Object.assign(def, JSON.parse(localStorage.getItem(LS.cards) || 'null')); }
    catch { return def; }
  }
  const AI_PROVIDERS = {
    openai: { base: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    deepseek: { base: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
    moonshot: { base: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
    zhipu: { base: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
    qwen: { base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-turbo' },
    custom: { base: '', model: '' },
  };
  function loadAI() {
    const def = { provider: 'deepseek', baseUrl: '', apiKey: '', model: '', visionModel: '' };
    try { return Object.assign(def, JSON.parse(localStorage.getItem(LS.ai) || 'null')); }
    catch { return def; }
  }

  // 实时数据模型
  const live = {
    ready: false, media: null, battery: null,
    net: { down: 0, up: 0 },
    sys: { cpu: null, memPct: null, memUsed: null, memTotal: null },
    weather: null, weatherError: null,
  };
  const timer = { total: 25 * 60, remaining: 25 * 60, running: false, endAt: null };
  loadTimer();

  // AI 会话（系统提示随语言切换）
  const AI_SYSTEM = () => t('aiSystem');
  let chatHistory = [];
  let chatOpen = false;
  let active = null; // { id, el, text }
  let lastClip = '';
  let autoTranslate = localStorage.getItem(LS.autoTranslate) === '1';
  let chatFont = parseInt(localStorage.getItem(LS.chatFont) || '15', 10) || 15; // AI 回答字号
  let panelHidden = localStorage.getItem(LS.panelHidden) === '1'; // 主面板是否收起（AI 面板居中）

  // 防抖缓存：避免高频 DOM/IPC 抖动导致闪烁
  let lastIgnoreMouse = null;   // 上一次 setIgnoreMouse 状态
  let lastPanelsPos = '';       // 上一次 panels left/top 值
  let lastSyncExpanded = null;  // 上一次 syncChat 的 expanded 状态
  let lastSyncChatOpen = null;  // 上一次 syncChat 的 chatOpen 状态

  // ---------- 工具 ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmt = (s) => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtBytes = (bps) => { if (!isFinite(bps) || bps < 0) bps = 0; if (bps >= 1048576) return (bps / 1048576).toFixed(1) + ' MB/s'; if (bps >= 1024) return (bps / 1024).toFixed(0) + ' KB/s'; return Math.round(bps) + ' B/s'; };
  const fmtGB = (b) => (b / 1073741824).toFixed(1) + ' GB';
  const weekday = (ds) => { const d = new Date(ds + 'T00:00:00'); return window.I18N.arr('weekdays')[d.getDay()]; };
  function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

  // ---------- Toast 轻提示（顶部浮出、2 秒自动收起） ----------
  const toastEl = h('<div class="toast" role="status" aria-live="polite"></div>');
  document.body.appendChild(toastEl);
  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove('show');
    void toastEl.offsetWidth; // 重启动画
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2000);
  }

  /* ============================================================
     iOS 27 通知横幅（Notification Banners）+ 通知中心
     规格：
     · 顶部居中、380px 宽、圆角 22px，Liquid Glass 材质（上下亮缘/左右暗缘）
     · 入场：cubic-bezier(0.32,0.72,0,1) 400ms 非回弹下落
       （等价 spring stiffness=350 damping=28）
     · 自动消失 5s；指针悬停时暂停计时（iOS 行为）
     · 上滑/右滑超过 96px 或半宽 → 提交消失；位移中 opacity = 1 - |d|/200
     · 点击卡片本体 → 展开动作行（iOS 26 condensed → expanded）
     · 堆叠：最新在上，其余 scale .96 / .92 下沉；>3 折叠为「N 条更多」
     · 通知中心按 App 分组，支持全部清除与勿扰
     性能红线：动画只作用于内层 .nb-move 的 transform/opacity，
     .nb 本体（backdrop-filter 所在层）的祖先链必须干净，
     否则 Chromium 静默失效背景过滤（实测保留率 69% → 1.2%）。
     ============================================================ */
  const NB_VISIBLE = 3;              // 同时可见的横幅数
  const NB_AUTO_MS = 5000;           // iOS 默认自动消失时长
  const NB_SWIPE = 96;               // 提交阈值（px）
  const NB_FADE = 200;               // 位移衰减系数
  const NB_DEDUPE_MS = 500;          // 重复通知去重窗口
  const nbItems = [];                // 活跃横幅 {el, move, expireAt, paused, gone, app, title, body, icon}
  let nbDedupe = null;               // {key, at}
  const NOTIF_APPS = {
    timer:   { icon: 'i-timer',   label: () => t('pomodoro') || '番茄钟' },
    media:   { icon: 'i-music',   label: () => t('nowPlaying') || '正在播放' },
    weather: { icon: 'i-globe',   label: () => t('weather') || '天气' },
    system:  { icon: 'i-cpu',     label: () => t('systemCard') || '系统' },
    ai:      { icon: 'i-sparkle', label: () => t('chatTitle') || 'AI 助手' },
    files:   { icon: 'i-folder',  label: () => t('findFile') || '文件' },
    live:    { icon: 'i-sparkle', label: () => 'Live Window' },
  };

  function nbIconNode(app, coverB64) {
    if (coverB64) {
      const img = document.createElement('img');
      img.src = 'data:image/jpeg;base64,' + coverB64;
      img.alt = '';
      return img;
    }
    const svg = document.createElementNS('http://www.w3.org/2000/svg');
    svg.setAttribute('class', 'ic');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#' + (NOTIF_APPS[app]?.icon || 'i-bell'));
    svg.appendChild(use);
    return svg;
  }

  /**
   * 弹出一条通知横幅。
   * @param {object} o {app, title, body, icon(base64 封面), timeout, actions:[{label, primary, onClick}], onClick, sticky}
   * @returns {HTMLElement|null} 横幅元素（digest/off 模式下返回 null，仅写入通知中心）
   */
  function notify(o) {
    if (!isPrimaryView()) return null;          // 多屏时只有主屏弹
    const app = o.app || 'live';
    const title = o.title || '实况窗';
    const body = o.body || '';
    // 去重：500ms 内完全相同的通知直接丢弃
    const key = app + '\u0000' + title + '\u0000' + body;
    const now = Date.now();
    if (nbDedupe && nbDedupe.key === key && now - nbDedupe.at < NB_DEDUPE_MS) return null;
    nbDedupe = { key, at: now };

    // 写入通知中心历史（任何模式都记）
    pushNotifLog({ app, title, body, icon: o.icon || null, ts: now });

    // 定时摘要 / 关闭：不弹横幅，只进通知中心
    if (state.notif !== 'on') { renderNotifCenter(); return null; }
    if (!isNotificationCenterAllowed()) { renderNotifCenter(); return null; }

    const el = h(`<div class="nb" role="status" aria-live="polite">
      <div class="nb-move">
        <span class="nb-icon"></span>
        <div class="nb-body">
          <div class="nb-title"></div>
          <div class="nb-text"></div>
          <div class="nb-actions"></div>
        </div>
        <span class="nb-time"></span>
      </div>
      <button class="nb-close" aria-label="${escAttr(t('close') || '关闭')}"><svg class="ic"><use href="#i-close"/></svg></button>
    </div>`);
    const move = el.querySelector('.nb-move');
    const iconWrap = el.querySelector('.nb-icon');
    const titleEl = el.querySelector('.nb-title');
    const textEl = el.querySelector('.nb-text');
    const timeEl = el.querySelector('.nb-time');
    const actionsEl = el.querySelector('.nb-actions');
    const closeBtn = el.querySelector('.nb-close');
    iconWrap.appendChild(nbIconNode(app, o.icon));
    if (app && NOTIF_APPS[app]) iconWrap.classList.add(app);
    titleEl.textContent = title;
    if (body) textEl.textContent = body; else textEl.remove();
    timeEl.textContent = nbTime(now);

    const item = { el, move, timer: null, expireAt: now + (o.sticky ? Infinity : (o.timeout || NB_AUTO_MS)), paused: false, app, title, body };
    nbItems.push(item);

    // 动作行
    const acts = Array.isArray(o.actions) ? o.actions.slice(0, 3) : [];
    for (const a of acts) {
      if (!a || !a.label) continue;
      const b = h(`<button class="nb-act${a.primary ? ' primary' : ''}"><span></span></button>`);
      b.querySelector('span').textContent = a.label;
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        try { a.onClick && a.onClick(); } catch (_) {}
        dismissNb(item, 'right');
      });
      actionsEl.appendChild(b);
    }
    // 有点击行为但没给动作时，补一个默认「查看」
    if (!acts.length && typeof o.onClick === 'function') {
      const b = h(`<button class="nb-act primary"><svg class="ic"><use href="#i-chevron-down"/></svg><span></span></button>`);
      b.querySelector('span').textContent = t('nbView') || '查看';
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        try { o.onClick(); } catch (_) {}
        dismissNb(item, 'right');
      });
      actionsEl.appendChild(b);
    }

    // 关闭按钮
    closeBtn.addEventListener('click', (ev) => { ev.stopPropagation(); dismissNb(item, 'right'); });

    // 点击卡片：展开动作行；同时暂停自动消失
    el.addEventListener('click', () => {
      if (acts.length) el.classList.toggle('expanded');
      else if (typeof o.onClick === 'function') { try { o.onClick(); } catch (_) {} }
    });

    // 悬停暂停自动消失（iOS 行为）
    el.addEventListener('mouseenter', () => { item.paused = true; });
    el.addEventListener('mouseleave', () => { item.paused = false; });

    // 滑动手势：上下/左右超过阈值即提交消失
    bindNbSwipe(el, move, item);

    nbStack.appendChild(el);
    nbStack.hidden = false;
    requestAnimationFrame(() => {
      el.classList.add('in');
      layoutNbStack();
    });
    scheduleNbTick();
    return el;
  }

  // 通知中心开关：勿扰时不弹横幅
  function isNotificationCenterAllowed() { return !notifDnd; }
  let notifDnd = false;
  try { notifDnd = localStorage.getItem('lw_notif_dnd') === '1'; } catch (_) {}

  function nbTime(ts) {
    const d = new Date(ts);
    const p = (n) => (n < 10 ? '0' + n : String(n));
    return p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function escAttr(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // 提交消失：滑出方向 right/up
  function dismissNb(item, dir) {
    if (!item || item.gone) return;
    item.gone = true;
    item.el.classList.add('commit');
    const d = dir === 'up' ? '-130%' : '130%';
    item.move.style.transform = dir === 'up' ? 'translateY(' + d + ')' : 'translateX(' + d + ')';
    item.move.style.opacity = '0';
    const done = () => {
      item.el.remove();
      const i = nbItems.indexOf(item);
      if (i >= 0) nbItems.splice(i, 1);
      layoutNbStack();
      if (!nbItems.length) nbStack.hidden = true;
    };
    setTimeout(done, 240);
  }

  // 堆叠布局：最新在前全尺寸，其余按深度缩放下沉；>3 折成「N 条更多」
  function layoutNbStack() {
    const n = nbItems.length;
    nbStack.classList.toggle('single', n <= 1);
    const order = nbItems.slice().reverse();      // 最新在最上（DOM 顺序）
    let visible = 0;
    let hiddenCount = 0;
    const more = h('<div class="nb-more"><svg class="ic"><use href="#i-chevron-down"/></svg><span></span></div>');
    order.forEach((item, i) => {
      item.el.classList.remove('behind', 'behind-2');
      item.el.style.zIndex = String(100 - i);
      if (i === 0) { item.el.style.display = ''; visible = 1; return; }
      if (visible < NB_VISIBLE - 1) {
        item.el.classList.add(i === 1 ? 'behind' : 'behind-2');
        item.el.style.display = '';
        visible++;
        return;
      }
      // 超出可见数量的，隐藏并计入「N 条更多」
      item.el.style.display = 'none';
      hiddenCount++;
    });
    // 移除旧的更多按钮
    const oldMore = nbStack.querySelector('.nb-more');
    if (oldMore) oldMore.remove();
    if (hiddenCount > 0) {
      const moreBtn = more;
      moreBtn.querySelector('span').textContent = (t('nbMore') || '还有 {0} 条通知').replace('{0}', String(hiddenCount));
      moreBtn.addEventListener('click', (ev) => { ev.stopPropagation(); openNotifCenter(); });
      nbStack.appendChild(moreBtn);
      requestAnimationFrame(() => moreBtn.classList.add('in'));
    }
    // 通知中心打开时，横幅整体下沉避让
    const offset = ncPanel && ncPanel.classList.contains('open') ? Math.round(ncPanel.offsetHeight + 18) : 0;
    nbStack.style.setProperty('--nc-offset', offset + 'px');
    nbStack.classList.toggle('nc-open', offset > 0);
    updatePassthrough();
  }

  // 统一计时器：只有一条就够，按最早到期排序逐个关
  let nbTickTimer = null;
  function scheduleNbTick() {
    if (nbTickTimer) return;
    nbTickTimer = setInterval(() => {
      const now = Date.now();
      for (const item of nbItems.slice()) {
        if (item.paused || item.gone) continue;
        if (now >= item.expireAt) dismissNb(item, 'up');
      }
      if (!nbItems.length && nbTickTimer) { clearInterval(nbTickTimer); nbTickTimer = null; }
    }, 400);
  }

  // 滑动手势：位移实时跟随，松手按阈值决定回弹或提交
  function bindNbSwipe(el, move, item) {
    let sx = 0, sy = 0, dx = 0, dy = 0, active = false, axis = null;
    el.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      if (ev.target.closest('.nb-close, .nb-act')) return;
      active = true; axis = null; sx = ev.clientX; sy = ev.clientY; dx = 0; dy = 0;
      try { el.setPointerCapture(ev.pointerId); } catch (_) {}
      move.style.transition = 'none';
    });
    el.addEventListener('pointermove', (ev) => {
      if (!active) return;
      dx = ev.clientX - sx; dy = ev.clientY - sy;
      if (!axis) {
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        else return;
      }
      const d = axis === 'x' ? dx : dy;
      move.style.transform = axis === 'x'
        ? `translateX(${d}px) scale(1)`
        : `translateY(${Math.min(0, d)}px) scale(1)`;
      move.style.opacity = String(Math.max(0, 1 - Math.abs(d) / NB_FADE));
      ev.preventDefault();
    });
    const end = () => {
      if (!active) return;
      active = false;
      move.style.transition = '';
      const d = axis === 'x' ? dx : dy;
      const w = el.offsetWidth || 380;
      if (Math.abs(d) >= Math.min(NB_SWIPE, w * 0.5)) {
        dismissNb(item, axis === 'x' ? 'right' : 'up');
      } else {
        move.style.transform = '';
        move.style.opacity = '';
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  // ---------- 通知中心 ----------
  function pushNotifLog(entry) {
    notifLog.unshift(entry);
    if (notifLog.length > 60) notifLog.length = 60;
    saveNotifLog();
    if (ncPanel && !ncPanel.hidden) renderNotifCenter();
    updateNbBadge();
  }

  function fmtNotifAgo(ts) {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return t('nbJustNow') || '刚刚';
    if (m < 60) return (t('nbMinAgo') || '{0} 分钟前').replace('{0}', String(m));
    const hh = Math.floor(m / 60);
    if (hh < 24) return (t('nbHourAgo') || '{0} 小时前').replace('{0}', String(hh));
    return nbTime(ts);
  }

  function renderNotifCenter() {
    if (!ncList) return;
    ncList.textContent = '';
    if (!notifLog.length) {
      ncList.appendChild(h(`<div class="nc-empty">
        <span class="nc-empty-ic"><svg class="ic"><use href="#i-bell"/></svg></span>
        <span class="nc-empty-title">${escAttr(t('ncEmptyTitle') || '暂无通知')}</span>
        <span class="nc-empty-sub">${escAttr(t('ncEmptySub') || '番茄钟、播放变化、天气提醒都会出现在这里')}</span>
      </div>`));
      return;
    }
    // 按 App 分组（iOS 行为：通知中心按应用分组）
    const groups = [];
    const byApp = {};
    for (const n of notifLog) {
      const k = n.app || 'live';
      if (!byApp[k]) { byApp[k] = []; groups.push(k); }
      byApp[k].push(n);
    }
    for (const app of groups) {
      const list = byApp[app];
      const meta = NOTIF_APPS[app] || NOTIF_APPS.live;
      const g = h(`<div class="nc-group">
        <div class="nc-group-head"><span class="nc-gdot"></span><span class="nc-gname"></span><span class="nc-gcount"></span></div>
      </div>`);
      g.querySelector('.nc-gname').textContent = meta.label();
      g.querySelector('.nc-gcount').textContent = String(list.length);
      for (const n of list) {
        const it = h(`<div class="nc-item" role="button" tabindex="0">
          <span class="nb-icon ${escAttr(app)}"></span>
          <div class="nb-body">
            <div class="nb-title"></div>
            <div class="nb-text"></div>
          </div>
          <span class="nb-time"></span>
        </div>`);
        const iw = it.querySelector('.nb-icon');
        iw.appendChild(nbIconNode(app, n.icon));
        it.querySelector('.nb-title').textContent = n.title;
        it.querySelector('.nb-text').textContent = n.body;
        it.querySelector('.nb-time').textContent = fmtNotifAgo(n.ts);
        it.addEventListener('click', () => {
          // 点击历史项：若是系统/AI 类就重弹一次横幅（保留上下文）
          openNotifCenter(false);
          notify({ app: n.app, title: n.title, body: n.body, icon: n.icon, timeout: 4000 });
        });
        g.appendChild(it);
      }
      ncList.appendChild(g);
    }
  }

  function openNotifCenter(v = true) {
    if (!ncPanel) return;
    if (v) {
      ncPanel.hidden = false;
      // 强制回流后再加 open，保证过渡生效
      void ncPanel.offsetWidth;
      ncPanel.classList.add('open');
      renderNotifCenter();
    } else {
      ncPanel.classList.remove('open');
      setTimeout(() => { if (!ncPanel.classList.contains('open')) ncPanel.hidden = true; }, 320);
    }
    layoutNbStack();
    updatePassthrough();
  }

  function clearNotifLog() {
    notifLog.length = 0;
    saveNotifLog();
    renderNotifCenter();
  }

  function setNotifMode(mode) {
    state.notif = (mode === 'digest' || mode === 'off') ? mode : 'on';
    try { localStorage.setItem(LS.notif, state.notif); } catch (_) {}
    if (optNotif) optNotif.value = state.notif;
    // 切到关闭时清掉当前横幅；切回弹出时把积压的一次性补齐（最多 3 条）
    if (state.notif !== 'on') {
      for (const it of nbItems.slice()) dismissNb(it, 'up');
    } else {
      const queued = notifLog.slice(0, NB_VISIBLE).reverse();
      for (const n of queued) notify({ app: n.app, title: n.title, body: n.body, icon: n.icon, timeout: 5000 });
    }
    if (ncModeHint) ncModeHint.classList.toggle('hidden', state.notif === 'on');
  }

  function setNotifDnd(on) {
    notifDnd = !!on;
    try { localStorage.setItem('lw_notif_dnd', notifDnd ? '1' : '0'); } catch (_) {}
    if (ncDnd) ncDnd.classList.toggle('on', notifDnd);
    if (notifDnd) for (const it of nbItems.slice()) dismissNb(it, 'up');
  }

  // 滑块液态填充：把当前值写进 --fill，轨道渐变按比例铺满
  function syncRangeFill(input) {
    const mn = parseFloat(input.min), mx = parseFloat(input.max);
    const pct = ((parseFloat(input.value) - mn) / (mx - mn)) * 100;
    input.style.setProperty('--fill', clamp(pct, 0, 100) + '%');
  }

  // ---------- 主题 / 玻璃 ----------
  function applyTheme() {
    document.body.classList.remove('theme-light', 'theme-dark', 'theme-auto');
    document.body.classList.add('theme-' + state.theme);
  }
  function applyGlass() {
    const a = state.glass / 100;
    document.body.style.setProperty('--glass-alpha', a.toFixed(2));
    document.body.style.setProperty('--glass-strong-alpha', Math.min(0.85, a + 0.14).toFixed(2));
  }

  // ---------- 专辑封面氛围背景 ----------
  // 取正在播放媒体的专辑封面（SMTC 已给出 <=256px 的 JPEG base64），做高强度模糊后
  // 铺在灵动岛 / 主面板 / AI 对话三块玻璃上，浓度由设置滑块控制。
  const ambLayers = Array.from(document.querySelectorAll('.amb > i'));
  let ambIdx = 1;
  let ambSrc = null;
  function applyAmbient() {
    document.body.style.setProperty('--amb-op', (state.ambOp / 100).toFixed(2));
    document.body.classList.toggle('amb-on', !!state.ambient && !!ambSrc);
  }
  function setAmbientCover(b64) {
    const url = b64 ? 'data:image/jpeg;base64,' + b64 : null;
    if (url === ambSrc) { applyAmbient(); return; }
    ambSrc = url;
    if (!url) {
      for (const l of ambLayers) l.classList.remove('on'); // 淡出，保留原图避免闪白
      applyAmbient();
      return;
    }
    // 两层交叉淡入：新封面写进当前隐藏的那层并置顶淡入，换歌过渡不突兀
    ambIdx = 1 - ambIdx;
    const next = String(ambIdx);
    for (const l of ambLayers) {
      if (l.dataset.amb === next) {
        l.style.backgroundImage = 'url("' + url + '")';
        l.classList.add('on');
      } else {
        l.classList.remove('on');
      }
    }
    applyAmbient();
  }

  // ---------- 布局 ----------
  // 位置一律取整：分数像素会让文字落在亚像素栅格上，Windows 缩放环境下整体发虚
  function applyIslandPosition() {
    const vw = window.innerWidth;
    const half = Math.min(560, vw * 0.46) / 2;
    state.x = clamp(state.x, half + 8, vw - half - 8);
    state.y = clamp(state.y, 4, 60);
    island.style.left = Math.round(state.x) + 'px';
    island.style.top = Math.round(state.y) + 'px';
  }
  function layoutPanels() {
    const vw = window.innerWidth;
    const gap = 14;
    // 下拉展开时 AI 问答面板默认可见（需求：下拉即可查看历史），布局需为其预留宽度
    const chatVisible = chatOpen || state.expanded;
    const pw = panelHidden ? 0 : (panel.offsetWidth || 560);
    // solo 时 chat 的最终宽度（与灵动岛一致）；用目标值而非当前 offsetWidth，
    // 避免 width 过渡动画期间读取中间值导致中心点漂移
    const soloChatW = Math.min(560, vw * 0.46);
    const cw = chatVisible ? (panelHidden ? soloChatW : (chat.offsetWidth || 420)) : 0;
    const totalW = pw + (pw > 0 && chatVisible ? gap + cw : cw);
    // 始终以灵动岛（state.x）为中心：岛可拖拽移动，AI 面板需与其水平对齐
    const centerX = state.x;
    const cx = clamp(centerX, totalW / 2 + 8, vw - totalW / 2 - 8);
    // 直接写整数左边距（CSS 已移除 translateX(-50%)，避免子像素）
    const left = Math.round(cx - totalW / 2) + 'px';
    const top = Math.round(state.y + 54) + 'px';
    const key = left + '|' + top;
    if (lastPanelsPos === key) return; // 位置未变，避免高频重排
    lastPanelsPos = key;
    panels.style.left = left;
    panels.style.top = top;
  }
  function savePos() { localStorage.setItem(LS.pos, JSON.stringify({ x: state.x, y: state.y })); }

  // ---------- 区域感知鼠标穿透 ----------
  function pointerInside(els) {
    const x = state.mxPx, y = state.myPx;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
    }
    return false;
  }
  function updatePassthrough() {
    if (!isElectron) return;
    let interactive = false;
    if (state.settingsOpen || state.screenshot) interactive = true;
    else if (state.dragging) interactive = true;
    else if (state.expanded && pointerInside([island, panel, chat])) interactive = true;
    else if (tfVisible && pointerInside([timerFloatEl])) interactive = true;
    else if (nbItems.length && pointerInside([nbStack])) interactive = true;
    else if (ncPanel && ncPanel.classList.contains('open') && pointerInside([ncPanel])) interactive = true;
    const next = !interactive;
    if (lastIgnoreMouse === next) return; // 状态未变，跳过高频 IPC
    lastIgnoreMouse = next;
    window.electronAPI.setIgnoreMouse(next, true);
  }

  // ---------- 展开 / 收起 ----------
  let lastY = 9999;
  let collapseTimer = null;
  let hoveringIsland = false, hoveringPanel = false;

  function setExpanded(v) {
    const changed = state.expanded !== v;
    if (changed) {
      state.expanded = v;
      island.classList.toggle('expanded', v);
      panel.classList.toggle('open', v);
      panel.setAttribute('aria-hidden', String(!v));
    }
    if (v && changed) layoutPanels(); // 仅在真正展开时重新布局
    if (changed) syncChat();
    updateIslandVisibility();
    updatePassthrough();
    updateTimerFloat();
  }
  function updateIslandVisibility() {
    const show = !state.screenshot && (!state.hidden || lastY < state.edge || state.expanded);
    island.classList.toggle('hidden-island', !show);
  }
  function evaluate() {
    if (state.dragging) return;
    // 触顶展开限制在 island 正上方稍宽的区域（两侧各 40px 余量），
    // 避免光标去点其他窗口右上角关闭按钮时误触实况窗下拉。
    const islandRect = island.getBoundingClientRect();
    const margin = 40;
    const inTriggerZone = !hoveringFloat && lastY < state.edge && state.mxPx >= islandRect.left - margin && state.mxPx <= islandRect.right + margin;
    const want = state.pinned || hoveringIsland || hoveringPanel || inTriggerZone;
    if (want) {
      if (collapseTimer) { clearTimeout(collapseTimer); collapseTimer = null; }
      if (!state.expanded) setExpanded(true);
    } else if (state.expanded && !collapseTimer) {
      collapseTimer = setTimeout(() => { setExpanded(false); collapseTimer = null; }, 220);
    }
    updateIslandVisibility();
  }

  // ---------- 光标追踪折射高光（iOS 26 Liquid Glass） ----------
  // 把指针在各玻璃面板内的局部坐标写进 --mx/--my，::before 折射层随之游走。
  // 只在进入时加 .refract、离开时移除，避免空闲时每帧写样式。
  const refractEls = [island, panel, chat];
  function setRefract(el, x, y) {
    el.style.setProperty('--mx', x + 'px');
    el.style.setProperty('--my', y + 'px');
    el.classList.add('refract');
  }
  function clearRefract() { for (const el of refractEls) el.classList.remove('refract'); }
  function trackRefract(e) {
    for (const el of refractEls) {
      if (el.offsetParent === null) { el.classList.remove('refract'); continue; }
      const r = el.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (inside) setRefract(el, e.clientX - r.left, e.clientY - r.top);
      else el.classList.remove('refract');
    }
  }
  window.addEventListener('mousemove', (e) => {
    lastY = e.clientY;
    state.mxPx = e.clientX; state.myPx = e.clientY;
    trackRefract(e);
    evaluate();
    updatePassthrough();
  });
  document.addEventListener('mouseleave', clearRefract);

  island.addEventListener('mouseenter', () => { hoveringIsland = true; evaluate(); updatePassthrough(); });
  island.addEventListener('mouseleave', () => { hoveringIsland = false; evaluate(); });
  panel.addEventListener('mouseenter', () => { hoveringPanel = true; evaluate(); updatePassthrough(); });
  panel.addEventListener('mouseleave', () => { hoveringPanel = false; evaluate(); });
  chat.addEventListener('mouseenter', () => { hoveringPanel = true; evaluate(); updatePassthrough(); });
  chat.addEventListener('mouseleave', () => { hoveringPanel = false; evaluate(); });
  timerFloatEl.addEventListener('mouseenter', () => { hoveringFloat = true; evaluate(); updatePassthrough(); });
  timerFloatEl.addEventListener('mouseleave', () => { hoveringFloat = false; evaluate(); updatePassthrough(); });
  // 横幅 / 通知中心：进入即恢复交互（否则会被穿透到桌面）
  nbStack.addEventListener('mouseenter', updatePassthrough);
  nbStack.addEventListener('mouseleave', () => setTimeout(updatePassthrough, 260));
  if (ncPanel) {
    ncPanel.addEventListener('mouseenter', updatePassthrough);
    ncPanel.addEventListener('mouseleave', updatePassthrough);
  }

  // ---------- 拖拽 ----------
  let drag = null;
  island.addEventListener('mousedown', (e) => {
    if (e.target.closest('.island-btn')) return;
    // 记录按下时是否在封面区域（点击封面=打开播放应用；拖动仍走拖拽）
    drag = { sx: e.clientX, sy: e.clientY, ox: state.x, oy: state.y, moved: false, fromCover: !!(e.target.closest('.island-icon') && live.media) };
    state.dragging = true;
    island.classList.add('dragging');
    panels.classList.add('dragging'); // 拖拽期间禁用面板位移过渡，保证跟手
    updatePassthrough();
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    state.x = Math.round(drag.ox + dx);
    state.y = Math.round(drag.oy + dy);
    applyIslandPosition();
    if (state.expanded) layoutPanels();
  });
  window.addEventListener('mouseup', () => {
    if (!drag) return;
    const wasClick = !drag.moved;
    const fromCover = drag.fromCover;
    drag = null;
    state.dragging = false;
    island.classList.remove('dragging');
    panels.classList.remove('dragging');
    savePos();
    updatePassthrough();
    if (!wasClick) return;
    if (fromCover) activateMediaApp();
    else togglePin();
  });

  // 点击灵动岛封面：进入播放媒体对应的软件
  async function activateMediaApp() {
    if (!isElectron || !window.electronAPI.activateMediaApp) return;
    const r = await window.electronAPI.activateMediaApp();
    if (r && !r.ok) showAnswer(t('mediaOpenFailed'));
  }

  function togglePin() {
    state.pinned = !state.pinned;
    pinBtn.classList.toggle('active', state.pinned);
    if (state.pinned) setExpanded(true);
    toast(state.pinned ? t('pinnedMsg') : t('unpinnedMsg'));
    evaluate();
  }
  pinBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePin(); });
  // 键盘可达：焦点在灵动岛上按 Enter/Space = 与点击同等（固定/取消固定）
  island.addEventListener('keydown', (e) => {
    if (e.target !== island) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePin(); }
  });

  // ---------- 设置 ----------
  function openSettings() {
    state.settingsOpen = true;
    optHidden.checked = state.hidden;
    optTheme.value = state.theme;
    optEdge.value = state.edge;
    optEdgeVal.textContent = state.edge;
    optGlass.value = state.glass;
    optGlassVal.textContent = state.glass + '%';
    optAmbient.checked = state.ambient;
    optAmbOp.value = state.ambOp;
    optAmbOpVal.textContent = state.ambOp + '%';
    [optGlass, optAmbOp, optEdge].forEach(syncRangeFill);
    cardToggleEls.forEach((c) => { c.checked = state.cards[c.dataset.card] !== false; });
    aiProvider.value = state.ai.provider || 'deepseek';
    aiKey.value = state.ai.apiKey || '';
    aiBase.value = state.ai.baseUrl || AI_PROVIDERS[aiProvider.value].base;
    aiModel.value = state.ai.model || AI_PROVIDERS[aiProvider.value].model;
    aiVisionModel.value = state.ai.visionModel || '';
    aiTip.textContent = t('aiTip');
    optAutoTranslate.checked = autoTranslate;
    optOcrEngine.value = state.ocrEngine;
    optLang.value = window.I18N.lang;
    if (isElectron && window.electronAPI.getAutoStart) {
      window.electronAPI.getAutoStart().then((r) => { if (r && r.ok) optAutoStart.checked = !!r.enabled; }).catch(() => { /* ignore */ });
    }
    settingsModal.classList.remove('hidden');
    updatePassthrough();
    updateTimerFloat();
  }
  function closeSettings() { state.settingsOpen = false; settingsModal.classList.add('hidden'); updatePassthrough(); updateTimerFloat(); }
  settingsBtn.addEventListener('click', (e) => { e.stopPropagation(); openSettings(); });
  settingsClose.addEventListener('click', closeSettings);
  settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) closeSettings(); });

  optHidden.addEventListener('change', () => {
    state.hidden = optHidden.checked;
    localStorage.setItem(LS.hidden, state.hidden ? '1' : '0');
    updateIslandVisibility();
  });
  optGlass.addEventListener('input', () => {
    state.glass = parseInt(optGlass.value, 10);
    optGlassVal.textContent = state.glass + '%';
    localStorage.setItem(LS.glass, String(state.glass));
    syncRangeFill(optGlass);
    applyGlass();
  });
  optTheme.addEventListener('change', () => {
    state.theme = optTheme.value;
    localStorage.setItem(LS.theme, state.theme);
    applyTheme();
  });
  // 专辑封面背景开关 / 浓度
  optAmbient.addEventListener('change', () => {
    state.ambient = optAmbient.checked;
    localStorage.setItem(LS.ambient, state.ambient ? '1' : '0');
    applyAmbient();
  });
  optAmbOp.addEventListener('input', () => {
    state.ambOp = parseInt(optAmbOp.value, 10);
    optAmbOpVal.textContent = state.ambOp + '%';
    localStorage.setItem(LS.ambOp, String(state.ambOp));
    syncRangeFill(optAmbOp);
    applyAmbient();
  });
  optEdge.addEventListener('input', () => {
    state.edge = parseInt(optEdge.value, 10);
    optEdgeVal.textContent = state.edge;
    localStorage.setItem(LS.edge, String(state.edge));
    syncRangeFill(optEdge);
  });
  function resetPosition() {
    state.x = Math.round(window.innerWidth / 2); state.y = 10;
    state.hidden = false; state.theme = 'auto'; state.edge = 8; state.glass = 26;
    optHidden.checked = false; optTheme.value = 'auto'; optEdge.value = 8; optEdgeVal.textContent = '8';
    optGlass.value = 26; optGlassVal.textContent = '26%';
    [LS.pos, LS.hidden, LS.theme, LS.edge, LS.glass].forEach((k) => localStorage.removeItem(k));
    applyTheme(); applyGlass(); applyIslandPosition(); updateIslandVisibility();
    [optGlass, optAmbOp, optEdge].forEach(syncRangeFill);
    toast(t('resetDone'));
  }
  optReset.addEventListener('click', resetPosition);
  optQuit.addEventListener('click', () => { if (isElectron) window.electronAPI.quit(); else closeSettings(); });

  // 卡片显示开关
  cardToggleEls.forEach((c) => {
    c.addEventListener('change', () => {
      state.cards[c.dataset.card] = c.checked;
      localStorage.setItem(LS.cards, JSON.stringify(state.cards));
      reconcile();
    });
  });

  // AI 配置
  aiProvider.addEventListener('change', () => {
    const p = AI_PROVIDERS[aiProvider.value];
    if (aiProvider.value !== 'custom' || !aiBase.value) aiBase.value = p.base || '';
    if (aiProvider.value !== 'custom' || !aiModel.value) aiModel.value = p.model || '';
  });
  aiSave.addEventListener('click', () => {
    state.ai = {
      provider: aiProvider.value,
      baseUrl: aiBase.value.trim(),
      apiKey: aiKey.value.trim(),
      model: aiModel.value.trim(),
      visionModel: aiVisionModel.value.trim(),
    };
    localStorage.setItem(LS.ai, JSON.stringify(state.ai));
    aiTip.textContent = state.ai.apiKey ? t('aiSaved') : t('aiNoKey');
    toast(state.ai.apiKey ? t('aiSaved') : t('aiNoKey'));
  });
  optOcrEngine.addEventListener('change', () => {
    state.ocrEngine = optOcrEngine.value;
    localStorage.setItem(LS.ocrEngine, state.ocrEngine);
  });
  // 语言切换：刷新静态文案 + 所有动态卡片 / 岛 / 对话 / 历史浮层
  optLang.addEventListener('change', () => {
    if (!window.I18N.setLang(optLang.value)) return;
    if (isElectron && window.electronAPI.setLang) window.electronAPI.setLang(window.I18N.lang); // 主进程托盘/错误文案同步
    askAnswer.hidden = true; askAnswer.innerHTML = ''; // 清掉旧语言的回显
    lastSig = ''; // 强制重建卡片
    reconcile(); refreshCards(); updateIsland();
    renderHistoryToChat();
    if (!chatHistoryEl.hidden) renderHistoryList();
    chatStatus.textContent = t('statusReady');
    updateClock();
  });
  optAutoTranslate.addEventListener('change', () => {
    autoTranslate = optAutoTranslate.checked;
    localStorage.setItem(LS.autoTranslate, autoTranslate ? '1' : '0');
  });
  // 开机自启
  optAutoStart.addEventListener('change', () => {
    if (isElectron && window.electronAPI.setAutoStart) {
      window.electronAPI.setAutoStart(optAutoStart.checked).then((r) => {
        if (r && r.ok) optAutoStart.checked = !!r.enabled; // 以系统实际状态为准
      }).catch(() => { /* ignore */ });
    }
  });
  if (isElectron && window.electronAPI.getAutoStart) {
    window.electronAPI.getAutoStart().then((r) => { if (r && r.ok) optAutoStart.checked = !!r.enabled; }).catch(() => { /* ignore */ });
  }

  // ---------- 番茄钟 ----------
  function loadTimer() {
    try {
      const saved = JSON.parse(localStorage.getItem(LS.timer) || 'null');
      if (saved && saved.total) {
        timer.total = saved.total;
        if (saved.running && saved.endAt) {
          const rem = Math.ceil((saved.endAt - Date.now()) / 1000);
          if (rem > 0) { timer.running = true; timer.endAt = saved.endAt; timer.remaining = rem; }
          else { timer.remaining = 0; }
        } else { timer.remaining = saved.remaining || saved.total; }
      }
    } catch (_) { /* ignore */ }
  }
  function saveTimer() { localStorage.setItem(LS.timer, JSON.stringify({ total: timer.total, remaining: timer.remaining, running: timer.running, endAt: timer.endAt })); }
  function timerStart() {
    if (timer.remaining <= 0) timer.remaining = timer.total;
    timer.running = true;
    timer.endAt = Date.now() + timer.remaining * 1000;
    saveTimer(); refreshCards(); updateIsland(); updateTimerFloat();
  }
  function timerPause() {
    if (!timer.running) return;
    timer.remaining = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
    timer.running = false; timer.endAt = null;
    saveTimer(); refreshCards(); updateIsland(); updateTimerFloat();
  }
  function timerReset() {
    timer.running = false; timer.endAt = null; timer.remaining = timer.total;
    saveTimer(); refreshCards(); updateIsland(); updateTimerFloat();
  }
  function timerAdd(sec) {
    if (timer.running) {
      timer.remaining = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
      timer.endAt = Date.now() + (timer.remaining + sec) * 1000;
    } else {
      timer.remaining = Math.min(24 * 3600, timer.remaining + sec);
    }
    saveTimer(); refreshCards(); updateIsland(); updateTimerFloat();
  }
  function timerTick() {
    if (!timer.running) return;
    const rem = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
    timer.remaining = rem;
    if (rem <= 0) {
      timer.running = false; timer.endAt = null;
      saveTimer();
      // 多屏各有一个渲染进程：只让主屏窗口发通知，避免重复弹窗
      if (isElectron && isPrimaryView()) {
        notify({
          app: 'timer', title: t('timerDoneTitle'), body: t('timerDoneBody'),
          timeout: 8000,
          actions: [
            { label: t('nbAgain') || '再来一个', primary: true, onClick: () => { timerReset(); timerStart(); } },
            { label: t('nbDismiss') || '关闭', onClick: () => {} },
          ],
        });
      } else if (!isElectron) alert(t('timerDoneTitle'));
    }
  }

  // ---------- 番茄钟悬浮小岛（界面收起时浮于右上角，打开时动画回到卡片） ----------
  function timerActive() { return timer.running || (timer.remaining > 0 && timer.remaining < timer.total); }
  function updateTimerFloat() {
    const want = timerActive() && !state.expanded && !state.settingsOpen && !state.screenshot;
    if (want) {
      tfTime.textContent = fmt(timer.remaining);
      tfProg.style.width = clamp(timer.remaining / timer.total * 100, 0, 100) + '%';
      const href = timer.running ? '#i-pause' : '#i-play';
      if (tfPauseUse && tfPauseUse.getAttribute('href') !== href) tfPauseUse.setAttribute('href', href);
      tfPause.title = timer.running ? t('pause') : t('resume');
      if (!tfVisible && !tfReturning) {
        tfVisible = true;
        timerFloatEl.hidden = false;
        timerFloatEl.classList.remove('returning');
        timerFloatEl.style.transform = '';
        timerFloatEl.style.opacity = '';
        // 双 rAF 确保先应用初始态再加 show，入场动画才生效
        requestAnimationFrame(() => requestAnimationFrame(() => timerFloatEl.classList.add('show')));
      }
    } else if (tfVisible) {
      hideTimerFloat();
    }
  }
  function hideTimerFloat() {
    tfVisible = false;
    const el = timerFloatEl;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.hidden = true;
      el.classList.remove('show', 'returning');
      el.style.transform = '';
      el.style.opacity = '';
      tfReturning = false;
    };
    // 界面已展开且番茄钟卡片存在：平滑飞回卡片位置；否则原地淡出
    const timerCard = cards.find((c) => c.key === 'timer');
    const cardEl = timerCard && timerCard.refs.time ? timerCard.refs.time.closest('.card') : null;
    if (state.expanded && cardEl) {
      tfReturning = true;
      const r1 = el.getBoundingClientRect();
      const r2 = cardEl.getBoundingClientRect();
      const dx = (r2.left + r2.width / 2) - (r1.left + r1.width / 2);
      const dy = (r2.top + r2.height / 2) - (r1.top + r1.height / 2);
      el.classList.add('returning');
      el.style.transform = 'translate(' + Math.round(dx) + 'px,' + Math.round(dy) + 'px) scale(.85)';
      el.style.opacity = '0';
      setTimeout(finish, 430);
    } else {
      el.classList.remove('show');
      setTimeout(finish, 320);
    }
  }
  tfPause.addEventListener('click', (e) => { e.stopPropagation(); if (timer.running) timerPause(); else timerStart(); });
  tfAdd.addEventListener('click', (e) => { e.stopPropagation(); timerAdd(5 * 60); });

  // ---------- 实时数据卡片 ----------
  const GRAD = {
    media: 'linear-gradient(135deg,#ff6a88,#ff99ac)',
    timer: 'linear-gradient(135deg,#0a84ff,#5e5ce6)',
    weather: 'linear-gradient(135deg,#43e97b,#38f9d7)',
    system: 'linear-gradient(135deg,#5e5ce6,#0a84ff)',
    battery: 'linear-gradient(135deg,#ff9f0a,#ff375f)',
  };

  function paintSeek(r, ratio) {
    const p = (clamp(ratio, 0, 1) * 100) + '%';
    r.fill.style.width = p;
    r.thumb.style.left = p;
  }

  function buildMedia() {
    const el = h(`<div class="card media-card">
      <div class="media-info">
        <div class="media-title" data-title></div>
        <div class="media-sub" data-sub></div>
        <div class="card-badge" data-badge></div>
      </div>
      <div class="seek" data-seek>
        <div class="seek-track" data-track><div class="seek-fill" data-fill></div><div class="seek-thumb" data-thumb></div></div>
        <div class="seek-times"><span data-elapsed></span><span data-duration></span></div>
      </div>
      <div class="media-ctrl">
        <button class="mc" data-prev title="${t('prevTitle')}"><svg class="ic"><use href="#i-prev"/></svg></button>
        <button class="mc play" data-play title="${t('playPause')}"><svg class="ic"><use href="#i-play"/></svg></button>
        <button class="mc" data-next title="${t('nextTitle')}"><svg class="ic"><use href="#i-next"/></svg></button>
      </div>
    </div>`);
    const refs = {
      title: el.querySelector('[data-title]'), sub: el.querySelector('[data-sub]'),
      badge: el.querySelector('[data-badge]'), seek: el.querySelector('[data-seek]'), track: el.querySelector('[data-track]'),
      fill: el.querySelector('[data-fill]'), thumb: el.querySelector('[data-thumb]'),
      elapsed: el.querySelector('[data-elapsed]'), duration: el.querySelector('[data-duration]'),
      prev: el.querySelector('[data-prev]'), play: el.querySelector('[data-play]'), next: el.querySelector('[data-next]'),
      playUse: el.querySelector('[data-play] use'),
      _drag: { active: false, ratio: 0 }, _playHref: '',
    };
    function ratioFromEvent(e) { const r = refs.track.getBoundingClientRect(); return r.width ? clamp((e.clientX - r.left) / r.width, 0, 1) : 0; }
    refs.track.addEventListener('pointerdown', (e) => { refs._drag.active = true; refs._drag.ratio = ratioFromEvent(e); refs.track.setPointerCapture(e.pointerId); refs.seek.classList.add('dragging'); paintSeek(refs, refs._drag.ratio); });
    refs.track.addEventListener('pointermove', (e) => { if (refs._drag.active) { refs._drag.ratio = ratioFromEvent(e); paintSeek(refs, refs._drag.ratio); refs.elapsed.textContent = fmt(refs._drag.ratio * (live.media.end || 0)); } });
    refs.track.addEventListener('pointerup', (e) => {
      if (!refs._drag.active) return;
      refs._drag.active = false;
      refs.seek.classList.remove('dragging');
      refs._drag.ratio = ratioFromEvent(e);
      const m = live.media;
      if (m && m.end > 0) { mediaControl('seek', refs._drag.ratio * m.end); }
    });
    refs.prev.addEventListener('click', () => mediaControl('prev'));
    refs.play.addEventListener('click', () => { const m = live.media; mediaControl(m && m.status === 'Playing' ? 'pause' : 'play'); });
    refs.next.addEventListener('click', () => mediaControl('next'));
    return { el, refs };
  }
  function updateMedia(r) {
    const m = live.media;
    if (!m) return;
    r.title.textContent = m.title || t('unknownTrack');
    r.sub.textContent = m.artist ? (m.album ? m.artist + ' · ' + m.album : m.artist) : '';
    r.badge.textContent = m.status === 'Playing' ? t('nowPlaying') : (m.status === 'Paused' ? t('paused') : (m.status || ''));
    const playHref = m.status === 'Playing' ? '#i-pause' : '#i-play';
    if (r._playHref !== playHref) { r._playHref = playHref; r.playUse.setAttribute('href', playHref); }
    const hasDur = m.end > 0 && m.end > m.pos;
    r.seek.style.display = hasDur ? '' : 'none';
    if (hasDur) {
      const ratio = r._drag.active ? r._drag.ratio : (m.pos / m.end);
      paintSeek(r, ratio);
      r.elapsed.textContent = fmt(r._drag.active ? r._drag.ratio * m.end : m.pos);
      r.duration.textContent = fmt(m.end);
    } else {
      r.elapsed.textContent = '';
      r.duration.textContent = m.status === 'Playing' ? t('nowPlaying') : '';
    }
  }

  function buildTimer() {
    const el = h(`<div class="card">
      <div class="card-head">
        <div class="card-titles"><div class="card-title">${t('pomodoro')}</div><div class="card-sub" data-sub>${t('focusTimer')}</div></div>
        <div class="card-badge" data-badge>${t('pendingStart')}</div>
      </div>
      <div class="timer-time" data-time>25:00</div>
      <div class="progress red"><i data-prog></i></div>
      <div class="timer-controls">
        <button class="tc primary" data-start>${t('start')}</button>
        <button class="tc" data-reset>${t('reset')}</button>
        <button class="tc" data-add>${t('addFiveMin')}</button>
      </div>
    </div>`);
    const startBtn = el.querySelector('[data-start]');
    startBtn.addEventListener('click', () => { if (timer.running) timerPause(); else timerStart(); });
    el.querySelector('[data-reset]').addEventListener('click', timerReset);
    el.querySelector('[data-add]').addEventListener('click', () => timerAdd(5 * 60));
    return { el, refs: { sub: el.querySelector('[data-sub]'), badge: el.querySelector('[data-badge]'), time: el.querySelector('[data-time]'), prog: el.querySelector('[data-prog]'), startBtn } };
  }
  function updateTimer(r) {
    r.time.textContent = fmt(timer.remaining);
    r.prog.style.width = Math.max(0, Math.min(100, timer.remaining / timer.total * 100)) + '%';
    if (timer.running) { r.badge.textContent = t('inProgress'); r.startBtn.textContent = t('pause'); r.sub.textContent = t('focusingSub', fmt(timer.total)); }
    else if (timer.remaining < timer.total) { r.badge.textContent = t('paused'); r.startBtn.textContent = t('resume'); r.sub.textContent = t('pausedSub', fmt(timer.total)); }
    else { r.badge.textContent = t('pendingStart'); r.startBtn.textContent = t('start'); r.sub.textContent = t('focusSub', fmt(timer.total)); }
  }

  function buildSystem() {
    const el = h(`<div class="card">
      <div class="card-head">
        <div class="card-titles"><div class="card-title">${t('sysStatus')}</div><div class="card-sub" data-sub>${t('sysMonitor')}</div></div>
        <div class="card-badge" data-badge>Live</div>
      </div>
      <div class="sys-grid">
        <div class="sys-item"><span class="sys-k">CPU</span><span class="sys-v" data-cpu>--</span></div>
        <div class="sys-item"><span class="sys-k">${t('memory')}</span><span class="sys-v" data-mem>--</span></div>
        <div class="sys-item"><span class="sys-k">${t('download')}</span><span class="sys-v" data-down>--</span></div>
        <div class="sys-item"><span class="sys-k">${t('upload')}</span><span class="sys-v" data-up>--</span></div>
      </div>
    </div>`);
    return { el, refs: { sub: el.querySelector('[data-sub]'), badge: el.querySelector('[data-badge]'), cpu: el.querySelector('[data-cpu]'), mem: el.querySelector('[data-mem]'), down: el.querySelector('[data-down]'), up: el.querySelector('[data-up]') } };
  }
  function updateSystem(r) {
    const s = live.sys;
    if (s.cpu == null) {
      r.cpu.textContent = '--'; r.mem.textContent = '--'; r.down.textContent = '--'; r.up.textContent = '--';
      r.sub.textContent = isElectron ? t('waitingData') : t('browserPreview');
      return;
    }
    r.cpu.textContent = s.cpu + '%';
    r.mem.textContent = s.memPct + '%';
    r.down.textContent = fmtBytes(live.net.down);
    r.up.textContent = fmtBytes(live.net.up);
    r.sub.textContent = t('memUsed', fmtGB(s.memUsed), fmtGB(s.memTotal));
  }

  function buildWeather() {
    const el = h(`<div class="card">
      <div class="card-head">
        <div class="card-titles"><div class="card-title" data-title>${t('weather')}</div><div class="card-sub" data-sub>${t('locating')}</div></div>
        <div class="card-badge" data-badge></div>
      </div>
      <div class="wx-days" data-daily></div>
    </div>`);
    return { el, refs: { title: el.querySelector('[data-title]'), sub: el.querySelector('[data-sub]'), badge: el.querySelector('[data-badge]'), daily: el.querySelector('[data-daily]') } };
  }
  function updateWeather(r) {
    const w = live.weather;
    if (!w) {
      r.title.textContent = t('weather');
      r.sub.textContent = live.weatherError || t('locating');
      r.badge.textContent = '';
      if (r._sig !== 'empty') { r._sig = 'empty'; r.daily.innerHTML = ''; }
      return;
    }
    r.title.textContent = Math.round(w.temp) + '°C · ' + window.wmoText(w.code);
    r.sub.textContent = (w.city || '') + ' · ' + t('feelsLike', Math.round(w.feels));
    r.badge.textContent = t('humidityWind', w.humidity, Math.round(w.wind));
    const sig = (w.daily || []).map((d) => d.date + '|' + d.max + '|' + d.min + '|' + d.code).join('~');
    if (r._sig !== sig) {
      r._sig = sig;
      r.daily.innerHTML = (w.daily || []).map((d, i) => {
        const day = i === 0 ? t('todayShort') : i === 1 ? t('tomorrowShort') : weekday(d.date);
        return `<div class="wx-day"><span class="wx-d">${day}</span><span class="wx-i">${window.weatherIcon(d.code)}</span><span class="wx-t">${Math.round(d.max)}°/${Math.round(d.min)}°</span></div>`;
      }).join('');
    }
  }

  function buildBattery() {
    const el = h(`<div class="card">
      <div class="card-head">
        <div class="card-titles"><div class="card-title" data-title>${t('battery')}</div><div class="card-sub" data-sub></div></div>
        <div class="card-badge" data-badge></div>
      </div>
      <div class="progress"><i data-prog></i></div>
    </div>`);
    return { el, refs: { title: el.querySelector('[data-title]'), sub: el.querySelector('[data-sub]'), badge: el.querySelector('[data-badge]'), prog: el.querySelector('[data-prog]') } };
  }
  function updateBattery(r) {
    const b = live.battery;
    if (!b) return;
    r.title.textContent = t('battery') + ' ' + b.percent + '%';
    r.sub.textContent = b.charging ? t('charging') : t('onBattery');
    r.badge.textContent = b.percent >= 90 ? t('batteryFull') : (b.percent >= 30 ? t('batteryNormal') : t('batteryLow'));
    r.prog.style.width = b.percent + '%';
    r.prog.style.background = b.percent >= 50 ? 'linear-gradient(90deg,#43e97b,#38f9d7)' : (b.percent >= 20 ? 'linear-gradient(90deg,#ff9f0a,#ff375f)' : 'linear-gradient(90deg,#ff375f,#ff0a2f)');
  }

  const defs = [
    { key: 'media', visible: () => !!live.media && state.cards.media !== false, build: buildMedia, update: updateMedia },
    { key: 'timer', visible: () => state.cards.timer !== false, build: buildTimer, update: updateTimer },
    { key: 'weather', visible: () => state.cards.weather !== false, build: buildWeather, update: updateWeather },
    { key: 'system', visible: () => state.cards.system !== false, build: buildSystem, update: updateSystem },
    { key: 'battery', visible: () => !!live.battery && state.cards.battery !== false, build: buildBattery, update: updateBattery },
  ];
  let cards = [];
  let lastSig = '';
  function reconcile() {
    const sig = defs.filter((d) => d.visible()).map((d) => d.key).join('|');
    if (sig === lastSig) return;
    lastSig = sig;
    activitiesEl.innerHTML = '';
    cards = [];
    for (const d of defs) {
      if (!d.visible()) continue;
      const { el, refs } = d.build();
      activitiesEl.appendChild(el);
      cards.push({ key: d.key, refs, update: d.update });
    }
  }
  function refreshCards() { for (const c of cards) c.update(c.refs); }

  // ---------- 媒体控制 ----------
  function mediaControl(action, pos) {
    if (!isElectron) return;
    window.electronAPI.mediaControl(action, pos);
  }

  // ---------- 灵动岛 ----------
  function islandInfo() {
    const m = live.media;
    if (state.cards.media !== false && m && m.title) return { icon: '#i-music', gradient: GRAD.media, title: m.title, sub: m.artist || (m.status === 'Playing' ? t('nowPlaying') : t('paused')), cover: m.cover || null, media: true };
    if (state.cards.timer !== false && timer.running) return { icon: '#i-timer', gradient: GRAD.timer, title: t('pomodoro'), sub: t('timerRemaining', fmt(timer.remaining)), cover: null };
    const w = live.weather;
    if (state.cards.weather !== false && w && w.temp != null) return { icon: window.weatherIcon(w.code), gradient: GRAD.weather, title: Math.round(w.temp) + '° ' + window.wmoText(w.code), sub: w.city || '', cover: null };
    const s = live.sys;
    if (state.cards.system !== false && live.ready && s.cpu != null) return { icon: '#i-cpu', gradient: GRAD.system, title: 'CPU ' + s.cpu + '% · ' + t('memory') + ' ' + s.memPct + '%', sub: t('sysStatus'), cover: null };
    return null;
  }
  let islandCoverSrc = null;
  let islandIconMode = '';
  function updateIsland() {
    // 专辑封面 → 三窗口模糊背景（媒体卡片被关闭时不铺封面）
    const m = live.media;
    setAmbientCover(state.cards.media !== false && m && m.cover ? m.cover : null);
    const info = islandInfo() || { icon: '#i-sparkle', gradient: 'conic-gradient(from 210deg,#0a84ff,#5e5ce6,#ff375f,#ff9f0a,#0a84ff)', title: t('islandTitle'), sub: t('islandSub'), cover: null };
    if (info.cover) {
      if (islandCoverSrc !== info.cover) {
        islandCoverSrc = info.cover;
        islandIcon.innerHTML = '<img src="data:image/jpeg;base64,' + info.cover + '" alt=""/>';
        islandIcon.style.background = '';
        islandIconMode = 'img';
        popIcon();
      }
    } else {
      if (islandCoverSrc !== null) {
        islandCoverSrc = null;
      }
      const isSym = typeof info.icon === 'string' && info.icon.startsWith('#');
      if (isSym) {
        if (islandIconMode !== info.icon) {
          islandIconMode = info.icon;
          islandIcon.innerHTML = '<svg class="ic"><use href="' + info.icon + '"/></svg>';
          popIcon();
        }
      } else if (islandIcon.textContent !== info.icon) {
        islandIconMode = 'emoji';
        islandIcon.textContent = info.icon;
        popIcon();
      }
      islandIcon.style.background = info.gradient;
    }
    islandIcon.classList.toggle('clickable', !!info.media);
    islandIcon.title = info.media ? t('openMediaApp') : '';
    swapText(islandTitle, info.title);
    swapText(islandSub, info.sub);
  }
  // 灵动岛内容换新微动效：内容变化时轻柔上浮淡入（同值不触发，避免每秒抖动）
  function swapText(el, val) {
    if (el.textContent === val) return;
    el.textContent = val;
    el.classList.remove('swap');
    void el.offsetWidth;
    el.classList.add('swap');
  }
  // 图标换新：缩放+微旋弹入
  function popIcon() {
    islandIcon.classList.remove('swap');
    void islandIcon.offsetWidth;
    islandIcon.classList.add('swap');
  }

  // ---------- 天气 ----------
  async function loadWeather(city) {
    try {
      let res;
      if (isElectron) {
        res = await window.electronAPI.getWeather(city || null);
      } else {
        const url = 'https://api.open-meteo.com/v1/forecast?latitude=31.23&longitude=121.47&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto';
        const j = await (await fetch(url)).json();
        const cur = j.current || {};
        res = {
          city: city || '上海', temp: cur.temperature_2m, feels: cur.apparent_temperature,
          humidity: cur.relative_humidity_2m, wind: cur.wind_speed_10m, code: cur.weather_code,
          daily: (j.daily && j.daily.time ? j.daily.time.map((t, i) => ({ date: t, max: j.daily.temperature_2m_max[i], min: j.daily.temperature_2m_min[i], code: j.daily.weather_code[i] })).slice(0, 5) : []),
        };
      }
      if (res && res.error) { live.weatherError = res.error; live.weather = null; }
      else if (res && res.temp != null) { live.weather = res; live.weatherError = null; }
      else { live.weatherError = t('weatherFailed'); }
    } catch (e) {
      live.weatherError = t('weatherFailed');
    }
    reconcile(); refreshCards(); updateIsland();
  }

  // ---------- Search or Ask ----------
  function showAnswer(html) {
    askAnswer.innerHTML = html;
    askAnswer.hidden = false;
    askAnswer.style.animation = 'none'; // 重播卡片滚入动画
    void askAnswer.offsetWidth;
    askAnswer.style.animation = '';
  }

  // 本地快捷指令（无需 AI，中英双语），返回 true 表示已处理
  async function tryLocalCommand(q) {
    if (/^(https?:\/\/|www\.)/i.test(q)) {
      const url = /^www\./i.test(q) ? 'https://' + q : q;
      if (isElectron) await window.electronAPI.openUrl(url); else window.open(url, '_blank');
      showAnswer(t('openedInBrowser', escapeHtml(q)));
      return true;
    }
    const wq = q.match(/^(?:weather|天气)\s*(.*)/i);
    if (wq) {
      const city = wq[1].trim() || null;
      showAnswer(city ? t('queryingWeatherCity', escapeHtml(city)) : t('queryingWeather'));
      await loadWeather(city);
      return true;
    }
    if (/^(计时|定时|专注|番茄|timer|countdown|focus|pomodoro)/i.test(q)) {
      let secs = 25 * 60;
      const m = q.match(/(\d+)\s*(分钟|分|秒|小时|hours?|hrs?|h|min|mins|minutes?|s|sec|secs|seconds?)/i);
      if (m) {
        const n = parseInt(m[1], 10);
        const u = m[2].toLowerCase();
        const isSec = u === '秒' || u === 's' || u.startsWith('sec');
        const isHour = u === '小时' || u.startsWith('hour') || u === 'h' || u.startsWith('hr');
        secs = isSec ? n : isHour ? n * 3600 : n * 60;
      }
      secs = clamp(secs, 5, 24 * 3600);
      timer.total = secs; timer.remaining = secs; timer.running = false;
      timerStart();
      showAnswer(t('timerStarted', fmt(secs)));
      return true;
    }
    const oq = q.match(/^(?:打开|open|launch|start)\s+(.+)/i);
    if (oq) {
      const app = oq[1].trim();
      if (isElectron) {
        const res = await window.electronAPI.launch(app);
        showAnswer(res.ok ? t('openedApp', escapeHtml(app)) : escapeHtml(res.msg || t('cannotOpen')));
      } else showAnswer(t('previewOpen', escapeHtml(app)));
      return true;
    }
    if (/^(退出|关闭|quit|exit)$/i.test(q)) { if (isElectron) { window.electronAPI.quit(); showAnswer(t('quitting')); } else showAnswer(t('previewQuit')); return true; }
    if (/^(隐藏|隐藏到顶部|hide)$/i.test(q)) { state.hidden = true; localStorage.setItem(LS.hidden, '1'); optHidden.checked = true; updateIslandVisibility(); showAnswer(t('hiddenTop')); return true; }
    if (/^(设置|settings)$/i.test(q)) { openSettings(); showAnswer(t('openedSettings')); return true; }
    if (/^(固定|置顶|pin)$/i.test(q)) { if (!state.pinned) togglePin(); showAnswer(t('pinnedMsg')); return true; }
    if (/^(重置位置|reset position)$/i.test(q)) { resetPosition(); showAnswer(t('resetDone')); return true; }
    if (/^(截图|截图取字|grab text|screenshot|ocr)/i.test(q)) { startScreenshot(); return true; }
    if (/^(翻译剪贴板|translate clipboard)/i.test(q)) { translateClipboard(); return true; }
    const tr = q.match(/^(?:翻译|translate)\s+(.+)/i);
    if (tr) { translateText(tr[1]); return true; }
    const fs = q.match(/^(?:找文件|搜文件|搜索文件|查找文件|找一下文件|find files?|search files?|file search)\s*(.+)/i);
    if (fs) { const kw = fs[1].trim(); if (kw) { searchFilesCommand(kw); } else { showAnswer(t('enterKeyword')); } return true; }
    return false;
  }

  async function handleAsk(raw) {
    const q = raw.trim();
    if (!q) return;
    if (await tryLocalCommand(q)) return;
    askAI(q);
  }

  // ---------- Markdown 渲染 + 历史持久化 ----------
  function renderMarkdown(el, text) {
    if (window.marked && window.DOMPurify) {
      const html = window.marked.parse(text || '');
      el.innerHTML = window.DOMPurify.sanitize(html, { FORBID_TAGS: ['img', 'iframe', 'script', 'style', 'video', 'audio', 'object', 'embed', 'svg', 'math'] });
      if (window.hljs) {
        el.querySelectorAll('pre code').forEach((b) => { try { window.hljs.highlightElement(b); } catch (_) { /* ignore */ } });
      }
    } else {
      el.textContent = text || '';
    }
  }
  function loadChatHistory() {
    try { chatHistory = JSON.parse(localStorage.getItem(LS.chat) || '[]'); if (!Array.isArray(chatHistory)) chatHistory = []; }
    catch (_) { chatHistory = []; }
  }
  function saveChatHistory() {
    if (chatHistory.length > 200) chatHistory = chatHistory.slice(-200);
    try { localStorage.setItem(LS.chat, JSON.stringify(chatHistory)); } catch (_) { /* ignore */ }
  }
  function renderHistoryToChat() {
    chatEmptyObserver.disconnect();
    try {
      chatBody.innerHTML = '';
      for (const m of chatHistory) {
        const qa = document.createElement('div'); qa.className = 'qa';
        if (m.role === 'user') {
          const q = document.createElement('div'); q.className = 'q'; q.textContent = t('you') + m.content;
          qa.appendChild(q);
        } else {
          const a = document.createElement('div'); a.className = 'a';
          renderMarkdown(a, m.content);
          qa.appendChild(a);
        }
        chatBody.appendChild(qa);
      }
      renderChatEmpty();
    } finally {
      chatEmptyObserver.observe(chatBody, { childList: true });
    }
  }
  // 空状态：无对话时展示欢迎 + 快捷指令（教会用户指令语言）
  function renderChatEmpty() {
    const hasContent = chatBody.querySelector('.qa');
    const empty = chatBody.querySelector('.chat-empty');
    if (hasContent) { if (empty) empty.remove(); return; }
    if (empty) return;
    const el = h(`<div class="chat-empty">
      <div class="ce-orb"><svg class="ic"><use href="#i-sparkle"/></svg></div>
      <div class="ce-title">${t('emptyTitle')}</div>
      <div class="ce-sub">${t('emptySub')}</div>
      <div class="ce-chips">
        <button class="ce-chip">${t('chipWeather')}</button>
        <button class="ce-chip">${t('chipFile')}</button>
        <button class="ce-chip">${t('chipTimer')}</button>
        <button class="ce-chip">${t('chipTranslate')}</button>
      </div>
    </div>`);
    el.querySelectorAll('.ce-chip').forEach((chip) => {
      chip.addEventListener('click', () => { chatInput.value = chip.textContent.trim(); autoGrowChatInput(); chatInput.focus(); });
    });
    chatBody.appendChild(el);
  }
  const chatEmptyObserver = new MutationObserver(() => renderChatEmpty());
  chatEmptyObserver.observe(chatBody, { childList: true });

  // ---------- AI 问答 ----------
  function syncChat() {
    // 下拉展开即展示 AI 问答历史（需求：下拉即可查看，无需先提问）
    if (lastSyncExpanded === state.expanded && lastSyncChatOpen === chatOpen) return;
    lastSyncExpanded = state.expanded;
    lastSyncChatOpen = chatOpen;
    chat.classList.toggle('open', state.expanded);
    chat.classList.toggle('active', state.expanded || chatOpen);
  }
  function openChat() {
    chatOpen = true;
    syncChat();
    setExpanded(true);
  }
  function closeChat() {
    chatOpen = false;
    chatHistoryEl.hidden = true;
    syncChat();
    layoutPanels();
  }
  // ---------- 字号 / 主面板收起切换 / 输入框 ----------
  function applyChatFont() {
    chatFont = clamp(chatFont, 12, 22);
    chat.style.setProperty('--chat-font', chatFont + 'px');
    try { localStorage.setItem(LS.chatFont, String(chatFont)); } catch (_) { /* ignore */ }
  }
  function applyPanelHidden() {
    panels.classList.toggle('solo', panelHidden);
    if (chatToggleUse) chatToggleUse.setAttribute('href', panelHidden ? '#i-next' : '#i-prev');
    lastPanelsPos = ''; // 布局中心改变，强制重算位置
    layoutPanels();
  }
  function togglePanel() {
    panelHidden = !panelHidden;
    try { localStorage.setItem(LS.panelHidden, panelHidden ? '1' : '0'); } catch (_) { /* ignore */ }
    applyPanelHidden();
  }
  function autoGrowChatInput() {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(140, chatInput.scrollHeight) + 'px';
  }
  function chatSendAction() {
    // 生成中：点击 = 停止输出
    if (active) { if (isElectron) window.electronAPI.aiAbort(active.id); return; }
    const q = chatInput.value.trim();
    if (!q) return;
    chatInput.value = '';
    autoGrowChatInput();
    handleAsk(q);
  }
  function setChatSendStreaming(on) {
    chatSend.classList.toggle('stop', on);
    if (chatSendUse) chatSendUse.setAttribute('href', on ? '#i-pause' : '#i-up');
    chatSend.title = on ? t('stopOutput') : t('sendTitle');
  }
  function appendQuestion(q) {
    const qa = document.createElement('div'); qa.className = 'qa';
    const qEl = document.createElement('div'); qEl.className = 'q'; qEl.textContent = t('you') + q;
    const aEl = document.createElement('div'); aEl.className = 'a';
    qa.appendChild(qEl); qa.appendChild(aEl);
    chatBody.appendChild(qa);
    chatBody.scrollTop = chatBody.scrollHeight;
    return aEl;
  }
  // 智能滚动：用户手动上翻看历史时不再强行拉回底部，只有本就在底部才跟随流式输出
  function stickToBottom(el) {
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }
  function askAI(q) {
    if (!isElectron) { showAnswer(t('previewAiNeed')); return; }
    const cfg = state.ai;
    if (!cfg.apiKey || !cfg.baseUrl) { showAnswer(t('configFirst')); chatStatus.textContent = t('configFirst'); return; }
    if (active) window.electronAPI.aiAbort(active.id);
    openChat();
    const aEl = appendQuestion(q);
    aEl.innerHTML = '<span class="think"><i></i><i></i><i></i></span>';
    chatStatus.textContent = t('statusThinking');
    chatModel.textContent = cfg.model || '';
    active = { id: ++aiReqId, el: aEl, text: '', q: q };
    setChatSendStreaming(true);
    const messages = [{ role: 'system', content: AI_SYSTEM() }].concat(chatHistory, [{ role: 'user', content: q }]);
    chatHistory.push({ role: 'user', content: q });
    saveChatHistory();
    window.electronAPI.aiChat({ id: active.id, config: { baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, model: cfg.model, temperature: 0.7 }, messages, query: q });
  }
  let aiReqId = 0;

  chatClear.addEventListener('click', () => {
    if (active) window.electronAPI.aiAbort(active.id);
    active = null;
    archiveCurrentChat();
    chatBody.innerHTML = '';
    chatHistory = [];
    try { localStorage.removeItem(LS.chat); } catch (_) { /* ignore */ }
    closeChat();
  });

  // 收起/展开主面板切换（AI 面板居中）
  chatToggleBtn.addEventListener('click', () => { togglePanel(); });
  // 字号调节
  chatFontMinus.addEventListener('click', () => { chatFont--; applyChatFont(); });
  chatFontPlus.addEventListener('click', () => { chatFont++; applyChatFont(); });
  // AI 设置（复用现有设置面板）
  chatSettingsBtn.addEventListener('click', (e) => { e.stopPropagation(); openSettings(); });
  // 输入框 + 发送/停止
  chatSend.addEventListener('click', chatSendAction);
  chatInput.addEventListener('keydown', (e) => {
    // 中文输入法组合态（选词）时按 Enter 不发送
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); chatSendAction(); }
  });
  chatInput.addEventListener('input', autoGrowChatInput);

  // ---------- 对话历史（清空时自动存档） ----------
  let chatSessions = loadSessions();
  function loadSessions() {
    try {
      const s = JSON.parse(localStorage.getItem(LS.sessions) || '[]');
      return Array.isArray(s) ? s : [];
    } catch (_) { return []; }
  }
  function saveSessions() {
    try {
      if (chatSessions.length > 30) chatSessions = chatSessions.slice(-30);
      localStorage.setItem(LS.sessions, JSON.stringify(chatSessions));
    } catch (_) { /* ignore */ }
  }
  function archiveCurrentChat() {
    const msgs = chatHistory.filter((m) => m && m.role && m.content);
    if (!msgs.length) return;
    const firstUser = msgs.find((m) => m.role === 'user');
    chatSessions.push({
      id: Date.now(), time: Date.now(),
      title: (firstUser ? firstUser.content : t('sessionDefault')).slice(0, 40),
      messages: msgs,
    });
    saveSessions();
  }
  function fmtSessionTime(ts) {
    const d = new Date(ts), now = new Date();
    const hm = d.toTimeString().slice(0, 5);
    if (d.toDateString() === now.toDateString()) return t('today', hm);
    if (d.toDateString() === new Date(now - 86400000).toDateString()) return t('yesterday', hm);
    return d.toLocaleDateString(window.I18N.lang === 'en' ? 'en-US' : 'zh-CN', { month: '2-digit', day: '2-digit' }) + ' ' + hm;
  }
  function renderHistoryList() {
    chatHistoryEl.innerHTML = '';
    const head = h('<div class="ch-head"><span class="ch-title"></span><button class="ch-close"><svg class="ic"><use href="#i-close"/></svg></button></div>');
    head.querySelector('.ch-title').textContent = t('historyTitle');
    head.querySelector('.ch-close').title = t('closeTitle');
    head.querySelector('.ch-close').addEventListener('click', () => { chatHistoryEl.hidden = true; });
    chatHistoryEl.appendChild(head);
    if (!chatSessions.length) {
      const emptyEl = h('<div class="ch-empty"><div class="ch-empty-title"></div><div class="ch-empty-sub"></div></div>');
      emptyEl.querySelector('.ch-empty-title').textContent = t('historyEmptyTitle');
      emptyEl.querySelector('.ch-empty-sub').textContent = t('historyEmptySub');
      chatHistoryEl.appendChild(emptyEl);
      return;
    }
    const list = h('<div class="ch-list"></div>');
    for (let i = chatSessions.length - 1; i >= 0; i--) {
      const s = chatSessions[i];
      const userN = s.messages.filter((m) => m.role === 'user').length;
      const item = h('<button class="ch-item" type="button"></button>');
      const titleEl = document.createElement('div'); titleEl.className = 'ch-item-title'; titleEl.textContent = s.title || t('sessionDefault');
      const metaEl = document.createElement('div'); metaEl.className = 'ch-item-meta';
      metaEl.textContent = fmtSessionTime(s.time) + ' · ' + t('sessionMeta', userN, s.messages.length);
      item.appendChild(titleEl); item.appendChild(metaEl);
      item.addEventListener('click', () => renderHistoryDetail(s.id));
      list.appendChild(item);
    }
    chatHistoryEl.appendChild(list);
  }
  function renderHistoryDetail(id) {
    const s = chatSessions.find((x) => x.id === id);
    if (!s) { renderHistoryList(); return; }
    chatHistoryEl.innerHTML = '';
    const head = h('<div class="ch-head"><button class="ch-back"><svg class="ic"><use href="#i-back"/></svg></button><span class="ch-title"></span></div>');
    head.querySelector('.ch-title').textContent = s.title || t('sessionDefault');
    head.querySelector('.ch-back').title = t('backTitle');
    head.querySelector('.ch-back').addEventListener('click', renderHistoryList);
    chatHistoryEl.appendChild(head);
    const body = h('<div class="ch-detail"></div>');
    for (const msg of s.messages) {
      const qa = h('<div class="qa"></div>');
      const el = document.createElement('div');
      el.className = msg.role === 'user' ? 'q' : 'a';
      if (msg.role === 'user') { el.textContent = t('you') + msg.content; }
      else { renderMarkdown(el, msg.content); }
      qa.appendChild(el);
      body.appendChild(qa);
    }
    chatHistoryEl.appendChild(body);
    const foot = h('<div class="ch-actions"><button class="tc ch-del"></button><span class="ch-spacer"></span><button class="tc ch-restore"></button></div>');
    foot.querySelector('.ch-del').textContent = t('delete');
    foot.querySelector('.ch-restore').textContent = t('restore');
    foot.querySelector('.ch-del').addEventListener('click', () => {
      chatSessions = chatSessions.filter((x) => x.id !== id);
      saveSessions();
      renderHistoryList();
    });
    foot.querySelector('.ch-restore').addEventListener('click', () => {
      if (active) { window.electronAPI.aiAbort(active.id); active = null; }
      chatHistory = s.messages.map((m) => ({ role: m.role, content: m.content }));
      saveChatHistory();
      renderHistoryToChat();
      chatHistoryEl.hidden = true;
    });
    chatHistoryEl.appendChild(foot);
  }
  // 导出当前对话为 Markdown
  chatExportBtn.addEventListener('click', async () => {
    const msgs = chatHistory.filter((m) => m && m.role && m.content);
    if (!msgs.length) { showAnswer(t('exportEmpty')); return; }
    const lines = [];
    for (const m of msgs) {
      const role = m.role === 'user' ? t('mdYou') : 'AI';
      lines.push('## ' + role, '', m.content, '');
    }
    const md = lines.join('\n');
    if (!isElectron || !window.electronAPI.exportChat) { showAnswer(t('exportEmpty')); return; }
    const r = await window.electronAPI.exportChat({ markdown: md, name: 'chat-' + new Date().toISOString().slice(0, 10) + '.md' });
    if (r && r.ok) showAnswer(t('exported'));
    else if (r && !r.canceled) showAnswer(t('exportFailed', r.msg || ''));
  });

  chatHistoryBtn.addEventListener('click', () => {
    if (chatHistoryEl.hidden) { renderHistoryList(); chatHistoryEl.hidden = false; }
    else chatHistoryEl.hidden = true;
  });

  if (isElectron && window.electronAPI.onAiChunk) {
    window.electronAPI.onAiChunk((d) => {
      const a = active;
      if (!a || d.id !== a.id) return;
      a.text += d.delta;
      if (!a.renderPending) {
        a.renderPending = true;
        requestAnimationFrame(() => {
          a.renderPending = false;
          if (active !== a) return;
          renderMarkdown(a.el, a.text);
          stickToBottom(chatBody);
        });
      }
    });
    window.electronAPI.onAiDone((d) => {
      if (!active || d.id !== active.id) return;
      chatStatus.textContent = d.aborted ? t('statusAborted') : t('statusDone');
      renderMarkdown(active.el, active.text);
      if (active.text) chatHistory.push({ role: 'assistant', content: active.text });
      saveChatHistory();
      const asked = active.q || '';
      active = null;
      setChatSendStreaming(false);
      // AI 回答完成：窗口未展开时用横幅提醒（iOS「时间敏感」语义）
      if (!d.aborted && !state.expanded && asked) {
        notify({
          app: 'ai', title: t('nbAiDoneTitle') || 'AI 已回复', body: asked.slice(0, 80), timeout: 6000,
          actions: [{ label: t('nbView') || '查看', primary: true, onClick: () => { setExpanded(true); openChat(); } }],
        });
      }
    });
    window.electronAPI.onAiError((d) => {
      if (!active || d.id !== active.id) return;
      chatStatus.textContent = t('statusError');
      active.el.textContent = '⚠ ' + d.message;
      const asked = active.q || '';
      active = null;
      setChatSendStreaming(false);
      notify({ app: 'ai', title: t('nbAiErrorTitle') || 'AI 请求失败', body: String(d.message || '').slice(0, 120), timeout: 6000 });
    });
  }

  function sendAI() {
    const v = askInput.value.trim();
    if (!v) return;
    askInput.value = '';
    handleAsk(v);
  }
  askSend.addEventListener('click', sendAI);
  askInput.addEventListener('keydown', (e) => {
    // 中文输入法选词时的 Enter 是确认候选词，不能当成发送（与 chatInput 一致）
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); sendAI(); }
  });

  // ---------- 截图 OCR ----------
  let ssState = null;
  async function startScreenshot() {
    if (!isElectron) { showAnswer(t('previewOcr')); return; }
    state.screenshot = true;
    setExpanded(false);
    updateIslandVisibility();
    updatePassthrough();
    setTimeout(async () => {
      const cap = await window.electronAPI.captureScreen();
      if (!cap || !cap.ok) {
        restoreAfterScreenshot();
        showAnswer(t('captureFailed', (cap && cap.reason) || ''));
        return;
      }
      ssState = { dataUrl: cap.dataUrl };
      screenshotEl.hidden = false;
    }, 220);
  }
  function restoreAfterScreenshot() {
    state.screenshot = false;
    updateIslandVisibility();
    updatePassthrough();
  }
  function cancelScreenshot() {
    screenshotEl.hidden = true;
    ssBox.hidden = true;
    ssState = null;
    restoreAfterScreenshot();
  }
  function ssRect(e) {
    const x = Math.min(ssState.sx, e.clientX), y = Math.min(ssState.sy, e.clientY);
    return { x, y, w: Math.abs(e.clientX - ssState.sx), h: Math.abs(e.clientY - ssState.sy) };
  }
  screenshotEl.addEventListener('pointerdown', (e) => {
    ssState.sx = e.clientX; ssState.sy = e.clientY;
    ssState.dragging = true;
    ssBox.hidden = false;
    screenshotEl.setPointerCapture(e.pointerId);
  });
  screenshotEl.addEventListener('pointermove', (e) => {
    if (!ssState || !ssState.dragging) return;
    const r = ssRect(e);
    ssBox.style.left = r.x + 'px'; ssBox.style.top = r.y + 'px';
    ssBox.style.width = r.w + 'px'; ssBox.style.height = r.h + 'px';
  });
  screenshotEl.addEventListener('pointerup', (e) => {
    if (!ssState || !ssState.dragging) return;
    ssState.dragging = false;
    const r = ssRect(e);
    const dataUrl = ssState.dataUrl;
    screenshotEl.hidden = true;
    ssBox.hidden = true;
    ssState = null;
    restoreAfterScreenshot();
    if (r.w < 5 || r.h < 5) { showAnswer(t('tooSmall')); return; }
    cropAndOcr(dataUrl, r);
  });
  let lastOcrShot = null; // { png: 放大版(本地OCR用), jpg: 原图(AI识别用) }
  function canUseAI() { return isElectron && !!(state.ai.apiKey && state.ai.baseUrl); }
  function cropAndOcr(dataUrl, r) {
    const img = new Image();
    img.onload = () => {
      try {
        const ratio = img.naturalWidth / window.innerWidth;
        const sx = r.x * ratio, sy = r.y * ratio, sw = r.w * ratio, sh = r.h * ratio;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(sw));
        canvas.height = Math.max(1, Math.round(sh));
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        // AI 用原图（JPEG 体积小）；本地 OCR 用放大版，小图放大能明显提升命中率
        const jpg = canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
        let out = canvas;
        const maxSide = Math.max(canvas.width, canvas.height);
        if (maxSide > 0 && maxSide < 700) {
          const scale = maxSide < 350 ? 3 : 2;
          out = document.createElement('canvas');
          out.width = canvas.width * scale; out.height = canvas.height * scale;
          const c2 = out.getContext('2d');
          c2.imageSmoothingEnabled = true; c2.imageSmoothingQuality = 'high';
          c2.drawImage(canvas, 0, 0, out.width, out.height);
        }
        const png = out.toDataURL('image/png').split(',')[1];
        lastOcrShot = { png, jpg };
        runOcr(png, jpg);
      } catch (e) {
        showAnswer(t('procError'));
      }
    };
    img.onerror = () => showAnswer(t('procFailed'));
    img.src = dataUrl;
  }
  async function aiOcrRequest(jpgB64) {
    if (!canUseAI()) return { ok: false, reason: t('noAIConfigured') };
    const cfg = state.ai;
    try {
      return await window.electronAPI.aiOcr({ base64: jpgB64, config: { baseUrl: cfg.baseUrl, apiKey: cfg.apiKey, model: cfg.visionModel || cfg.model }, lang: window.I18N.lang });
    } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
  }
  async function runOcr(pngB64, jpgB64) {
    const useAI = state.ocrEngine === 'local' ? false : canUseAI();
    if (state.ocrEngine === 'ai' && !canUseAI()) showAnswer(t('fallbackLocal'));
    if (useAI) {
      showAnswer(t('aiReading'));
      const res = await aiOcrRequest(jpgB64);
      if (res && res.ok) { showToolResult(t('grabAI'), (res.text || '').trim() || t('noText')); return; }
      const local = await window.electronAPI.ocrRecognize(pngB64);
      if (local && local.ok) { showToolResult(t('grabAIFallback'), (local.text || '').trim() || t('noText')); return; }
      showAnswer(t('ocrFailedBoth', (res && res.reason) || '', (local && local.reason) || ''));
      return;
    }
    const res = await window.electronAPI.ocrRecognize(pngB64);
    if (res && res.ok) {
      showToolResult(t('grabLocal'), (res.text || '').trim() || t('noText'), { aiRetry: true });
      return;
    }
    if (canUseAI()) {
      showAnswer(t('localFailedTryAi'));
      const aiRes = await aiOcrRequest(jpgB64);
      if (aiRes && aiRes.ok) { showToolResult(t('grabAI'), (aiRes.text || '').trim() || t('noText')); return; }
    }
    showAnswer(t('ocrFailed', (res && res.reason) || ''));
  }
  async function reRunAiOcr() {
    if (!lastOcrShot) return;
    if (!canUseAI()) { showAnswer(t('configFirst')); return; }
    showAnswer(t('aiRereading'));
    const res = await aiOcrRequest(lastOcrShot.jpg);
    if (res && res.ok) showToolResult(t('grabAI'), (res.text || '').trim() || t('noText'));
    else showAnswer(t('aiRereadFailed', (res && res.reason) || ''));
  }

  // ---------- 工具结果 / 翻译 ----------
  function fmtFileSize(b) {
    if (!isFinite(b) || b < 0) b = 0;
    if (b >= 1073741824) return (b / 1073741824).toFixed(1) + ' GB';
    if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
    if (b >= 1024) return (b / 1024).toFixed(0) + ' KB';
    return Math.round(b) + ' B';
  }
  async function searchFilesCommand(kw) {
    if (!isElectron) { showAnswer(t('previewFile')); return; }
    openChat();
    const qa = document.createElement('div'); qa.className = 'qa';
    const qEl = document.createElement('div'); qEl.className = 'q'; qEl.textContent = t('findFileEcho', kw);
    const aEl = document.createElement('div'); aEl.className = 'a'; aEl.textContent = t('searching');
    qa.appendChild(qEl); qa.appendChild(aEl);
    chatBody.appendChild(qa);
    chatBody.scrollTop = chatBody.scrollHeight;
    const res = await window.electronAPI.searchFiles(kw, 20);
    if (!res || !res.ok) { aEl.textContent = t('searchFailed', (res && res.reason) || ''); return; }
    const files = res.files || [];
    if (!files.length) {
      aEl.textContent = t('noFiles', kw);
      return;
    }
    aEl.textContent = t('foundFiles', files.length);
    const list = document.createElement('div'); list.className = 'file-list';
    for (const f of files) {
      const item = document.createElement('div'); item.className = 'file-item';
      const info = document.createElement('div'); info.className = 'file-info';
      const name = document.createElement('div'); name.className = 'file-name'; name.textContent = f.name; name.title = f.path;
      const meta = document.createElement('div'); meta.className = 'file-meta';
      meta.textContent = fmtFileSize(f.size || 0) + ' · ' + new Date(f.mtime || Date.now()).toLocaleString(window.I18N.lang === 'en' ? 'en-US' : 'zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
      info.appendChild(name); info.appendChild(meta);
      const btns = document.createElement('div'); btns.className = 'file-btns';
      const openBtn = document.createElement('button'); openBtn.className = 'tc'; openBtn.textContent = t('open');
      openBtn.addEventListener('click', async () => {
        const r = await window.electronAPI.openFile(f.path);
        if (r && !r.ok) showAnswer(t('openFailed', r.msg || ''));
      });
      const dirBtn = document.createElement('button'); dirBtn.className = 'tc'; dirBtn.textContent = t('showInFolder');
      dirBtn.addEventListener('click', () => { window.electronAPI.revealFile(f.path); });
      btns.appendChild(openBtn); btns.appendChild(dirBtn);
      item.appendChild(info); item.appendChild(btns);
      list.appendChild(item);
    }
    aEl.appendChild(list);
    chatBody.scrollTop = chatBody.scrollHeight;
  }
  fileBtn.addEventListener('click', () => {
    setExpanded(true);
    chatInput.value = t('findFileCmd') + ' ';
    autoGrowChatInput();
    chatInput.focus();
    const n = chatInput.value.length;
    try { chatInput.setSelectionRange(n, n); } catch (_) { /* ignore */ }
  });
  function showToolResult(title, text, opts) {
    openChat();
    const qa = document.createElement('div'); qa.className = 'qa';
    const q = document.createElement('div'); q.className = 'q'; q.textContent = title;
    const a = document.createElement('div'); a.className = 'a'; a.textContent = text;
    qa.appendChild(q); qa.appendChild(a);
    const btns = document.createElement('div'); btns.className = 'tool-actions';
    if (opts && opts.aiRetry && canUseAI()) {
      const rtBtn = document.createElement('button'); rtBtn.className = 'tc'; rtBtn.textContent = t('aiRetryBtn');
      rtBtn.addEventListener('click', reRunAiOcr);
      btns.appendChild(rtBtn);
    }
    const copyBtn = document.createElement('button'); copyBtn.className = 'tc'; copyBtn.textContent = t('copy');
    copyBtn.addEventListener('click', async () => {
      if (isElectron) { await window.electronAPI.writeClipboard(text); lastClip = text; showAnswer(t('copied')); }
    });
    btns.appendChild(copyBtn);
    if (isElectron && state.ai.apiKey) {
      const trBtn = document.createElement('button'); trBtn.className = 'tc primary'; trBtn.textContent = t('aiTranslate');
      trBtn.addEventListener('click', () => translateText(text));
      btns.appendChild(trBtn);
    }
    qa.appendChild(btns);
    chatBody.appendChild(qa);
    chatBody.scrollTop = chatBody.scrollHeight;
  }
  function translateText(text) {
    askAI(t('translatePrompt', text));
  }
  async function translateClipboard() {
    if (!isElectron) { showAnswer(t('previewUnavailable')); return; }
    const r = await window.electronAPI.readClipboard();
    const txt = (r && r.text || '').trim();
    if (!txt) { showAnswer(t('clipEmpty')); return; }
    lastClip = txt;
    translateText(txt);
  }
  ocrBtn.addEventListener('click', () => startScreenshot());
  translateBtn.addEventListener('click', translateClipboard);

  // ---------- 实时数据接收 ----------
  // 切歌通知：标题变化且非首次出现才弹，返回是否已通知（用于跳过赋值）
  let lastMediaKey = null;
  function notifyMediaChange(prev, next) {
    if (!next || !next.title) { if (!next) lastMediaKey = null; return false; }
    const key = next.title + '\u0000' + (next.artist || '');
    if (key === lastMediaKey) return false;
    const first = lastMediaKey == null;
    lastMediaKey = key;
    if (first || state.notif !== 'on') return false;
    if (isElectron && isPrimaryView()) {
      notify({
        app: 'media', title: next.title, body: next.artist || t('nowPlaying'),
        icon: next.cover || null, timeout: 5000,
        actions: [
          { label: t('nbPrev') || '上一首', onClick: () => mediaControl('prev') },
          { label: t('nbPlayPause') || '播放/暂停', primary: true, onClick: () => mediaControl('playpause') },
          { label: t('nbNext') || '下一首', onClick: () => mediaControl('next') },
        ],
      });
      return true;
    }
    return false;
  }
  if (isElectron && window.electronAPI.onLiveData) {
    window.electronAPI.onLiveData((d) => {
      live.ready = true;
      live.media = d.media || null;
      live.battery = d.battery || null;
      live.net = d.net || { down: 0, up: 0 };
      if (d.sys) live.sys = d.sys;
      if (d.primaryId != null) live.primaryId = d.primaryId;
      // 切歌通知（只在标题确实变化时弹，避免 2s 轮询刷屏）
      if (notifyMediaChange(live.media, d.media || null)) live.media = d.media || null;
      else if (!live.media || live.media.title !== (d.media && d.media.title)) live.media = d.media || null;
      reconcile();
      refreshCards();
      updateIsland();
    });
  } else if (!isElectron) {
    live.ready = true;
  }

  // ---------- 初始化 ----------
  function updateClock() {
    const now = new Date();
    footClock.textContent = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  }

  applyTheme();
  applyGlass();
  applyAmbient();
  applyIslandPosition();
  applyChatFont();
  applyPanelHidden();
  autoGrowChatInput(); // 初始即按占位文案高度撑开，避免提示文字被裁成两行
  [optGlass, optAmbOp, optEdge].forEach(syncRangeFill);
  if (isElectron && window.electronAPI.setLang) window.electronAPI.setLang(window.I18N.lang); // 主进程托盘/错误文案同步
  reconcile();
  refreshCards();
  updateIsland();
  updateClock();
  loadWeather();
  loadChatHistory();
  renderHistoryToChat();

  setInterval(() => {
    updateClock();
    timerTick();
    refreshCards();
    updateIsland();
    updateTimerFloat();
  }, 1000);

  // 剪贴板自动翻译
  setInterval(async () => {
    if (!autoTranslate || !isElectron || state.screenshot) return;
    try {
      const r = await window.electronAPI.readClipboard();
      const txt = (r && r.text || '').trim();
      if (txt && txt !== lastClip && txt.length <= 2000) {
        lastClip = txt;
        translateText(txt);
      }
    } catch (_) { /* ignore */ }
  }, 1200);

  window.addEventListener('resize', () => { applyIslandPosition(); if (state.expanded) layoutPanels(); });

  if (isElectron && window.electronAPI.onOpenSettings) {
    window.electronAPI.onOpenSettings(() => { if (!state.expanded) setExpanded(true); openSettings(); });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.screenshot) cancelScreenshot();
      else if (ncPanel && ncPanel.classList.contains('open')) openNotifCenter(false);
      else closeSettings();
    }
  });

  // ---------- 通知中心 / 横幅交互 ----------
  if (notifBtn) notifBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (ncPanel && ncPanel.classList.contains('open')) openNotifCenter(false);
    else openNotifCenter(true);
  });
  // 角标：未读条数（无横幅时展示通知中心里的条数）
  let lastBadgeCount = -1;
  function updateNbBadge() {
    if (!nbBadge) return;
    const count = notifLog.filter((n) => n.ts > (lastNotifSeen || 0)).length;
    if (count === lastBadgeCount) return;
    lastBadgeCount = count;
    nbBadge.textContent = count > 99 ? '99+' : String(count);
    nbBadge.hidden = count <= 0;
    if (notifBtn) notifBtn.classList.toggle('has-badge', count > 0);
  }
  let lastNotifSeen = 0;
  try { lastNotifSeen = Number(localStorage.getItem('lw_notif_seen') || 0) || 0; } catch (_) {}
  function markNotifSeen() {
    lastNotifSeen = Date.now();
    try { localStorage.setItem('lw_notif_seen', String(lastNotifSeen)); } catch (_) {}
    updateNbBadge();
  }
  if (ncClear) ncClear.addEventListener('click', (e) => { e.stopPropagation(); clearNotifLog(); markNotifSeen(); });
  if (ncDnd) {
    ncDnd.classList.toggle('on', notifDnd);
    ncDnd.addEventListener('click', (e) => { e.stopPropagation(); setNotifDnd(!notifDnd); toast(notifDnd ? (t('dndOn') || '勿扰已开启') : (t('dndOff') || '勿扰已关闭')); });
  }
  // 点击通知中心头部（非按钮区）收起
  if (ncPanel) {
    const ncHead = ncPanel.querySelector('.nc-head');
    if (ncHead) ncHead.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      openNotifCenter(false);
    });
  }
  // 通知中心打开时，把未读清零（iOS 打开通知中心即清除角标）
  if (ncPanel) {
    const ncObserver = new MutationObserver(() => {
      if (ncPanel.classList.contains('open')) markNotifSeen();
    });
    ncObserver.observe(ncPanel, { attributes: true, attributeFilter: ['class'] });
  }
  // 设置面板：通知模式切换
  if (optNotif) {
    optNotif.value = state.notif;
    optNotif.addEventListener('change', () => { setNotifMode(optNotif.value); });
  }
  if (ncModeHint) ncModeHint.classList.toggle('hidden', state.notif === 'on');
})();
