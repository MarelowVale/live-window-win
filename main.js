/**
 * main.js — Electron 主进程（实况窗 · Live Window）
 *
 * 设计要点：
 * 1. 为每个显示器创建一个「透明 + 无边框 + 置顶」的全屏覆盖窗口作为实况窗画布，
 *    支持多显示器：每个屏幕顶端都能触顶唤出。
 * 2. 通过 win.setIgnoreMouseEvents(true, { forward: true }) 让窗口对鼠标“穿透”，
 *    点击落到下方真实应用，但页面仍能收到 mousemove —— 实现“鼠标碰到屏幕顶端
 *    自动下拉”（联想天禧 AI 助手同款逻辑）。区域感知穿透逻辑在 renderer.js 中完成。
 * 3. 真实功能数据源：
 *    · sysmon.ps1（子进程，每 2s）：正在播放媒体(SMTC) / 电池 / 网络累计字节
 *    · Node 实时计算：CPU 占用率 / 内存占用
 *    · Open-Meteo + IP 定位：真实天气
 *    · 应用启动 / 打开链接 / 搜索 / 桌面通知
 * 4. 系统托盘：显示/隐藏、打开设置、退出；单实例锁避免重复启动。
 */

const { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage, Notification, shell, desktopCapturer, clipboard, dialog } = require('electron');
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

let tray = null;
let isQuitting = false;
let sysmon = null;
let lastNet = null;
let lastCpu = os.cpus();
const wins = new Map(); // display.id -> BrowserWindow

// 主进程界面语言（托盘菜单 / 错误文案），由渲染进程启动时同步
let uiLang = 'zh';
const L = (zh, en) => (uiLang === 'en' ? en : zh);

app.setAppUserModelId('com.workbuddy.livewindow');

// 单实例锁
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    for (const w of wins.values()) { if (!w.isDestroyed()) { w.show(); w.focus(); } }
  });

  app.whenReady().then(() => {
    createAllWindows();
    createTray();
    startSysmon();
    startTaskbarCompat();
    // 预热文件索引，第一次「找文件」不必等扫描
    setTimeout(() => { buildFileIndex().catch(() => {}); }, 4000);
  });
}

ipcMain.on('set-lang', (_e, lang) => {
  if (lang === 'en' || lang === 'zh') {
    if (uiLang !== lang) {
      uiLang = lang;
      if (tray && !tray.isDestroyed()) buildTrayMenu();
    }
  }
});

// ---------- 窗口 ----------
function createWindow(display) {
  const { x, y, width } = display.bounds;
  // 高度刻意少 1px：与屏幕完全等高的置顶窗口会被 Windows 当成「全屏应用」，
  // 任务栏设为自动隐藏时便不再响应底缘唤出（用户任务栏冲突的根因）。
  // 我们的内容全部在屏幕顶部，底部让出 1px 无任何视觉影响。
  const height = display.bounds.height - 1;
  const win = new BrowserWindow({
    x, y, width, height,
    frame: false,
    transparent: true,
    // 先隐藏，ready-to-show 再亮相：否则窗口创建瞬间会闪一帧白色全屏
    show: false,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    enableLargerThanScreen: false,
    roundedCorners: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });
  win.once('ready-to-show', () => { if (!win.isDestroyed()) win.show(); });
  // query.did 让渲染进程知道自己属于哪块屏（多屏时通知/自动翻译只由主屏执行）
  win.loadFile(path.join(__dirname, 'src', 'index.html'), { query: { did: String(display.id) } });

  win.webContents.on('did-finish-load', () => {
    win.setIgnoreMouseEvents(true, { forward: true });
    // 首次推送，让渲染进程尽快拿到系统状态
    pushLiveData();
  });

  win.on('closed', () => wins.delete(display.id));
  wins.set(display.id, win);
}

function createAllWindows() {
  for (const d of screen.getAllDisplays()) createWindow(d);
  screen.on('display-added', (_e, d) => createWindow(d));
  screen.on('display-removed', (_e, d) => {
    const w = wins.get(d.id);
    if (w && !w.isDestroyed()) w.close();
  });
  screen.on('display-metrics-changed', (_e, d) => {
    const w = wins.get(d.id);
    if (w && !w.isDestroyed()) {
      const b = d.bounds;
      try { w.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height - 1 }); } catch (_) { /* ignore */ }
    }
  });
}

// ---------- 任务栏自动隐藏兼容 ----------
// 本窗置顶级别（screen-saver）高于任务栏。光标压到屏幕底缘时临时交出最高层级，
// 让自动隐藏的任务栏能盖到我们之上滑出；光标明显离开底部后再恢复。
function startTaskbarCompat() {
  setInterval(() => {
    let p;
    try { p = screen.getCursorScreenPoint(); } catch (_) { return; }
    for (const w of wins.values()) {
      if (w.isDestroyed()) continue;
      const b = w.getBounds();
      const nearBottom = p.x >= b.x && p.x < b.x + b.width && p.y >= b.y + b.height - 4;
      if (nearBottom && !w._tbLowered) {
        w._tbLowered = true;
        try { w.setAlwaysOnTop(false); } catch (_) { /* ignore */ }
      } else if (!nearBottom && w._tbLowered && p.y < b.y + b.height - 60) {
        w._tbLowered = false;
        try { w.setAlwaysOnTop(true, 'screen-saver'); } catch (_) { /* ignore */ }
      }
    }
  }, 250);
}

function broadcast(channel, ...args) {
  for (const w of wins.values()) {
    if (!w.isDestroyed()) w.webContents.send(channel, ...args);
  }
}

function toggleWindows() {
  const allHidden = [...wins.values()].every((w) => w.isDestroyed() || !w.isVisible());
  for (const w of wins.values()) {
    if (w.isDestroyed()) continue;
    if (allHidden) { w.show(); } else { w.hide(); }
  }
}

function buildTrayMenu() {
  const items = [
    { label: L('显示 / 隐藏', 'Show / Hide'), click: () => toggleWindows() },
    { label: L('打开设置', 'Open Settings'), click: () => broadcast('open-settings') },
    { type: 'separator' },
    { label: L('退出', 'Quit'), click: () => { isQuitting = true; app.quit(); } },
  ];
  tray.setContextMenu(Menu.buildFromTemplate(items));
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('实况窗 · Live Window');
  buildTrayMenu();
  tray.on('click', () => toggleWindows());
}

// ---------- 系统状态采集 ----------
function cpuUsage() {
  const cpus = os.cpus();
  let idle = 0, total = 0, iPrev = 0, tPrev = 0;
  for (let i = 0; i < cpus.length; i++) {
    const c = cpus[i].times;
    const p = lastCpu[i] ? lastCpu[i].times : c;
    total += c.user + c.nice + c.sys + c.idle + c.irq;
    idle += c.idle;
    tPrev += p.user + p.nice + p.sys + p.idle + p.irq;
    iPrev += p.idle;
  }
  lastCpu = cpus;
  const dt = total - tPrev, di = idle - iPrev;
  return dt <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((1 - di / dt) * 100)));
}

function systemInfo() {
  const cpu = cpuUsage();
  const memTotal = os.totalmem(), memFree = os.freemem();
  const memUsed = memTotal - memFree;
  return {
    cpu,
    memPct: Math.round(memUsed / memTotal * 100),
    memUsed,
    memTotal,
    uptime: Math.floor(os.uptime()),
  };
}

function handleSysmon(d) {
  let down = 0, up = 0;
  if (d.net) {
    const now = Date.now();
    if (lastNet) {
      const dt = (now - lastNet.t) / 1000;
      if (dt > 0) {
        down = Math.max(0, (d.net.rx - lastNet.rx) / dt);
        up = Math.max(0, (d.net.tx - lastNet.tx) / dt);
      }
    }
    lastNet = { rx: d.net.rx, tx: d.net.tx, t: now };
  }
  livePayload = {
    media: d.media || null,
    battery: d.battery || null,
    net: { down, up },
    sys: systemInfo(),
    primaryId: primaryDisplayId(),
  };
  broadcast('live-data', livePayload);
}

function primaryDisplayId() {
  try { return screen.getPrimaryDisplay().id; } catch (_) { return null; }
}

let livePayload = null;
function pushLiveData() {
  if (!livePayload) {
    livePayload = { media: null, battery: null, net: { down: 0, up: 0 }, sys: systemInfo(), primaryId: primaryDisplayId() };
  }
  broadcast('live-data', livePayload);
}

function sysmonScriptPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'scripts', 'sysmon.ps1')
    : path.join(__dirname, 'scripts', 'sysmon.ps1');
}

function startSysmon() {
  const script = sysmonScriptPath();
  if (!fs.existsSync(script)) return; // 无脚本则跳过（纯系统/天气功能仍可用）
  sysmon = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script], { windowsHide: true });
  let buf = '';
  sysmon.stdout.on('data', (d) => {
    buf += d.toString();
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      try {
        const obj = JSON.parse(Buffer.from(line, 'base64').toString('utf8'));
        handleSysmon(obj);
      } catch (_) { /* ignore malformed line */ }
    }
  });
  sysmon.on('error', () => { /* ignore */ });
  sysmon.on('exit', () => { if (!isQuitting) setTimeout(startSysmon, 3000); });
}

// ---------- 天气 ----------
async function fetchWeather(lat, lon, city) {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
    '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m' +
    '&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto';
  const r = await fetch(url);
  const j = await r.json();
  const cur = j.current || {};
  const daily = [];
  if (j.daily && Array.isArray(j.daily.time)) {
    for (let i = 0; i < Math.min(5, j.daily.time.length); i++) {
      daily.push({
        date: j.daily.time[i],
        max: j.daily.temperature_2m_max ? j.daily.temperature_2m_max[i] : null,
        min: j.daily.temperature_2m_min ? j.daily.temperature_2m_min[i] : null,
        code: j.daily.weather_code ? j.daily.weather_code[i] : 0,
      });
    }
  }
  return {
    city,
    lat, lon,
    temp: cur.temperature_2m, feels: cur.apparent_temperature,
    humidity: cur.relative_humidity_2m, wind: cur.wind_speed_10m,
    code: cur.weather_code, time: cur.time,
    daily,
  };
}

ipcMain.handle('weather:get', async (_e, opts) => {
  try {
    if (opts && opts.city) {
      const g = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(opts.city) + '&count=1&language=' + (uiLang === 'en' ? 'en' : 'zh') + '&format=json');
      const gj = await g.json();
      if (gj.results && gj.results[0]) {
        const r0 = gj.results[0];
        return await fetchWeather(r0.latitude, r0.longitude, r0.name || opts.city);
      }
      return { error: L('未找到该城市，请换个名称试试', 'City not found. Try another name') };
    }
    const g = await fetch('http://ip-api.com/json/?lang=' + (uiLang === 'en' ? 'en' : 'zh-CN') + '&fields=status,city,regionName,lat,lon');
    const gj = await g.json();
    if (gj && gj.status === 'success') {
      return await fetchWeather(gj.lat, gj.lon, gj.city || gj.regionName || L('当前位置', 'Current location'));
    }
    return { error: L('定位失败，可输入「天气 城市名」查询', 'Location failed. Try "weather <city>"') };
  } catch (e) {
    return { error: L('天气服务暂时不可用：', 'Weather service unavailable: ') + (e && e.message ? e.message : e) };
  }
});

// ---------- 媒体控制（SMTC） ----------
function scriptPath(name) {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'scripts', name)
    : path.join(__dirname, 'scripts', name);
}

function runMediaControl(action, pos) {
  return new Promise((resolve) => {
    const script = scriptPath('mediactl.ps1');
    if (!fs.existsSync(script)) return resolve({ ok: false, reason: 'no script' });
    const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-Action', action];
    if (pos != null) args.push('-Pos', String(pos));
    let out = '';
    let child;
    try { child = spawn('powershell', args, { windowsHide: true }); }
    catch (e) { return resolve({ ok: false, reason: String(e && e.message || e) }); }
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.on('error', () => resolve({ ok: false, reason: 'spawn error' }));
    child.on('close', () => { try { resolve(JSON.parse(out.trim())); } catch (_) { resolve({ ok: false, reason: 'parse error' }); } });
  });
}
ipcMain.handle('media:control', (_e, action, pos) => runMediaControl(action, pos));

// 打开正在播放媒体对应的应用（SMTC 上报的 AUMID → shell:AppsFolder 激活）
ipcMain.handle('media:activate', () => {
  try {
    const aumid = livePayload && livePayload.media && livePayload.media.app;
    if (!aumid || typeof aumid !== 'string') return { ok: false, msg: L('没有正在播放的媒体应用', 'No active media app') };
    // 只允许 AUMID 合法字符，避免参数注入
    const safe = aumid.replace(/[^A-Za-z0-9._!\-]/g, '');
    if (!safe) return { ok: false, msg: L('应用标识无效', 'Invalid app id') };
    spawn('explorer.exe', ['shell:AppsFolder\\' + safe], { detached: true, windowsHide: true }).unref();
    return { ok: true };
  } catch (e) {
    return { ok: false, msg: String(e && e.message || e) };
  }
});

// ---------- AI 问答（OpenAI 兼容流式） ----------
const AI_STREAMS = new Map();

// ---------- 文件搜索（内存索引 + 异步扫描，不阻塞主进程） ----------
// 首次/每 5 分钟异步重建一次文件名索引；搜索只查索引，并对候选结果按
// 「精确匹配 > 开头匹配 > 包含匹配 + 最近修改」排序，命中率与速度都更好。
const SEARCH_ROOTS = ['Desktop', 'Documents', 'Downloads', 'Pictures', 'Music', 'Videos'];
let fileIndex = { at: 0, files: [] };
let indexingPromise = null;

async function buildFileIndex() {
  if (indexingPromise) return indexingPromise;
  indexingPromise = (async () => {
    const files = [];
    const MAXFILES = 40000, MAXDEPTH = 6;
    async function walk(dir, depth) {
      if (files.length >= MAXFILES) return;
      let entries;
      try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch (_) { return; }
      for (const ent of entries) {
        if (files.length >= MAXFILES) break;
        if (!ent || !ent.name || ent.name[0] === '.' || ent.name[0] === '$') continue;
        const full = path.join(dir, ent.name);
        try {
          if (ent.isDirectory()) { if (depth < MAXDEPTH) await walk(full, depth + 1); }
          else if (ent.isFile()) files.push({ name: ent.name, path: full });
        } catch (_) { /* ignore */ }
      }
    }
    for (const r of SEARCH_ROOTS) await walk(path.join(os.homedir(), r), 0);
    fileIndex = { at: Date.now(), files };
    indexingPromise = null;
    return files;
  })();
  return indexingPromise;
}

async function searchLocalFiles(query, maxResults) {
  if (!fileIndex.files.length || Date.now() - fileIndex.at > 5 * 60 * 1000) {
    await buildFileIndex();
  }
  const limit = maxResults || 20;
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  // 多个关键词：全部命中（AND），比旧的任一命中（OR）更贴合直觉
  const tokens = q.split(/\s+/).filter(Boolean);
  const matches = [];
  for (const f of fileIndex.files) {
    const n = f.name.toLowerCase();
    if (!tokens.every((tk) => n.includes(tk))) continue;
    const dot = n.lastIndexOf('.');
    const stem = dot > 0 ? n.slice(0, dot) : n;
    let score = 30;
    if (n === q || stem === q) score = 120;
    else if (stem.startsWith(tokens[0])) score = 70;
    else if (tokens[0].length >= 2 && stem.includes(tokens[0])) score = 40;
    matches.push({ f, score });
    if (matches.length >= 1200) break;
  }
  matches.sort((a, b) => b.score - a.score);
  const out = [];
  for (const m of matches.slice(0, Math.max(limit * 3, limit))) {
    try {
      const st = await fs.promises.stat(m.f.path);
      out.push({ name: m.f.name, path: m.f.path, size: st.size, mtime: st.mtimeMs, _s: m.score });
    } catch (_) { /* 文件可能刚被移动或删除 */ }
  }
  out.sort((a, b) => (b._s - a._s) || (b.mtime - a.mtime));
  return out.slice(0, limit).map((r) => ({ name: r.name, path: r.path, size: r.size, mtime: r.mtime }));
}

ipcMain.on('ai:chat', async (e, payload) => {
  const { id, config, messages, query } = payload || {};
  const sender = e.sender;
  if (!config || !config.apiKey || !config.baseUrl) {
    sender.send('ai-error', { id, message: L('请先在设置中配置 AI 的 API Key 与 Base URL', 'Please configure the AI API Key and Base URL in Settings first') });
    return;
  }
  let finalMessages = messages || [];
  if (query) {
    let files = [];
    try { files = await searchLocalFiles(query, 12); } catch (_) { files = []; }
    if (files.length) {
      const fileCtx = '以下是按用户关键词在电脑（桌面/文档/下载）中匹配到的文件，可在回答中引用：\n' +
        files.map((f, i) => (i + 1) + '. ' + f.name + '  [' + f.path + ']').join('\n');
      finalMessages = [{ role: 'system', content: fileCtx }].concat(messages || []);
    }
  }
  const base = String(config.baseUrl).replace(/\/+$/, '');
  const url = base + '/chat/completions';
  const ac = new AbortController();
  AI_STREAMS.set(id, ac);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + config.apiKey },
      body: JSON.stringify({ model: config.model || 'gpt-4o-mini', messages: finalMessages, stream: true, temperature: Number(config.temperature ?? 0.7) }),
      signal: ac.signal,
    });
    if (!res.ok) {
      const t = await res.text();
      sender.send('ai-error', { id, message: 'HTTP ' + res.status + ': ' + t.slice(0, 400) });
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let finished = false;
    while (!finished) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') { finished = true; break; }
        try {
          const j = JSON.parse(data);
          const delta = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
          if (delta) sender.send('ai-chunk', { id, delta });
        } catch (_) { /* ignore */ }
      }
    }
    sender.send('ai-done', { id });
  } catch (err) {
    if (err && err.name === 'AbortError') sender.send('ai-done', { id, aborted: true });
    else sender.send('ai-error', { id, message: String(err && err.message || err) });
  } finally {
    AI_STREAMS.delete(id);
  }
});

ipcMain.on('ai:abort', (_e, id) => { const ac = AI_STREAMS.get(id); if (ac) ac.abort(); });

// ---------- 截图 / OCR / 剪贴板 ----------
function runPowershellJson(script, args) {
  return new Promise((resolve) => {
    if (!fs.existsSync(script)) return resolve({ ok: false, reason: 'no script' });
    let out = '';
    let child;
    try { child = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script].concat(args), { windowsHide: true }); }
    catch (e) { return resolve({ ok: false, reason: String(e && e.message || e) }); }
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', () => { /* ignore */ });
    child.on('error', () => resolve({ ok: false, reason: 'spawn error' }));
    child.on('close', () => { try { resolve(JSON.parse(out.trim())); } catch (_) { resolve({ ok: false, reason: 'parse error' }); } });
  });
}

ipcMain.handle('capture-screen', async () => {
  const hidden = [];
  try {
    // 截图前隐藏所有自身窗口：desktopCapturer 拍的是真实屏幕输出，
    // 本软件的透明覆盖层（灵动岛/面板）若可见会被拍进去
    for (const w of wins.values()) {
      if (!w.isDestroyed() && w.isVisible()) { w.hide(); hidden.push(w); }
    }
    // 等待 DWM 合成器刷新，确保隐藏生效后再抓屏
    await new Promise((r) => setTimeout(r, 350));
    const primary = screen.getPrimaryDisplay();
    const { width, height } = primary.size;
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width, height } });
    if (!sources.length) return { ok: false, reason: 'no screen' };
    return { ok: true, dataUrl: sources[0].thumbnail.toDataURL(), scaleFactor: primary.scaleFactor };
  } catch (e) {
    return { ok: false, reason: String(e && e.message || e) };
  } finally {
    // 无论成败都恢复窗口（仅恢复原本就可见的）
    for (const w of hidden) { if (!w.isDestroyed()) w.show(); }
  }
});

ipcMain.handle('ocr:recognize', async (_e, base64) => {
  try {
    if (!base64) return { ok: false, reason: 'no image' };
    const buf = Buffer.from(base64, 'base64');
    const tmp = path.join(os.tmpdir(), 'lw_ocr_' + Date.now() + '.png');
    fs.writeFileSync(tmp, buf);
    const res = await runPowershellJson(scriptPath('ocr.ps1'), ['-Path', tmp]);
    try { fs.unlinkSync(tmp); } catch (_) { /* ignore */ }
    return res;
  } catch (e) {
    return { ok: false, reason: String(e && e.message || e) };
  }
});

// AI 视觉识别（走已配置的视觉模型，比 Windows 本地 OCR 准确率高得多）
ipcMain.handle('ocr:ai', async (_e, payload) => {
  try {
    const { base64, config, lang } = payload || {};
    const isEn = lang === 'en';
    if (!base64) return { ok: false, reason: 'no image' };
    if (!config || !config.apiKey || !config.baseUrl) return { ok: false, reason: L('未配置 AI', 'No AI configured') };
    const base = String(config.baseUrl).replace(/\/+$/, '');
    const res = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + config.apiKey },
      body: JSON.stringify({
        model: config.model || 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: isEn
                ? 'Recognize all text in this screenshot exactly, preserving original line breaks and layout. Output only the text itself — no explanations, no annotations, no code blocks. If there is no text in the image, output only: (No text recognized)'
                : '精确识别这张截图中的所有文字，保持原有换行与排版，逐行原样输出。只输出文字本身，不要解释、不要标注、不要使用代码块。若图中没有文字，只输出：（未识别到文字）',
            },
            { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + base64 } },
          ],
        }],
        temperature: 0,
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) return { ok: false, reason: 'HTTP ' + res.status + ': ' + (await res.text()).slice(0, 300) };
    const j = await res.json();
    const text = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!text) return { ok: false, reason: L('模型返回为空（可能不支持图片输入，请在设置中填写视觉模型）', 'Empty model response (may not support image input — set a vision model in Settings)') };
    return { ok: true, text: String(text).trim() };
  } catch (e) {
    return { ok: false, reason: String(e && e.message || e) };
  }
});

ipcMain.handle('clipboard:read', () => ({ ok: true, text: clipboard.readText() }));
ipcMain.handle('clipboard:write', (_e, text) => { try { clipboard.writeText(String(text || '')); return { ok: true }; } catch (e) { return { ok: false, reason: String(e && e.message || e) }; } });

// ---------- 应用启动 / 链接 / 搜索 / 通知 ----------
const APP_MAP = {
  '计算器': 'calc.exe', 'calculator': 'calc.exe',
  '记事本': 'notepad.exe', 'notepad': 'notepad.exe',
  '任务管理器': 'taskmgr.exe', 'task manager': 'taskmgr.exe',
  '画图': 'mspaint.exe', 'paint': 'mspaint.exe',
  '命令提示符': 'cmd.exe', 'cmd': 'cmd.exe', 'terminal': 'cmd.exe',
  '资源管理器': 'explorer.exe', 'explorer': 'explorer.exe', 'file explorer': 'explorer.exe',
};

ipcMain.handle('app:launch', async (_e, key) => {
  try {
    if (key === '设置' || key === 'settings') { await shell.openExternal('ms-settings:'); return { ok: true }; }
    const exe = APP_MAP[String(key || '').toLowerCase()];
    if (exe) {
      const base = exe === 'explorer.exe' ? process.env.SystemRoot : path.join(process.env.SystemRoot, 'System32');
      const full = path.join(base, exe);
      const err = await shell.openPath(full);
      if (err) return { ok: false, msg: err };
      return { ok: true };
    }
    return { ok: false, msg: L('未识别的应用：', 'Unrecognized app: ') + key };
  } catch (e) {
    return { ok: false, msg: String(e && e.message || e) };
  }
});

ipcMain.handle('shell:open', async (_e, url) => {
  if (/^https?:\/\//i.test(url)) {
    await shell.openExternal(url);
    return { ok: true };
  }
  return { ok: false, msg: L('仅支持 http/https 链接', 'Only http/https URLs are supported') };
});

ipcMain.handle('search', async (_e, q) => {
  await shell.openExternal('https://cn.bing.com/search?q=' + encodeURIComponent(q));
  return { ok: true };
});

// ---------- 文件搜索（本地，无需 AI） ----------
ipcMain.handle('files:search', async (_e, q, limit) => {
  try {
    const kw = String(q || '').trim();
    if (!kw) return { ok: false, reason: L('请输入关键词', 'Please enter a keyword') };
    return { ok: true, files: await searchLocalFiles(kw, Number(limit) || 20) };
  } catch (e) { return { ok: false, reason: String(e && e.message || e) }; }
});
ipcMain.handle('files:open', async (_e, p) => {
  try {
    if (!p || typeof p !== 'string') return { ok: false, msg: L('路径无效', 'Invalid path') };
    const err = await shell.openPath(p);
    return err ? { ok: false, msg: err } : { ok: true };
  } catch (e) { return { ok: false, msg: String(e && e.message || e) }; }
});
ipcMain.handle('files:reveal', (_e, p) => {
  try {
    if (!p || typeof p !== 'string') return { ok: false, msg: L('路径无效', 'Invalid path') };
    spawn('explorer', ['/select,', p], { detached: true, windowsHide: true }).unref();
    return { ok: true };
  } catch (e) { return { ok: false, msg: String(e && e.message || e) }; }
});

// ---------- 通知 ----------
// renderer 的通知中心（.nb-stack）负责横幅 UI；这里保留一条系统通知兜底，
// 让番茄钟/切歌提醒在实况窗被隐藏（托盘隐藏）时仍可经系统托盘区域可见。
ipcMain.on('notify', (_e, title, body) => {
  if (Notification.isSupported()) {
    new Notification({ title: title || '实况窗', body: body || '', silent: false }).show();
  }
});

// ---------- 导出对话为 Markdown ----------
ipcMain.handle('chat:export', async (e, payload) => {
  try {
    const { markdown, name } = payload || {};
    if (!markdown) return { ok: false, msg: L('没有可导出的内容', 'Nothing to export') };
    const win = BrowserWindow.fromWebContents(e.sender);
    const opts = {
      title: L('导出对话为 Markdown', 'Export chat as Markdown'),
      defaultPath: String(name || 'chat.md'),
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    };
    const res = win && !win.isDestroyed()
      ? await dialog.showSaveDialog(win, opts)
      : await dialog.showSaveDialog(opts);
    if (res.canceled || !res.filePath) return { ok: false, canceled: true };
    fs.writeFileSync(res.filePath, String(markdown), 'utf8');
    return { ok: true, path: res.filePath };
  } catch (e2) {
    return { ok: false, msg: String(e2 && e2.message || e2) };
  }
});

// ---------- 开机自启 ----------
function getAutoStartPath() {
  // 对 portable 版本也要显式指定当前 exe 完整路径，否则 setLoginItemSettings
  // 在 Windows 上可能写不到注册表 / 启动文件夹
  try { return app.getPath('exe'); } catch (_) { return process.execPath; }
}

ipcMain.handle('autostart:get', () => {
  try {
    const settings = app.getLoginItemSettings({ path: getAutoStartPath() });
    return { ok: true, enabled: !!(settings && settings.openAtLogin) };
  } catch (e) { return { ok: false, msg: String(e && e.message || e) }; }
});

ipcMain.handle('autostart:set', (_e, enabled) => {
  try {
    const exePath = getAutoStartPath();
    app.setLoginItemSettings({ openAtLogin: !!enabled, path: exePath });
    // 二次读取确认实际写入结果
    const settings = app.getLoginItemSettings({ path: exePath });
    return { ok: true, enabled: !!(settings && settings.openAtLogin) };
  } catch (e) { return { ok: false, msg: String(e && e.message || e) }; }
});

// ---------- IPC：穿透 / 退出 ----------
const winIgnoreState = new WeakMap(); // BrowserWindow -> boolean (current ignore state)
ipcMain.on('set-ignore-mouse', (e, ignore, forward) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win) return;
  const curr = !!winIgnoreState.get(win);
  const next = !!ignore;
  if (curr === next) return; // 状态未变，避免高频闪烁
  winIgnoreState.set(win, next);
  try { win.setIgnoreMouseEvents(next, { forward: !!forward }); } catch (_) { /* ignore */ }
});

ipcMain.on('app-quit', () => { isQuitting = true; app.quit(); });

app.on('before-quit', () => {
  isQuitting = true;
  if (sysmon) { try { sysmon.kill(); } catch (_) { /* ignore */ } }
});

// 常驻覆盖层，关闭窗口不直接退出（由托盘退出）
app.on('window-all-closed', () => { /* keep alive while tray is present */ });
app.on('activate', () => { if (wins.size === 0) createAllWindows(); });
