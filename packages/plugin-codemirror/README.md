# @vimee/plugin-codemirror

**Attach vim editing to any CodeMirror 6 EditorView**

[![npm](https://img.shields.io/npm/v/@vimee/plugin-codemirror)](https://www.npmjs.com/package/@vimee/plugin-codemirror)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Framework-agnostic plugin that adds vim keybindings to a [CodeMirror 6](https://codemirror.net/) EditorView. Works with vanilla JS, React, or any CodeMirror wrapper.

## Install

```bash
npm install @vimee/core @vimee/plugin-codemirror
```

> **Note:** You also need `@codemirror/state` and `@codemirror/view` as peer dependencies in your project.

## Quick Start

```ts
import { EditorView, basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { attach } from "@vimee/plugin-codemirror";

const view = new EditorView({
  doc: 'console.log("Hello, vim!");',
  extensions: [basicSetup, javascript()],
  parent: document.getElementById("editor")!,
});

const vim = attach(view, {
  onChange: (value) => console.log("Content:", value),
  onModeChange: (mode) => console.log("Mode:", mode),
  onSave: (value) => console.log("Saved:", value),
});

// Later...
vim.destroy();
```

## API

### `attach(view, options?)`

Attaches vim keybindings to a CodeMirror 6 EditorView. Returns a `VimCodeMirror` handle.

The `view` parameter accepts any object satisfying the `CodeMirrorView` interface — typically a `@codemirror/view` `EditorView`.

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

#### VimCodeMirror

| Method | Return | Description |
|--------|--------|-------------|
| `getMode()` | `VimMode` | Current vim mode |
| `getCursor()` | `CursorPosition` | Current cursor position (0-based) |
| `getContent()` | `string` | Current editor content |
| `destroy()` | `void` | Detach all listeners and clean up |

## Search Highlighting

While typing a search pattern ( `/query` or `?query` ), the plugin highlights all matching ranges using a CodeMirror decoration with the CSS class `vimee-search-match` . The highlight is removed when the search is confirmed with `<CR>` .

A default yellow background theme is included via `EditorView.baseTheme()` . To customize the style, add a higher-specificity rule or use a CodeMirror theme extension:

```css
/* Override via CSS */
.cm-editor .vimee-search-match {
  background-color: rgba(255, 120, 0, 0.4);
}
```

```ts
// Override via CodeMirror theme extension
import { EditorView } from "@codemirror/view";

const myTheme = EditorView.theme({
  ".vimee-search-match": {
    backgroundColor: "rgba(255, 120, 0, 0.4)",
  },
});

const view = new EditorView({
  extensions: [basicSetup, javascript(), myTheme],
  // ...
});
```

## Visual Mode

The plugin uses CodeMirror's native selection for visual and visual-line mode. Visual-block mode creates per-line selection ranges for proper rectangular selection via `EditorSelection` .

To customize the selection color, use a CodeMirror theme extension:

```ts
const myTheme = EditorView.theme({
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "rgba(255, 165, 0, 0.3) !important",
  },
});

const view = new EditorView({
  extensions: [basicSetup, javascript(), myTheme],
  // ...
});
```

## Features

- Visual mode selection (including visual-block with per-line ranges)
- Incremental search highlighting ( `/` / `?` )
- H/M/L motions with viewport tracking
- Ctrl-U/D/B/F page scrolling
- IME composition support (CJK input)
- All vim features from `@vimee/core` (motions, operators, text objects, search, macros, marks, etc.)

## Utilities

The package also exports cursor and viewport utilities for advanced usage:

```ts
import {
  cursorToOffset, // Convert vimee CursorPosition (0-based line/col) → character offset
  offsetToCursor, // Convert character offset → vimee CursorPosition (0-based)
  getTopLine,     // Get first visible line (0-based)
  getVisibleLines, // Get visible line count
} from "@vimee/plugin-codemirror";
```

## License

MIT
