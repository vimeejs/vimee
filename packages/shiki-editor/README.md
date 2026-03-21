# @vimee/shiki-editor

**A vim-powered code editor component with Shiki syntax highlighting**

[![npm](https://img.shields.io/npm/v/@vimee/shiki-editor)](https://www.npmjs.com/package/@vimee/shiki-editor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Drop-in React component that combines [`@vimee/core`](../core) + [`@vimee/react`](../react) with [Shiki](https://shiki.style) for syntax-highlighted Vim editing.

## Install

```bash
npm install @vimee/core @vimee/react @vimee/shiki-editor shiki
```

> Requires `react >= 18.0.0` and `shiki >= 1.0.0` as peer dependencies.

## Quick Start

```tsx
import { Vim } from "@vimee/shiki-editor";
import "@vimee/shiki-editor/styles.css";
import { createHighlighter } from "shiki";

// Create highlighter once (async)
const highlighter = await createHighlighter({
  themes: ["vitesse-dark"],
  langs: ["typescript"],
});

function App() {
  return (
    <Vim
      content={`const greeting = "Hello, vim!";`}
      highlighter={highlighter}
      lang="typescript"
      theme="vitesse-dark"
      onChange={(c) => console.log("Changed:", c)}
      onSave={(c) => console.log("Saved:", c)}
    />
  );
}
```

## `<Vim />` Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `content` | `string` | *required* | Initial editor content |
| `highlighter` | `HighlighterCore` | *required* | Shiki highlighter instance |
| `lang` | `string` | *required* | Language for syntax highlighting |
| `theme` | `string` | *required* | Shiki theme name |
| `shikiOptions` | `Record<string, unknown>` | — | Extra options for `codeToTokens` |
| `cursorPosition` | `string` | `"1:1"` | Initial cursor (`"line:col"`, 1-based) |
| `onChange` | `(content: string) => void` | — | Content change callback |
| `onYank` | `(text: string) => void` | — | Yank callback |
| `onSave` | `(content: string) => void` | — | `:w` callback |
| `onModeChange` | `(mode: VimMode) => void` | — | Mode change callback |
| `onAction` | `(action: VimAction, key: string) => void` | — | Action callback |
| `className` | `string` | — | Additional CSS class |
| `readOnly` | `boolean` | `false` | Read-only mode |
| `autoFocus` | `boolean` | `false` | Focus on mount |
| `indentStyle` | `"space" \| "tab"` | `"space"` | Indent character |
| `indentWidth` | `number` | `2` | Spaces per indent |
| `showLineNumbers` | `boolean` | `true` | Show line numbers (overridden by `:set number`) |

## CSS Customization

Import the base styles and override CSS variables:

```css
@import "@vimee/shiki-editor/styles.css";

.my-editor {
  --sv-font-family: "JetBrains Mono", monospace;
  --sv-font-size: 14px;
  --sv-line-height: 1.6;
  --sv-cursor-color: rgba(255, 255, 255, 0.7);
  --sv-selection-bg: rgba(100, 150, 255, 0.3);
  --sv-search-match-bg: rgba(255, 200, 50, 0.35);
  --sv-gutter-color: #858585;
  --sv-gutter-bg: transparent;
  --sv-statusline-bg: #252526;
  --sv-statusline-fg: #cccccc;
  --sv-focus-color: #007acc;
}
```

## Advanced Usage

### Sub-components

All sub-components are exported for building custom editor layouts:

```tsx
import {
  Vim,
  Cursor,
  Line,
  StatusLine,
  useShikiTokens,
  computeSelectionInfo,
} from "@vimee/shiki-editor";
```

### Using with `useVim` directly

For full control, use `@vimee/react`'s `useVim` hook with `useShikiTokens`:

```tsx
import { useVim } from "@vimee/react";
import { useShikiTokens } from "@vimee/shiki-editor";

function CustomEditor({ highlighter }) {
  const vim = useVim({ content: "hello" });
  const { tokenLines, bgColor } = useShikiTokens(
    highlighter, vim.content, "typescript", "vitesse-dark"
  );

  // Build your own UI with tokenLines + vim state
}
```

## License

MIT
