# Rocktier Markdown

A **fast**, elegant Markdown reader and editor. Part of the [Rocktier](https://rocktier.com) family of tools.

> Fast is a feature. Private by design. Built to last.

## Features

- **Real-time rendering** — See your Markdown come alive as you type
- **Lightning fast** — Built on Tauri + micromark; typing never waits for the preview
- **Clean & elegant** — Nothing OS-inspired monochrome design
- **By Rocktier** — Member of the Rocktier family (PDF Squeeze, pic2webp, Write, Markdown, Video)
- **Privacy first** — 100% offline: no network access, no cloud, no tracking

## Architecture

```
Rocktier Markdown
├── Frontend: React 18 + TypeScript + Vite
├── Shell: Tauri v2 (Rust)
├── Parsing: micromark (fastest CommonMark + GFM parser)
└── Design: Nothing OS-inspired monochrome tokens
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) (latest stable)
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/) system deps

### Development

```bash
npm install
npm run tauri:dev
```

### Build

```bash
npm install
npm run tauri:build
```

## Keyboard Shortcuts

| Key            | Action              |
|----------------|---------------------|
| `⌘ N`          | New document        |
| `⌘ O`          | Open file           |
| `⌘ S`          | Save                |
| `⌘ ⇧ S`        | Save as             |
| `⌘ \`          | Toggle sidebar      |
| `Tab`          | Indent             |
| `Shift+Tab`    | Outdent            |

## Design System

Rocktier Markdown follows the Rocktier family design language:

- **Monochrome palette** (dark default, light available)
- **Dot grid motif** as brand identifier
- **SF Pro / Segoe UI** typography
- **Subtle transitions** (150-300ms)
- **Editorial-grade** Markdown typography

## License

MIT © 2026 Rocktier
