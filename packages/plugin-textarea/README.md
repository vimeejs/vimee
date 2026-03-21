# @vimee/plugin-textarea

**Attach vim editing to any HTML textarea element**

[![npm](https://img.shields.io/npm/v/@vimee/plugin-textarea)](https://www.npmjs.com/package/@vimee/plugin-textarea)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Framework-agnostic plugin that turns a plain `<textarea>` into a vim-enabled editor. Works with vanilla JS, shadcn/ui, or any textarea.

## Install

```bash
npm install @vimee/core @vimee/plugin-textarea
```

## Quick Start

```ts
import { attach } from "@vimee/plugin-textarea";

const textarea = document.querySelector("textarea")!;

const vim = attach(textarea, {
  onChange: (value) => console.log("Content:", value),
  onModeChange: (mode) => console.log("Mode:", mode),
  onSave: (value) => console.log("Saved:", value),
});

// Later...
vim.destroy();
```

## API

### `attach(textarea, options?)`

Attaches vim keybindings to a textarea element. Returns a `VimTextarea` handle.

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

#### VimTextarea

| Method | Return | Description |
|--------|--------|-------------|
| `getMode()` | `VimMode` | Current vim mode |
| `getCursor()` | `CursorPosition` | Current cursor position (0-based) |
| `getContent()` | `string` | Current textarea content |
| `destroy()` | `void` | Detach all listeners and clean up |

## CSS Styling

The plugin sets a `data-vimee-mode` attribute on the textarea, so you can style based on mode:

```css
textarea[data-vimee-mode="normal"] {
  border-color: blue;
  caret-color: transparent;
}

textarea[data-vimee-mode="insert"] {
  border-color: green;
}

textarea[data-vimee-mode="visual"] {
  border-color: orange;
}
```

## Features

- H/M/L motions with viewport tracking
- Ctrl-U/D/B/F page scrolling
- IME composition support (CJK input)
- Auto-scrolls to keep cursor visible
- All vim features from `@vimee/core` (motions, operators, text objects, search, macros, marks, etc.)

## License

MIT
