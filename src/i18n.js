/**
 * i18n.js — 双语字典（中文 / English）
 * HTML 静态文案用 data-i18n / data-i18n-title / data-i18n-placeholder 属性标注
 * 动态文案用 I18N.t('key', arg0, ...)，模板 {0} {1} 替换
 */
(function () {
  'use strict';

  const DICT = {
    // ---------- 灵动岛 / 通用 ----------
    islandTitle: { zh: '实况窗', en: 'Live Window' },
    islandSub: { zh: '触顶展开', en: 'Hover top to expand' },
    edgeHint: { zh: '把鼠标移到屏幕最顶端 ↑ 唤出实况窗', en: 'Move cursor to the very top edge to summon Live Window' },
    gripTitle: { zh: '拖拽移动', en: 'Drag to move' },
    pinTitle: { zh: '固定 / 取消固定', en: 'Pin / Unpin' },
    settingsTitle: { zh: '设置', en: 'Settings' },
    sendTitle: { zh: '发送', en: 'Send' },
    footHint: { zh: '输入问题或指令 · 触顶展开', en: 'Ask or command · hover top to expand' },
    askPlaceholder: { zh: 'Search or Ask · AI 问答 / 找文件', en: 'Search or Ask · AI chat / find files' },

    // ---------- 工具按钮 ----------
    findFile: { zh: '找文件', en: 'Find Files' },
    grabText: { zh: '截图取字', en: 'Grab Text' },
    translateClip: { zh: '翻译剪贴板', en: 'Translate Clipboard' },

    // ---------- AI 面板 ----------
    chatTitle: { zh: 'AI 助手', en: 'AI Assistant' },
    statusReady: { zh: '就绪', en: 'Ready' },
    statusThinking: { zh: '思考中…', en: 'Thinking…' },
    statusDone: { zh: '完成', en: 'Done' },
    statusAborted: { zh: '已中断', en: 'Aborted' },
    statusError: { zh: '出错', en: 'Error' },
    historyTitle: { zh: '对话历史', en: 'History' },
    exportTitle: { zh: '导出 Markdown', en: 'Export Markdown' },
    togglePanelTitle: { zh: '收起 / 展开主面板', en: 'Collapse / Expand main panel' },
    fontMinusTitle: { zh: '减小字号', en: 'Smaller font' },
    fontPlusTitle: { zh: '增大字号', en: 'Larger font' },
    aiSettingsTitle: { zh: 'AI 设置', en: 'AI Settings' },
    chatInputPlaceholder: { zh: '输入问题，Enter 发送，Shift+Enter 换行', en: 'Ask anything. Enter to send, Shift+Enter for newline' },
    stopOutput: { zh: '停止输出', en: 'Stop generating' },
    exported: { zh: '已导出 Markdown', en: 'Markdown exported' },
    exportEmpty: { zh: '当前没有可导出的对话', en: 'Nothing to export yet' },
    exportFailed: { zh: '导出失败：{0}', en: 'Export failed: {0}' },
    mdYou: { zh: '你', en: 'You' },
    clear: { zh: '清空', en: 'Clear' },
    you: { zh: '你：', en: 'You: ' },
    emptyTitle: { zh: '你好，我是实况窗 AI', en: 'Hi, I am Live Window AI' },
    emptySub: { zh: '在下方输入问题，或点一下试试：', en: 'Type a question below, or tap to try:' },
    chipWeather: { zh: '天气', en: 'weather' },
    chipFile: { zh: '找文件 报告', en: 'find files report' },
    chipTimer: { zh: '计时 10 分钟', en: 'timer 10 min' },
    chipTranslate: { zh: '翻译剪贴板', en: 'translate clipboard' },
    sessionDefault: { zh: '对话', en: 'Chat' },
    today: { zh: '今天 {0}', en: 'Today {0}' },
    yesterday: { zh: '昨天 {0}', en: 'Yesterday {0}' },
    historyEmptyTitle: { zh: '暂无历史对话', en: 'No history yet' },
    historyEmptySub: { zh: '点击「清空」结束当前对话时会自动存档到这里，最多保留 30 条', en: 'Chats are archived here when you hit "Clear" — up to 30 sessions' },
    closeTitle: { zh: '关闭', en: 'Close' },
    backTitle: { zh: '返回列表', en: 'Back to list' },
    delete: { zh: '删除', en: 'Delete' },
    restore: { zh: '恢复到当前对话', en: 'Restore to current chat' },
    sessionMeta: { zh: '{0} 个提问 · {1} 条消息', en: '{0} questions · {1} messages' },

    // ---------- 设置 ----------
    settingsHeader: { zh: '实况窗设置', en: 'Live Window Settings' },
    cardsSec: { zh: '显示卡片（可关闭不需要的功能）', en: 'Cards (disable features you don\'t need)' },
    mediaCard: { zh: '正在播放媒体', en: 'Now Playing' },
    timerCard: { zh: '番茄钟', en: 'Pomodoro' },
    weatherCard: { zh: '天气', en: 'Weather' },
    systemCard: { zh: '系统状态', en: 'System Status' },
    batteryCard: { zh: '电池', en: 'Battery' },
    aiSec: { zh: 'AI 助手（Search or Ask）', en: 'AI Assistant (Search or Ask)' },
    provider: { zh: '服务商', en: 'Provider' },
    custom: { zh: '自定义', en: 'Custom' },
    model: { zh: '模型', en: 'Model' },
    visionModel: { zh: '视觉模型（截图取字用）', en: 'Vision model (for text grab)' },
    visionPlaceholder: { zh: '留空用上方模型；如 qwen-vl-plus / glm-4v-flash / gpt-4o-mini', en: 'Blank = model above; e.g. qwen-vl-plus / glm-4v-flash / gpt-4o-mini' },
    saveAi: { zh: '保存 AI 配置', en: 'Save AI Config' },
    aiTip: { zh: 'API Key 仅保存在本机（localStorage）。支持任意 OpenAI 兼容接口。', en: 'API Key is stored locally only (localStorage). Any OpenAI-compatible API works.' },
    aiSaved: { zh: '✅ 已保存（Key 仅存本机）', en: '✅ Saved (key stored locally)' },
    aiNoKey: { zh: '⚠ 未填写 API Key，AI 问答将不可用。', en: '⚠ No API Key — AI chat will be unavailable.' },
    ocrEngine: { zh: '截图取字引擎', en: 'Text Grab Engine' },
    ocrAuto: { zh: '智能（优先 AI，无 Key 用本地）', en: 'Smart (AI first, local fallback)' },
    ocrAi: { zh: 'AI 视觉识别（更准确）', en: 'AI Vision (more accurate)' },
    ocrLocal: { zh: 'Windows 本地 OCR（离线免费）', en: 'Windows local OCR (offline, free)' },
    autoTranslate: { zh: '复制文本后自动翻译', en: 'Auto-translate after copying text' },
    appearanceSec: { zh: '外观与行为', en: 'Appearance & Behavior' },
    language: { zh: '语言 Language', en: 'Language 语言' },
    hideToTop: { zh: '隐藏到顶部（仅触顶显示）', en: 'Hide to top edge (hover to summon)' },
    autoStart: { zh: '开机自动启动', en: 'Launch at login' },
    glassLabel: { zh: '玻璃浓度', en: 'Glass Density' },
    glassSub: { zh: 'Liquid Glass 透明度', en: 'Liquid Glass opacity' },
    ambientBg: { zh: '专辑封面背景（模糊铺底）', en: 'Album Art Background (blurred)' },
    ambientLabel: { zh: '封面背景浓度', en: 'Artwork Intensity' },
    ambientSub: { zh: '取专辑封面模糊后作为窗口背景', en: 'Blur the album art as window background' },
    theme: { zh: '主题', en: 'Theme' },
    themeAuto: { zh: '跟随系统', en: 'Follow System' },
    themeLight: { zh: '浅色', en: 'Light' },
    themeDark: { zh: '深色', en: 'Dark' },
    edgeSens: { zh: '触顶灵敏度', en: 'Top-edge Sensitivity' },
    resetPos: { zh: '重置位置', en: 'Reset Position' },
    quit: { zh: '退出', en: 'Quit' },

    // ---------- 截图覆盖层 ----------
    ssHint: { zh: '拖动框选要识别的区域 · Esc 取消', en: 'Drag to select the area to recognize · Esc to cancel' },

    // ---------- 媒体卡片 ----------
    nowPlaying: { zh: '正在播放', en: 'Now Playing' },
    paused: { zh: '已暂停', en: 'Paused' },
    unknownTrack: { zh: '未知曲目', en: 'Unknown track' },
    prevTitle: { zh: '上一首', en: 'Previous' },
    nextTitle: { zh: '下一首', en: 'Next' },
    playPause: { zh: '播放/暂停', en: 'Play/Pause' },
    openMediaApp: { zh: '打开播放应用', en: 'Open the player app' },
    mediaOpenFailed: { zh: '无法打开播放应用（可能未在运行）', en: 'Cannot open the player app (may not be running)' },

    // ---------- 番茄钟 ----------
    pomodoro: { zh: '番茄钟', en: 'Pomodoro' },
    focusTimer: { zh: '专注计时', en: 'Focus timer' },
    pendingStart: { zh: '待开始', en: 'Not started' },
    inProgress: { zh: '进行中', en: 'Running' },
    start: { zh: '开始', en: 'Start' },
    pause: { zh: '暂停', en: 'Pause' },
    resume: { zh: '继续', en: 'Resume' },
    reset: { zh: '重置', en: 'Reset' },
    addFiveMin: { zh: '+5 分钟', en: '+5 min' },
    focusingSub: { zh: '专注中 · 共 {0}', en: 'Focusing · total {0}' },
    pausedSub: { zh: '已暂停 · 共 {0}', en: 'Paused · total {0}' },
    focusSub: { zh: '专注计时 · {0}', en: 'Focus timer · {0}' },
    timerRemaining: { zh: '剩余 {0}', en: '{0} left' },
    timerDoneTitle: { zh: '番茄钟结束', en: 'Timer finished' },
    timerDoneBody: { zh: '专注完成，休息一下吧 🍅', en: 'Focus complete. Take a break 🍅' },
    tfAddTitle: { zh: '加 5 分钟', en: 'Add 5 minutes' },

    // ---------- 系统卡片 ----------
    sysStatus: { zh: '系统状态', en: 'System Status' },
    sysMonitor: { zh: '实时监控', en: 'Live monitor' },
    memory: { zh: '内存', en: 'Memory' },
    download: { zh: '下载', en: 'Down' },
    upload: { zh: '上传', en: 'Up' },
    waitingData: { zh: '等待数据…', en: 'Waiting for data…' },
    browserPreview: { zh: '浏览器预览：请在应用内查看', en: 'Browser preview: use inside the app' },
    memUsed: { zh: '内存已用 {0} / {1}', en: 'Memory used {0} / {1}' },

    // ---------- 天气卡片 ----------
    weather: { zh: '天气', en: 'Weather' },
    locating: { zh: '正在定位…', en: 'Locating…' },
    weatherFailed: { zh: '天气获取失败', en: 'Failed to get weather' },
    feelsLike: { zh: '体感 {0}°C', en: 'Feels {0}°C' },
    humidityWind: { zh: '湿度 {0}% · 风 {1} km/h', en: 'Humidity {0}% · wind {1} km/h' },
    todayShort: { zh: '今天', en: 'Today' },
    tomorrowShort: { zh: '明天', en: 'Tomorrow' },
    weekdays: { zh: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] },

    // ---------- 电池卡片 ----------
    battery: { zh: '电池', en: 'Battery' },
    charging: { zh: '正在充电', en: 'Charging' },
    onBattery: { zh: '使用电池', en: 'On battery' },
    batteryFull: { zh: '充足', en: 'Full' },
    batteryNormal: { zh: '正常', en: 'Normal' },
    batteryLow: { zh: '电量低', en: 'Low' },

    // ---------- 指令 / 回显 ----------
    openedInBrowser: { zh: '已在浏览器打开：<b>{0}</b>', en: 'Opened in browser: <b>{0}</b>' },
    queryingWeatherCity: { zh: '正在查询「{0}」的天气…', en: 'Getting weather for "{0}"…' },
    queryingWeather: { zh: '正在定位并查询天气…', en: 'Locating and getting weather…' },
    timerStarted: { zh: '已开始 <b>{0}</b> 倒计时，结束时会通知你。', en: 'Countdown started (<b>{0}</b>). You will be notified when it ends.' },
    openedApp: { zh: '已打开：<b>{0}</b>', en: 'Opened: <b>{0}</b>' },
    cannotOpen: { zh: '无法打开', en: 'Cannot open' },
    previewOpen: { zh: '（预览模式）模拟打开：<b>{0}</b>', en: '(Preview) Simulating open: <b>{0}</b>' },
    quitting: { zh: '正在退出…', en: 'Quitting…' },
    previewQuit: { zh: '（预览模式）退出不可用', en: '(Preview) Quit unavailable in preview' },
    hiddenTop: { zh: '已隐藏到顶部，触顶可唤出。', en: 'Hidden to top edge. Hover the top to summon.' },
    openedSettings: { zh: '已打开设置。', en: 'Settings opened.' },
    pinnedMsg: { zh: '已固定展开。', en: 'Pinned expanded.' },
    unpinnedMsg: { zh: '已取消固定。', en: 'Unpinned.' },
    resetDone: { zh: '已重置位置到屏幕顶部中央。', en: 'Position reset to top center.' },
    enterKeyword: { zh: '请输入关键词，如：<b>找文件 报告</b>', en: 'Enter a keyword, e.g. <b>find files report</b>' },
    findFileCmd: { zh: '找文件', en: 'find files' },

    // ---------- AI 问答 ----------
    previewAiNeed: { zh: '（预览模式）AI 问答需在应用内使用，请先配置 API Key。', en: '(Preview) AI chat requires the app — configure an API Key first.' },
    configFirst: { zh: '请先在设置中配置 AI 的 <b>API Key</b> 与 <b>Base URL</b>。', en: 'Please configure the AI <b>API Key</b> and <b>Base URL</b> in Settings first.' },
    translatePrompt: { zh: '请把下面这段文字翻译成中文，只输出译文：\n\n{0}', en: 'Translate the following text into English. Output only the translation:\n\n{0}' },

    // ---------- 截图 OCR ----------
    previewOcr: { zh: '（预览模式）截图 OCR 需在应用内使用。', en: '(Preview) Screenshot OCR requires the app.' },
    captureFailed: { zh: '截屏失败：{0}', en: 'Capture failed: {0}' },
    tooSmall: { zh: '选区太小，请重新截图。', en: 'Selection too small. Please try again.' },
    procError: { zh: '截图处理出错', en: 'Screenshot processing error' },
    procFailed: { zh: '截图处理失败', en: 'Screenshot processing failed' },
    noAIConfigured: { zh: '未配置 AI', en: 'No AI configured' },
    fallbackLocal: { zh: '未配置 AI Key，已改用本地 OCR。', en: 'No AI key — switched to local OCR.' },
    aiReading: { zh: 'AI 正在识别截图文字…', en: 'AI is reading the screenshot…' },
    noText: { zh: '（未识别到文字）', en: '(No text recognized)' },
    grabAI: { zh: '📷 截图取字（AI）', en: '📷 Text Grab (AI)' },
    grabAIFallback: { zh: '📷 截图取字（AI 失败，已回退本地）', en: '📷 Text Grab (AI failed, local fallback)' },
    ocrFailedBoth: { zh: 'OCR 失败 — AI：{0}；本地：{1}', en: 'OCR failed — AI: {0}; local: {1}' },
    grabLocal: { zh: '📷 截图取字', en: '📷 Text Grab' },
    localFailedTryAi: { zh: '本地 OCR 失败，尝试 AI 识别…', en: 'Local OCR failed, trying AI…' },
    ocrFailed: { zh: 'OCR 失败：{0}', en: 'OCR failed: {0}' },
    aiRereading: { zh: 'AI 正在重新识别…', en: 'AI is re-reading…' },
    aiRereadFailed: { zh: 'AI 重识失败：{0}', en: 'AI re-read failed: {0}' },
    aiRetryBtn: { zh: 'AI 重识（更准）', en: 'AI Retry (better)' },

    // ---------- 文件搜索 ----------
    previewFile: { zh: '（预览模式）文件搜索需在应用内使用。', en: '(Preview) File search requires the app.' },
    findFileEcho: { zh: '找文件：{0}', en: 'Find files: {0}' },
    searching: { zh: '正在搜索（桌面 / 文档 / 下载 / 图片 / 音乐 / 视频）…', en: 'Searching (Desktop / Documents / Downloads / Pictures / Music / Videos)…' },
    searchFailed: { zh: '搜索失败：{0}', en: 'Search failed: {0}' },
    noFiles: { zh: '未找到匹配「{0}」的文件（范围：桌面/文档/下载/图片/音乐/视频及其 6 层子目录）。换个关键词试试？', en: 'No files matching "{0}" (Desktop/Documents/Downloads/Pictures/Music/Videos, 6 levels deep). Try another keyword?' },
    foundFiles: { zh: '找到 {0} 个文件：', en: 'Found {0} files:' },
    open: { zh: '打开', en: 'Open' },
    openFailed: { zh: '打开失败：{0}', en: 'Open failed: {0}' },
    showInFolder: { zh: '所在文件夹', en: 'Show in Folder' },

    // ---------- 工具结果 ----------
    copy: { zh: '复制', en: 'Copy' },
    copied: { zh: '已复制到剪贴板。', en: 'Copied to clipboard.' },
    aiTranslate: { zh: 'AI 翻译', en: 'AI Translate' },
    clipEmpty: { zh: '剪贴板为空', en: 'Clipboard is empty' },
    previewUnavailable: { zh: '（预览模式）不可用', en: '(Preview) Not available' },

    // ---------- AI 系统提示 ----------
    aiSystem: {
      zh: '你是运行在 Windows 桌面的 AI 助手「实况窗」。请用简洁、准确、友好的中文回答。回答清晰、有条理，需要时用编号列表。若收到匹配文件列表的系统消息，可在回答中引用文件路径帮用户找到文件。',
      en: 'You are "Live Window", an AI assistant running on the Windows desktop. Answer concisely, accurately and kindly in English. Be clear and well organized; use numbered lists when helpful. If you receive a system message with matching files, you may reference file paths to help the user find them.'
    },

    // ---------- 通知（iOS 27 横幅 / 通知中心） ----------
    notifLabel: { zh: '通知', en: 'Notifications' },
    notifCenterTitle: { zh: '通知中心', en: 'Notification Center' },
    notifOn: { zh: '横幅弹出', en: 'Banners' },
    notifDigest: { zh: '定时摘要（暂不弹出）', en: 'Scheduled Summary' },
    notifOff: { zh: '关闭', en: 'Off' },
    notifTip: { zh: '「定时摘要」会把新通知先收进通知中心，稍后一起查看，适合专注工作时使用；关闭后仅番茄钟完成时提醒。', en: '"Scheduled Summary" queues new notifications into Notification Center for later — good for focus time. When off, only the Pomodoro completion still alerts you.' },
    notifTipDigest: { zh: '当前为定时摘要模式：新通知会先收在这里，不会弹出横幅。', en: 'Scheduled Summary is on: new notifications land here instead of popping up.' },
    clearAll: { zh: '全部清除', en: 'Clear All' },
    dnd: { zh: '勿扰', en: 'Focus' },
    dndTitle: { zh: '勿扰模式：开启后新通知不再弹出横幅', en: 'Focus mode: stop banners from popping up' },
    dndOn: { zh: '勿扰已开启', en: 'Focus on' },
    dndOff: { zh: '勿扰已关闭', en: 'Focus off' },
    ncEmptyTitle: { zh: '暂无通知', en: 'No Notifications' },
    ncEmptySub: { zh: '番茄钟、播放变化、AI 回复完成都会出现在这里', en: 'Pomodoro, track changes and AI replies will show up here' },
    nbMore: { zh: '还有 {0} 条通知', en: '{0} more notifications' },
    nbView: { zh: '查看', en: 'View' },
    nbAgain: { zh: '再来一个', en: 'Again' },
    nbDismiss: { zh: '关闭', en: 'Dismiss' },
    nbJustNow: { zh: '刚刚', en: 'Just now' },
    nbMinAgo: { zh: '{0} 分钟前', en: '{0} min ago' },
    nbHourAgo: { zh: '{0} 小时前', en: '{0} hr ago' },
    nbAiDoneTitle: { zh: 'AI 已回复', en: 'AI replied' },
    nbAiErrorTitle: { zh: 'AI 请求失败', en: 'AI request failed' },
    nbPlayPause: { zh: '播放 / 暂停', en: 'Play / Pause' },
    nbPrev: { zh: '上一首', en: 'Previous' },
    nbNext: { zh: '下一首', en: 'Next' },
    close: { zh: '关闭', en: 'Close' },
  };

  let lang = localStorage.getItem('lw_lang') || 'zh';
  if (lang !== 'zh' && lang !== 'en') lang = 'zh';

  function t(key) {
    const d = DICT[key];
    if (!d) return key;
    let s = d[lang] != null ? d[lang] : d.zh;
    if (arguments.length > 1) {
      // 函数形式替换：避免参数中的 $& $' $` $$ 被 String.replace 当特殊模式解释
      for (let i = 1; i < arguments.length; i++) s = String(s).replace('{' + (i - 1) + '}', () => String(arguments[i]));
    }
    return s;
  }

  function applyStatic() {
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  }

  window.I18N = {
    get lang() { return lang; },
    t,
    applyStatic,
    setLang(l) {
      if (l !== 'zh' && l !== 'en') return false;
      lang = l;
      localStorage.setItem('lw_lang', l);
      applyStatic();
      return true;
    },
    arr(key) { const d = DICT[key]; return d ? (d[lang] || d.zh) : []; },
  };

  // 启动即应用已保存的语言偏好：否则动态内容（t() 生成）是英文、
  // 静态 HTML 文案仍是中文，界面会中英混杂
  applyStatic();
})();
