# 实况窗 · Live Window for Windows

中文 | [English](./README_EN.md)

仿照 iOS 27 **Liquid Glass（液态玻璃）** 风格的 Windows 实况窗。常驻屏幕顶端，鼠标碰到屏幕最顶端时自动下拉展开（与联想天禧 AI 助手同款交互逻辑），可拖拽移动、固定或隐藏到顶部，内置灵动岛式 **Search or Ask**。

![style: Liquid Glass](https://img.shields.io/badge/style-Liquid%20Glass-blue) ![ios: 27](https://img.shields.io/badge/design-iOS%2027-8e8e93)

## ✨ 真实功能（非模拟）

- **正在播放媒体**：通过 Windows SMTC 实时读取当前播放的音乐 —— 歌曲/歌手/专辑封面/播放状态/进度；支持上一首、播放/暂停、下一首、**拖动进度条跳转**。无播放时自动隐藏。
- **番茄钟**：真实倒计时，可开始/暂停/重置/加时，结束弹出桌面通知；状态自动记忆。
- **系统监控**：实时 CPU、内存、上行/下行网速（每 2 秒刷新）。
- **实时天气**：Open-Meteo + IP 定位自动获取所在地天气与未来 5 天预报；支持「天气 上海」查询。
- **电池**：笔记本电量与充电状态（台式机自动隐藏）。
- **AI 问答（Search or Ask）**：
  - 在设置里配置任意 OpenAI 兼容接口（DeepSeek / OpenAI / Moonshot Kimi / 智谱 GLM / 通义千问 / 自定义），填入 API Key、Base URL、模型。
  - 提问后，回答以流式输出在**主面板右侧紧挨的结果面板**，面板高度随回答长度增长。
  - 会自动在「桌面/文档/下载」中按关键词搜索本地文件并交给 AI 引用，帮你**找到电脑中的文件**。
  - **AI 面板内置完整输入区（v1.4）**：下拉即可查看历史；AI 面板底部自带输入框 + 发送/停止按钮（生成中变为停止，可中断输出）；顶栏可**收起/展开左侧主面板**（收起后 AI 面板居中，再点恢复）、**A−/A+ 调节字号**、**AI 设置**入口，其余历史/导出等功能保持不变。

## 交互与设计

- **触顶下拉**：鼠标移到屏幕最顶端（默认 8px 内）自动展开；多显示器每块屏幕均可唤出。
- **灵动岛胶囊**：收起态为深色玻璃胶囊，实时展示主活动；无活动时显示「Search or Ask」。
- **编辑显示卡片**：设置里可开关「正在播放/番茄钟/天气/系统状态/电池」五项，不需要的功能可去掉。
- **玻璃浓度滑块（iOS 27）**：设置里可调 Liquid Glass 透明度，浅/深/跟随系统主题。
- **区域感知穿透**：全屏覆盖层仅在悬停面板/结果面板时拦截鼠标，不挡桌面。
- **系统托盘**：显示/隐藏、打开设置、退出；单实例锁。

## 快捷指令（无需 AI）

`计时 15 分钟` · `天气 上海` · `打开 计算器/记事本/任务管理器/画图/资源管理器/设置` · `隐藏` · `固定` · `设置` · `重置位置` · `退出` · 直接粘贴网址

## 🚀 运行

```bash
npm install   # 首次较慢
npm start     # 启动实况窗
```
启动后覆盖整个屏幕但**不挡操作**，鼠标移到屏幕最顶端即可唤出。

## 📦 打包

```bash
npm run dist
```
产物输出到 `release/`，仅打包**免安装便携版**：`实况窗-Portable-1.6.0-x64.exe`（双击即用，无需安装）。

> 国内网络可先设置镜像：
> `$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'`
> `$env:ELECTRON_BUILDER_BINARIES_MIRROR='https://npmmirror.com/mirrors/electron-builder-binaries/'`

## 🗂 项目结构
```
.
├─ main.js            # 主进程：多屏窗口 + 托盘 + 系统采集 + 天气 + AI 流式 + 媒体控制 + 文件搜索
├─ preload.js         # 安全暴露 IPC 能力
├─ scripts/sysmon.ps1 # 子进程：SMTC 媒体(含封面) / 电池 / 网络
├─ scripts/mediactl.ps1 # SMTC 媒体控制（播放/暂停/切歌/跳转）
├─ assets/tray.png    # 托盘图标
├─ build/             # 安装包/应用图标
└─ src/
   ├─ index.html
   ├─ styles.css      # Liquid Glass 样式（面板 + 右侧 AI 结果并排）
   ├─ data.js         # WMO 天气代码映射
   ├─ i18n.js         # 中英文案
   └─ renderer.js     # 交互 + 卡片渲染 + AI 问答（内置输入框/停止/字号/收起主面板）
```

## 📌 说明

- 天气按 IP 定位；媒体/电池/网速依赖 Windows 系统接口；AI 需自行填写 API Key（仅存本机 localStorage）。
- 退出：右键系统托盘图标 → 退出，或在设置里点击「退出」。

## ⚖️ 声明

- 本项目采用 [MIT License](LICENSE) 开源。
- iOS、iOS 27、Liquid Glass、灵动岛（Dynamic Island）是 Apple Inc. 的商标或注册商标；「天禧」及相关产品名称归联想集团所有。本项目是独立的第三方学习作品，与 Apple Inc.、联想集团没有任何关联、认可或赞助关系，以上名称仅用于描述设计风格与交互参照。
- 本项目使用的第三方开源组件：[Electron](https://github.com/electron/electron)（MIT）、[marked](https://github.com/markedjs/marked)（MIT）、[highlight.js](https://github.com/highlightjs/highlight.js)（BSD-3-Clause）、[DOMPurify](https://github.com/cure53/DOMPurify)（Apache-2.0 / MPL-2.0），各组件版权归其各自作者所有。
