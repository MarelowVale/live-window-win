# Live Window for Windows

[中文](./README.md) | English

A Windows live window widget inspired by **iOS 27 Liquid Glass**. Hides at the top of your screen and slides down when your mouse touches the top edge — just like the Lenovo Tianxi AI assistant. Drag it anywhere, pin it, or tuck it away. Includes a Dynamic Island-style **Search or Ask** AI panel.

![style: Liquid Glass](https://img.shields.io/badge/style-Liquid%20Glass-blue) ![ios: 27](https://img.shields.io/badge/design-iOS%2027-8e8e93)

## ✨ Features (real, not just visual)

- **Now Playing** — Reads the current media session via Windows SMTC: track, artist, album art, playback state, and progress bar. Supports play/pause, previous/next, and **dragging the progress bar**. Hides automatically when nothing is playing.
- **Pomodoro Timer** — Real countdown with start/pause/reset/+1min. Desktop notification on finish. State is persisted.
- **System Monitor** — Live CPU, memory, and up/down network speed (refreshed every 2 seconds).
- **Weather** — Powered by Open-Meteo + IP geolocation. Shows current conditions and a 5-day forecast. Try `weather beijing`.
- **Battery** — Laptop battery percentage and charging status (auto-hidden on desktops).
- **AI Q&A (Search or Ask)** :
  - Configure any OpenAI-compatible endpoint in settings (DeepSeek / OpenAI / Moonshot Kimi / Zhipu GLM / Qwen / custom). Just paste your API key, base URL, and model name.
  - Responses stream into a side panel next to the main card, growing as the answer grows.
  - Automatically searches your Desktop / Documents / Downloads folder for matching files and feeds them to the AI as context — **find files on your computer by asking**.
  - **Built-in input area (v1.4)**: Scroll up to see history; type directly in the AI panel. Send/Stop button (turns to stop while generating). Collapse the left main panel to center the AI view, adjust font size with A−/A+, and access AI settings.

## Interaction & Design

- **Edge-triggered dropdown** — Move your mouse to the very top edge of the screen (default 8px) to expand. Works on every monitor in a multi-monitor setup.
- **Dynamic Island capsule** — When collapsed, it's a frosted glass pill showing the current activity. Idle state shows "Search or Ask".
- **Editable cards** — Toggle Now Playing / Pomodoro / Weather / System Stats / Battery on or off in settings.
- **Liquid Glass opacity slider (iOS 27)** — Adjust the blur and transparency. Light / dark / follow system theme.
- **Click-through layer** — The fullscreen overlay only intercepts mouse when hovering the actual panel, so it never blocks your desktop.
- **System tray** — Show/hide, open settings, quit. Single-instance lock.

## Quick Commands (no AI needed)

`timer 15 min` · `weather beijing` · `open calculator/notepad/task manager/paint/explorer/settings` · `hide` · `pin` · `settings` · `reset position` · `quit` · paste a URL directly

## 🚀 Run

```bash
npm install   # First time takes a while
npm start     # Start Live Window
```

It covers the whole screen but is **click-through** — just move your mouse to the top edge to summon it.

## 📦 Build

```bash
npm run dist
```

Outputs a **portable exe** to `release/`: `LiveWindow-Portable-1.6.0-x64.exe` (no installation needed, just double-click).

> If you're in mainland China, set npm mirrors first:
> `$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'`
> `$env:ELECTRON_BUILDER_BINARIES_MIRROR='https://npmmirror.com/mirrors/electron-builder-binaries/'`

## 🗂 Project Structure
```
.
├─ main.js            # Main process: multi-monitor window + tray + system data + weather + AI streaming + media control + file search
├─ preload.js         # Secure IPC bridge
├─ scripts/sysmon.ps1 # Helper: SMTC media (with album art) / battery / network
├─ scripts/mediactl.ps1 # SMTC media control (play/pause/next/seek)
├─ assets/tray.png    # Tray icon
├─ build/             # App icons for packaging
└─ src/
   ├─ index.html
   ├─ styles.css      # Liquid Glass styles (main panel + side AI panel)
   ├─ data.js         # WMO weather code mapping
   ├─ i18n.js         # EN/ZH strings
   └─ renderer.js     # UI logic + cards + AI chat (input/stop/font size/collapse)
```

## 📌 Notes

- Weather uses IP geolocation; media/battery/network depend on Windows system APIs. AI requires your own API key (stored locally in localStorage only).
- To quit: right-click the tray icon → Quit, or use the Quit button in settings.

## ⚖️ Disclaimer

- This project is open-source under the [MIT License](LICENSE).
- iOS, iOS 27, Liquid Glass, and Dynamic Island are trademarks of Apple Inc. "Tianxi" and related names belong to Lenovo. This is an independent fan project for learning purposes and is not affiliated with, endorsed by, or sponsored by Apple or Lenovo. Names are used only to describe the design style being referenced.
- Third-party open-source components: [Electron](https://github.com/electron/electron) (MIT), [marked](https://github.com/markedjs/marked) (MIT), [highlight.js](https://github.com/highlightjs/highlight.js) (BSD-3-Clause), [DOMPurify](https://github.com/cure53/DOMPurify) (Apache-2.0 / MPL-2.0). All rights belong to their respective authors.
