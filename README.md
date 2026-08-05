<div align="center">

# ✦ Bloco Custom

**A feature-rich, fully customizable text editor built entirely with vanilla HTML, CSS, and JavaScript — no frameworks, no dependencies.**

[![HTML](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![No Dependencies](https://img.shields.io/badge/Dependencies-None-blueviolet?style=flat-square)](#)

> 🇧🇷 [Leia em Português](README.pt-BR.md)

</div>

---

## Overview

**Bloco Custom** started as a personal replacement for Windows Notepad — a tool I built from scratch because the default experience was too plain and inflexible. What began as a simple HTML file evolved into a full-featured desktop-grade text editor, packagable as a standalone executable.

The entire application is **three files** with zero external runtime dependencies, demonstrating what's achievable with pure web standards.

---

## Project Structure

```
bloco-custom/
├── index.html   — Markup: all UI structure and layout
├── style.css    — Styles: themes, components, CSS custom properties
├── main.js      — Logic: editor engine, tabs, minimap, file ops, link chips
├── README.md
└── README.pt-BR.md
```

---

## Features

### Editor Core
- **`contenteditable` div** as the editing surface — allows real inline HTML nodes (used for link chips)
- **Line numbers** synced with scroll, with current-line highlight — VS Code style
- **Tab key** inserts 4 spaces (no focus trap)
- **Word wrap** toggle
- **Spellcheck** toggle
- **Persistent word, character, line, and column count** in the status bar

### Tab System
- **Multiple tabs** — open as many files as needed simultaneously
- **Drag-and-drop reordering** between tabs
- **Unsaved changes indicator** (●) per tab
- Keyboard shortcuts: `Ctrl+T` new tab, `Ctrl+W` close, `Ctrl+Tab` cycle

### Minimap
- **VS Code-style minimap** rendered on an HTML5 `<canvas>` at the right edge
- Clickable and draggable — click anywhere to jump to that position in the document
- Viewport indicator shows the currently visible region
- Current line highlighted in the minimap
- Comment lines and headings rendered in distinct colors
- Toggle with `Ctrl+Shift+P`

### Link Chips
- Optional **inline link preview** — when enabled, raw URLs are replaced by styled chips directly in the editor
- Each chip displays the **site favicon**, **page title** (fetched asynchronously), and **domain**
- Built on `contentEditable="false"` nodes — chips behave as atomic characters (selectable, deletable)
- Titles fetched via CORS proxy with graceful domain fallback
- Hovering a chip reveals the full URL in a tooltip
- Toggle in Settings panel

### File Operations
- **Open** — reads `.txt`, `.md`, `.log`, `.json`, `.html`, `.js`, `.css`, `.py`, `.ts`, `.sh`, `.yaml` and more
- **Save / Save As** — downloads the file with the correct name
- **Auto-save** — optional, triggers 5 seconds after the last keystroke
- **Recent files** — dropdown tracks the last 10 opened filenames

### Find & Replace
- **Search with live match count** (`Ctrl+F`)
- Navigate matches with `↑` / `↓` or `Enter` / `Shift+Enter`
- **Replace** single or **Replace All**
- Case-sensitive and whole-word options

### Customization
- **9 built-in themes**: Night Blue, Forest, Charcoal, Lavender, Paper, Snow, Terminal, Ocean, Rosé
- **Custom color pickers** for background, text, and accent colors
- **5 font families**: JetBrains Mono, Courier New, Inter, Georgia, System
- **Font size** slider (11–28px)
- **Line height** slider
- All preferences apply instantly via CSS custom properties

### Focus Mode
- `F11` enters **distraction-free mode** — UI bars fade out, reappear on hover
- Editor column capped at 760px for comfortable long-form writing

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+S` | Save |
| `Ctrl+Shift+S` | Save As |
| `Ctrl+O` | Open file |
| `Ctrl+N` | New tab |
| `Ctrl+T` | New tab |
| `Ctrl+W` | Close current tab |
| `Ctrl+Tab` | Next tab |
| `Ctrl+Shift+Tab` | Previous tab |
| `Ctrl+F` | Find & Replace |
| `Ctrl+Shift+P` | Toggle Minimap |
| `Ctrl+,` | Open Settings |
| `F11` | Toggle Focus Mode |

---

## Getting Started

### Run in Browser

No installation required. Just open the file:

```bash
# Clone the repository
git clone https://github.com/your-username/bloco-custom.git
cd bloco-custom

# Open in your browser
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

> **Note:** Because `index.html` loads `main.js` and `style.css` as separate files, it must be opened via a local server or browser — not double-clicked as a file in some browsers. Use the **Live Server** extension in VS Code, or run `npx serve .` in the project folder.

---

## Packaging as a Desktop App

### Option 1 — Nativefier (quick, Electron-based, ~230MB)

Wraps the app in a bundled Chromium runtime. Easiest to set up.

```bash
# Install Nativefier globally
npm install -g nativefier

# Serve the project locally first (required for file:// loading)
npx serve .
# → Running at http://localhost:3000

# Build the executable
nativefier --name "Bloco Custom" --out ~/Desktop "http://localhost:3000"
```

This generates a `.exe` (Windows), `.app` (macOS), or binary (Linux).
The output is ~230MB because Nativefier bundles a full Chromium runtime.

---

### Option 2 — Tauri (recommended, native WebView, ~8MB)

[Tauri](https://tauri.app/) uses the **operating system's built-in WebView** (WebKit on macOS/Linux, WebView2 on Windows) instead of bundling Chromium — resulting in binaries under 10MB.

#### Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Node.js (if not already installed)
# https://nodejs.org

# Install Tauri CLI
npm install -g @tauri-apps/cli
```

> On Linux, also install the system dependencies listed at [tauri.app/v1/guides/getting-started/prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites/#setting-up-linux).

#### Setup

```bash
cd bloco-custom

# Initialize Tauri in the project
npm create tauri-app@latest -- --template vanilla
```

When prompted, point the **frontend dist folder** to `.` (the project root) and the **dev server URL** to `http://localhost:3000`.

Then serve the project during development:

```bash
npx serve .
```

And in another terminal, run Tauri:

```bash
npx tauri dev      # development (hot reload)
npx tauri build    # production binary → src-tauri/target/release/
```

The final binary will be in `src-tauri/target/release/` — typically **5–10MB**, no Chromium included.

---

## Architecture

```
index.html   — Shell: Google Fonts import, CSS link, HTML structure, JS script tag
style.css    — All visual styles using CSS custom properties for live theming
main.js      — Full application logic (~600 lines of vanilla JS)
    ├── Tab engine       contenteditable state management per tab
    ├── Gutter           Line number rendering synchronized with scroll
    ├── Minimap          Canvas-based document overview with click navigation
    ├── Link Chips       Inline URL → chip conversion with async title fetching
    ├── Find & Replace   Regex-based search with match navigation
    ├── File I/O         FileReader API for open, Blob URL for save
    ├── Theme engine     CSS custom property injection
    └── Auto-save        Debounced save via setTimeout
```

### Key Technical Decisions

**`contenteditable` over `<textarea>`**
Textarea only renders plain text. The link chip feature requires real DOM nodes inline with text, only possible with `contenteditable`. A custom `getEditorText()` walker extracts plain text (including URL data from chip nodes) for saving and statistics.

**Canvas minimap**
The minimap renders text at ~18% scale onto a `<canvas>`, re-drawing on every input with `requestAnimationFrame` debouncing. Click/drag events map to scroll ratios rather than pixel coordinates, making it resolution-independent.

**CSS custom properties for theming**
All colors are CSS variables on `:root`. Theme switching and color pickers call `root.style.setProperty()` — no class toggling, no stylesheet injection, instant live updates.

**CORS proxy for link metadata**
Fetching page titles from arbitrary URLs is blocked by CORS. The app uses the public `allorigins.win` proxy to retrieve raw HTML, then extracts `<title>` and `og:title` via regex. Results are cached in memory to avoid duplicate requests.

---

## Screenshots

> _Add screenshots here showing different themes, the minimap, link chips, and focus mode._

---

## Roadmap

- [ ] Markdown syntax highlighting in the editor
- [ ] Session persistence via `localStorage`
- [ ] Split-pane view (two editors side by side)
- [ ] Custom themes export/import as JSON
- [ ] Tauri build pipeline with auto-updater

---

## License

MIT © [Your Name](https://github.com/your-username)

---

<div align="center">

Built with curiosity and zero frameworks.

</div>
