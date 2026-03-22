# @vimee/testkit

**Test utilities for writing `@vimee/core` Vim operation tests**

[![npm](https://img.shields.io/npm/v/@vimee/testkit)](https://www.npmjs.com/package/@vimee/testkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A fluent test harness that wraps `@vimee/core` so you can write concise, readable Vim operation tests.

## Install

```bash
npm install -D @vimee/testkit
```

> Requires `@vimee/core >= 0.1.0` as a peer dependency.

## Quick Start

```ts
import { vim } from "@vimee/testkit";

const v = vim("hello\nworld");
v.type("dd");
expect(v.content()).toBe("world");
```

## API Reference

### `vim(text, opts?)`

Factory function that creates a `VimHarness` instance.

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | `string` | Initial buffer content |
| `opts` | `VimOptions?` | Options (see below) |

### `VimOptions`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `cursor` | `[number, number]` | `[0, 0]` | Initial cursor `[line, col]` (0-based) |
| `mode` | `VimMode` | `"normal"` | Initial mode |
| `anchor` | `[number, number]` | — | Visual anchor `[line, col]` (for visual modes) |
| `indentStyle` | `"space" \| "tab"` | `"space"` | Indent character |
| `indentWidth` | `number` | `2` | Spaces per indent level |

### `VimHarness`

#### `.type(keys, insertText?)`

Send a key sequence to the Vim engine. Returns `this` for chaining.

- `keys` — Vim-style key notation (e.g., `"dd"`, `"<C-d>"`, `"ciw"`)
- `insertText` — Optional text to type after keys, automatically followed by `<Esc>`

```ts
// Delete a word and replace it
v.type("ciw", "replacement");

// Chain multiple operations
v.type("gg").type("dd").type("p");
```

#### `.content()`

Get the full buffer content as a string.

#### `.cursor()`

Get the current cursor position as `{ line, col }` (0-based).

#### `.mode()`

Get the current Vim mode.

#### `.lines()`

Get all lines as a `string[]`.

#### `.line(index)`

Get a specific line by 0-based index.

#### `.register(name)`

Get the content of a register. Use `'"'` for the unnamed register.

```ts
v.type("yy");
expect(v.register('"')).toBe("hello\n");
```

#### `.actions()`

Get `VimAction[]` emitted by the last `.type()` call.

#### `.allActions()`

Get all `VimAction[]` emitted since creation.

#### `.statusMessage()`

Get the current status bar message.

#### `.raw()`

Access the raw `{ ctx: VimContext, buffer: TextBuffer }` for advanced assertions.

## Key Notation

The `parseKeys` function (also exported) converts Vim-style key notation to key inputs:

| Notation | Result |
|----------|--------|
| `dd` | `["d", "d"]` |
| `<Esc>` | `["Escape"]` |
| `<Enter>` / `<CR>` | `["Enter"]` |
| `<BS>` | `["Backspace"]` |
| `<Tab>` | `["Tab"]` |
| `<Space>` | `[" "]` |
| `<C-d>` | `[{ key: "d", ctrlKey: true }]` |
| `dd<C-r>` | `["d", "d", { key: "r", ctrlKey: true }]` |

## Examples

```ts
import { vim } from "@vimee/testkit";

// Test motions
const v1 = vim("hello world");
v1.type("w");
expect(v1.cursor()).toEqual({ line: 0, col: 6 });

// Test with initial cursor position
const v2 = vim("line1\nline2\nline3", { cursor: [1, 0] });
v2.type("dd");
expect(v2.content()).toBe("line1\nline3");

// Test visual mode
const v3 = vim("hello world");
v3.type("vllld");
expect(v3.content()).toBe("o world");

// Test insert mode with auto-escape
const v4 = vim("hello");
v4.type("A", " world");
expect(v4.content()).toBe("hello world");
expect(v4.mode()).toBe("normal");
```

## License

MIT
