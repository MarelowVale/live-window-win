/**
 * preload.js — 安全地暴露主进程能力给渲染进程
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: 'electron',
  // ignore=true 表示鼠标穿透；forward=true 表示仍转发 mousemove 给页面
  setIgnoreMouse: (ignore, forward) => ipcRenderer.send('set-ignore-mouse', ignore, forward),
  quit: () => ipcRenderer.send('app-quit'),
  // 语言偏好同步到主进程（托盘菜单 / 错误文案随语言切换）
  setLang: (lang) => ipcRenderer.send('set-lang', lang),

  // 监听主进程（托盘）发来的「打开设置」
  onOpenSettings: (cb) => ipcRenderer.on('open-settings', () => cb()),
  // 监听主进程推送的实时系统数据（媒体/电池/网速/CPU/内存）
  onLiveData: (cb) => ipcRenderer.on('live-data', (_e, d) => cb(d)),

  // 天气
  getWeather: (city) => ipcRenderer.invoke('weather:get', { city: city || null }),

  // 应用启动 / 打开链接 / 搜索
  launch: (key) => ipcRenderer.invoke('app:launch', key),
  openUrl: (url) => ipcRenderer.invoke('shell:open', url),
  search: (q) => ipcRenderer.invoke('search', q),

  // 文件搜索（本地）
  searchFiles: (q, limit) => ipcRenderer.invoke('files:search', q, limit),
  openFile: (p) => ipcRenderer.invoke('files:open', p),
  revealFile: (p) => ipcRenderer.invoke('files:reveal', p),

  // 媒体控制（播放/暂停/切歌/跳转）
  mediaControl: (action, pos) => ipcRenderer.invoke('media:control', action, pos),
  // 打开正在播放媒体对应的应用
  activateMediaApp: () => ipcRenderer.invoke('media:activate'),

  // 导出对话为 Markdown 文件（系统保存对话框）
  exportChat: (payload) => ipcRenderer.invoke('chat:export', payload),

  // 开机自启
  getAutoStart: () => ipcRenderer.invoke('autostart:get'),
  setAutoStart: (enabled) => ipcRenderer.invoke('autostart:set', enabled),

  // AI 问答（流式）
  aiChat: (payload) => ipcRenderer.send('ai:chat', payload),
  aiAbort: (id) => ipcRenderer.send('ai:abort', id),
  onAiChunk: (cb) => ipcRenderer.on('ai-chunk', (_e, d) => cb(d)),
  onAiDone: (cb) => ipcRenderer.on('ai-done', (_e, d) => cb(d)),
  onAiError: (cb) => ipcRenderer.on('ai-error', (_e, d) => cb(d)),

  // 截图 / OCR / 剪贴板
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  ocrRecognize: (base64) => ipcRenderer.invoke('ocr:recognize', base64),
  aiOcr: (payload) => ipcRenderer.invoke('ocr:ai', payload),
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),

  // 桌面通知
  notify: (title, body) => ipcRenderer.send('notify', title, body),
});
