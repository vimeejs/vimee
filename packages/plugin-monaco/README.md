# @vimee/plugin-monaco

**Attach vim editing to any Monaco Editor instance**

[![npm](https://img.shields.io/npm/v/@vimee/plugin-monaco)](https://www.npmjs.com/package/@vimee/plugin-monaco)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Framework-agnostic plugin that adds vim keybindings to a [Monaco Editor](https://microsoft.github.io/monaco-editor/) instance. Works with vanilla JS, React, or any Monaco wrapper.

## Install

```bash
npm install @vimee/core @vimee/plugin-monaco
```

> **Note:** You also need `monaco-editor` as a peer dependency in your project.

## Quick Start

```ts
import * as monaco from "monaco-editor";
import { attach } from "@vimee/plugin-monaco";

const editor = monaco.editor.create(document.getElementById("editor")!, {
  value: 'console.log("Hello, vim!");',
  language: "typescript",
});

const vim = attach(editor, {
  onChange: (value) => console.log("Content:", value),
  onModeChange: (mode) => console.log("Mode:", mode),
  onSave: (value) => console.log("Saved:", value),
});

// Later...
vim.destroy();
```

## API

### `attach(editor, options?)`

Attaches vim keybindings to a Monaco Editor instance. Returns a `VimMonaco` handle.

The `editor` parameter accepts any object satisfying the `MonacoEditor` interface — typically a `monaco.editor.IStandaloneCodeEditor`.

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `readOnly` | `boolean` | `false` | Read-only mode (motions work, edits blocked) |
| `onChange` | `(value: string) => void` | — | Content change callback |
| `onModeChange` | `(mode: VimMode) => void` | — | Mode change callback |
| `onYank` | `(text: string) => void` | — | Yank callback |
| `onSave` | `(value: string) => void` | — | `:w` callback |
| `onAction` | `(action: VimAction, key: string) => void` | — | Action callback |
| `indentStyle` | `"space" \| "tab"` | `"space"` | Indent character |
| `indentWidth` | `number` | `2` | Spaces per indent |

#### VimMonaco

| Method | Return | Description |
|--------|--------|-------------|
| `getMode()` | `VimMode` | Current vim mode |
| `getCursor()` | `CursorPosition` | Current cursor position (0-based) |
| `getContent()` | `string` | Current editor content |
| `destroy()` | `void` | Detach all listeners and clean up |

## Cursor Style

The plugin automatically switches Monaco's cursor style based on vim mode:

- **Normal / Visual / Command-line mode** → Block cursor
- **Insert mode** → Line cursor

## Styling

The plugin uses Monaco decorations with CSS classes for visual selection and search highlighting. Add the following CSS to your project:

```css
/* Visual mode selection (visual, visual-line, visual-block) */
.vimee-visual-selection {
  background-color: rgba(255, 165, 0, 0.3);
}

/* Incremental search highlighting (/query, ?query) */
.vimee-search-match {
  background-color: rgba(255, 210, 0, 0.3);
}
```

> **Note:** Without these styles, visual selection and search highlighting will not be visible. Visual-block creates per-line decorations for proper rectangular selection. Search highlights are shown while typing the pattern and removed on `<CR>` .

## Features

- Automatic cursor style switching (block ↔ line)
- Visual mode selection highlighting via decorations (including visual-block)
- Incremental search highlighting ( `/` / `?` )
- H/M/L motions with viewport tracking
- Ctrl-U/D/B/F page scrolling
- IME composition support (CJK input)
- Auto-scrolls to keep cursor visible (`revealLine`)
- All vim features from `@vimee/core` (motions, operators, text objects, search, macros, marks, etc.)

## Utilities

The package also exports cursor and viewport utilities for advanced usage:

```ts
import {
  cursorToMonacoPosition, // Convert vimee CursorPosition (0-based) → Monaco IPosition (1-based)
  monacoPositionToCursor, // Convert Monaco IPosition (1-based) → vimee CursorPosition (0-based)
  getTopLine,             // Get first visible line (0-based)
  getVisibleLines,        // Get visible line count
  revealLine,             // Scroll to a specific line (0-based)
} from "@vimee/plugin-monaco";
```

## License

MIT
