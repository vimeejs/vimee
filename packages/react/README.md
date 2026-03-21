# @vimee/react

**React hooks for the vimee headless vim engine**

[![npm](https://img.shields.io/npm/v/@vimee/react)](https://www.npmjs.com/package/@vimee/react)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A thin React binding for [`@vimee/core`](../core). Provides the `useVim` hook that turns the headless engine into reactive state.

## Install

```bash
npm install @vimee/core @vimee/react
```

> Requires `react >= 18.0.0` as a peer dependency.

## Quick Start

```tsx
import { useVim } from "@vimee/react";

function VimEditor() {
  const { content, cursor, mode, handleKeyDown } = useVim({
    content: "Hello, vim!",
  });

  return (
    <div tabIndex={0} onKeyDown={handleKeyDown} style={{ outline: "none" }}>
      <div>-- {mode.toUpperCase()} --</div>
      <pre>{content}</pre>
      <div>
        {cursor.line + 1}:{cursor.col + 1}
      </div>
    </div>
  );
}
```

## `useVim(options)`

### Options (`UseVimOptions`)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `content` | `string` | *required* | Initial editor content |
| `cursorPosition` | `string` | `"1:1"` | Initial cursor in `"line:col"` format (1-based) |
| `readOnly` | `boolean` | `false` | Prevent all mutations |
| `onChange` | `(content: string) => void` | — | Called when content changes |
| `onYank` | `(text: string) => void` | — | Called when text is yanked |
| `onSave` | `(content: string) => void` | — | Called when `:w` is executed |
| `onModeChange` | `(mode: VimMode) => void` | — | Called when mode changes |
| `onAction` | `(action: VimAction, key: string) => void` | — | Called for every engine action |
| `indentStyle` | `"space" \| "tab"` | `"space"` | Indent character |
| `indentWidth` | `number` | `2` | Spaces per indent level |

### Return Value (`UseVimReturn`)

| Property | Type | Description |
|----------|------|-------------|
| `content` | `string` | Current editor content |
| `cursor` | `CursorPosition` | Current cursor position (0-based) |
| `mode` | `VimMode` | Current vim mode |
| `statusMessage` | `string` | Status bar text (e.g. `"--INSERT--"`) |
| `visualAnchor` | `CursorPosition \| null` | Visual selection anchor |
| `commandLine` | `string` | Command-line display (e.g. `":wq"`, `"/search"`) |
| `options` | `Record<string, boolean>` | Options set via `:set` commands |
| `lastSearch` | `string` | Last search pattern (for highlighting) |
| `handleKeyDown` | `(e: React.KeyboardEvent) => void` | Attach to `onKeyDown` |
| `handleScroll` | `(direction, visibleLines, amount?) => void` | Page scroll handler |
| `updateViewport` | `(topLine, height) => void` | Viewport info for H/M/L motions |

## Examples

### Read-only viewer

```tsx
const { content, cursor, mode, handleKeyDown } = useVim({
  content: sourceCode,
  readOnly: true,
});
```

### With callbacks

```tsx
const vim = useVim({
  content: initialCode,
  onChange: (c) => saveToLocalStorage(c),
  onSave: (c) => uploadToServer(c),
  onModeChange: (m) => analytics.track("mode", m),
  onYank: (text) => navigator.clipboard.writeText(text),
});
```

### Rendering cursor position

```tsx
function Editor() {
  const { content, cursor, mode, handleKeyDown } = useVim({
    content: "line 1\nline 2\nline 3",
  });

  const lines = content.split("\n");

  return (
    <div tabIndex={0} onKeyDown={handleKeyDown}>
      {lines.map((line, i) => (
        <div key={i}>
          {i === cursor.line ? (
            <>
              {line.slice(0, cursor.col)}
              <span className="cursor">{line[cursor.col] ?? " "}</span>
              {line.slice(cursor.col + 1)}
            </>
          ) : (
            line || " "
          )}
        </div>
      ))}
    </div>
  );
}
```

### Scroll integration

```tsx
function ScrollableEditor() {
  const { content, cursor, handleKeyDown, handleScroll, updateViewport } =
    useVim({ content: largeFile });

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const lineHeight = 20;
    const topLine = Math.floor(el.scrollTop / lineHeight);
    const height = Math.floor(el.clientHeight / lineHeight);
    updateViewport(topLine, height);
  });

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ height: 400, overflow: "auto" }}
    >
      <pre>{content}</pre>
    </div>
  );
}
```

## Re-exported Types

For convenience, the following types are re-exported from `@vimee/core`:

- `CursorPosition`
- `VimMode`
- `VimAction`
- `VimContext`

```ts
import type { CursorPosition, VimMode } from "@vimee/react";
```

## License

MIT
