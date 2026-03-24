<div align="center">

<img src=".github/vimee.svg" width="120" alt="vimee" />

# vimee

**A headless vim engine for the web**

[![CI](https://github.com/vimeejs/vimee/workflows/CI/badge.svg)](https://github.com/vimeejs/vimee/actions/workflows/ci.yaml)
[![CodSpeed](https://img.shields.io/endpoint?url=https://codspeed.io/badge.json)](https://codspeed.io/vimeejs/vimee?utm_source=badge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

---

<img src="./.github/vimee.gif" width="100%" alt="vimee gif" />

vimee is a **framework-agnostic, pure-function Vim engine** that you can plug into any editor UI. The core engine has **zero runtime dependencies** — it takes a keystroke and returns state transitions. Framework bindings (React, etc.) are thin wrappers that turn those transitions into reactive state.

## Packages

| Package                                                | Description                                         | Version                                                                                                             | Size                                                                                                                                    |
| ------------------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| [`@vimee/core`](./packages/core)                       | Headless vim engine with pure function API          | [![npm](https://img.shields.io/npm/v/@vimee/core)](https://www.npmjs.com/package/@vimee/core)                       | [![bundle](https://img.shields.io/bundlephobia/minzip/@vimee/core)](https://bundlephobia.com/package/@vimee/core)                       |
| [`@vimee/react`](./packages/react)                     | React `useVim` hook                                 | [![npm](https://img.shields.io/npm/v/@vimee/react)](https://www.npmjs.com/package/@vimee/react)                     | [![bundle](https://img.shields.io/bundlephobia/minzip/@vimee/react)](https://bundlephobia.com/package/@vimee/react)                     |
| [`@vimee/plugin-textarea`](./packages/plugin-textarea) | Attach vim to any textarea                          | [![npm](https://img.shields.io/npm/v/@vimee/plugin-textarea)](https://www.npmjs.com/package/@vimee/plugin-textarea) | [![bundle](https://img.shields.io/bundlephobia/minzip/@vimee/plugin-textarea)](https://bundlephobia.com/package/@vimee/plugin-textarea) |
| [`@vimee/plugin-monaco`](./packages/plugin-monaco)     | Attach vim to any Monaco Editor                     | [![npm](https://img.shields.io/npm/v/@vimee/plugin-monaco)](https://www.npmjs.com/package/@vimee/plugin-monaco)     | [![bundle](https://img.shields.io/bundlephobia/minzip/@vimee/plugin-monaco)](https://bundlephobia.com/package/@vimee/plugin-monaco)     |
| [`@vimee/plugin-codemirror`](./packages/plugin-codemirror) | Attach vim to any CodeMirror 6 editor           | [![npm](https://img.shields.io/npm/v/@vimee/plugin-codemirror)](https://www.npmjs.com/package/@vimee/plugin-codemirror) | [![bundle](https://img.shields.io/bundlephobia/minzip/@vimee/plugin-codemirror)](https://bundlephobia.com/package/@vimee/plugin-codemirror) |
| [`@vimee/shiki-editor`](./packages/shiki-editor)       | Vim editor component with Shiki syntax highlighting | [![npm](https://img.shields.io/npm/v/@vimee/shiki-editor)](https://www.npmjs.com/package/@vimee/shiki-editor)       | [![bundle](https://img.shields.io/bundlephobia/minzip/@vimee/shiki-editor)](https://bundlephobia.com/package/@vimee/shiki-editor)       |
| [`@vimee/testkit`](./packages/testkit)                 | Test utilities for Vim operations                   | [![npm](https://img.shields.io/npm/v/@vimee/testkit)](https://www.npmjs.com/package/@vimee/testkit)                 | [![bundle](https://img.shields.io/bundlephobia/minzip/@vimee/testkit)](https://bundlephobia.com/package/@vimee/testkit)                 |

## Quick Start

### With Shiki Editor (recommended)

```bash
npm install @vimee/core @vimee/react @vimee/shiki-editor shiki
```

```tsx
import { Vim } from "@vimee/shiki-editor";
import "@vimee/shiki-editor/styles.css";
import { createHighlighter } from "shiki";

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

### With React (custom UI)

```bash
npm install @vimee/core @vimee/react
```

```tsx
import { useVim } from "@vimee/react";

function Editor() {
  const { content, cursor, mode, handleKeyDown } = useVim({
    content: "Hello, vim!",
    onChange: (c) => console.log("Changed:", c),
  });

  return (
    <div tabIndex={0} onKeyDown={handleKeyDown}>
      <div>Mode: {mode}</div>
      <pre>{content}</pre>
      <div>
        Cursor: {cursor.line}:{cursor.col}
      </div>
    </div>
  );
}
```

### With Monaco Editor

```bash
npm install @vimee/core @vimee/plugin-monaco
```

```ts
import { attach } from "@vimee/plugin-monaco";

// Assumes `editor` is a monaco.editor.IStandaloneCodeEditor instance
const vim = attach(editor, {
  onChange: (value) => console.log("Changed:", value),
  onModeChange: (mode) => console.log("Mode:", mode),
});

// Later...
vim.destroy();
```

### With CodeMirror 6

```bash
npm install @vimee/core @vimee/plugin-codemirror
```

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
  onChange: (value) => console.log("Changed:", value),
  onModeChange: (mode) => console.log("Mode:", mode),
});

// Later...
vim.destroy();
```

### Core engine only

```bash
npm install @vimee/core
```

```ts
import {
  TextBuffer,
  createInitialContext,
  processKeystroke,
} from "@vimee/core";

const buffer = new TextBuffer("Hello, world!");
let ctx = createInitialContext({ line: 0, col: 0 });

// Type "dd" to delete a line
const r1 = processKeystroke("d", ctx, buffer);
ctx = r1.newCtx;
const r2 = processKeystroke("d", ctx, buffer);
ctx = r2.newCtx;

console.log(buffer.getContent()); // ""
```

## Architecture

```
processKeystroke(key, ctx, buffer, ctrlKey?, readOnly?)
  → { newCtx: VimContext, actions: VimAction[] }
```

The engine is a **pure function** — no side effects, no DOM, no framework dependency. All state transitions are explicit and testable. The `VimAction[]` array tells the UI layer what happened (cursor moved, content changed, mode switched, etc.).

## Supported Vim Features

**Modes**: Normal, Insert, Visual, Visual-Line, Visual-Block, Command-Line

### Motions

| Key | Description |
|---|---|
| `h` `j` `k` `l` | Left / Down / Up / Right |
| `w` `W` | Word forward (word / WORD) |
| `b` `B` | Word backward (word / WORD) |
| `e` `E` | Word end forward (word / WORD) |
| `0` | Start of line |
| `^` | First non-blank character |
| `$` | End of line |
| `gg` | First line |
| `G` | Last line (or `{count}G` to jump) |
| `H` `M` `L` | Screen top / middle / bottom |
| `f{char}` `F{char}` | Find char forward / backward |
| `t{char}` `T{char}` | Till char forward / backward |
| `;` `,` | Repeat / reverse last `f` / `F` / `t` / `T` |
| `{` `}` | Paragraph backward / forward |
| `*` `#` | Search word under cursor forward / backward |

### Operators

All operators work with motions, text objects, counts, and visual selections.

| Key | Description |
|---|---|
| `d` | Delete |
| `y` | Yank (copy) |
| `c` | Change (delete and enter insert mode) |
| `>` | Indent right |
| `<` | Indent left |

### Text Objects

Used after an operator or in visual mode (e.g. `diw`, `ca"`).

| Key | Description |
|---|---|
| `iw` `aw` | Inner / around word |
| `i"` `a"` | Inner / around double quotes |
| `i'` `a'` | Inner / around single quotes |
| `` i` `` `` a` `` | Inner / around backticks |
| `i(` `a(` | Inner / around parentheses |
| `i[` `a[` | Inner / around square brackets |
| `i{` `a{` | Inner / around curly braces |
| `i<` `a<` | Inner / around angle brackets |

### Editing

| Key | Description |
|---|---|
| `x` | Delete character under cursor |
| `X` | Delete character before cursor |
| `r{char}` | Replace character under cursor |
| `s` | Substitute character (delete and enter insert mode) |
| `S` | Substitute line |
| `J` | Join lines |
| `o` `O` | Open new line below / above |
| `~` | Toggle case |
| `p` `P` | Paste after / before cursor |
| `.` | Repeat last change |
| `u` | Undo |
| `Ctrl-R` | Redo |
| `Ctrl-W` | Delete word backward (insert mode) |

### Search

| Key | Description |
|---|---|
| `/pattern` | Forward search |
| `?pattern` | Backward search |
| `n` | Repeat search in same direction |
| `N` | Repeat search in opposite direction |

### Command-Line

| Command | Description | Action |
|---|---|---|
| `:w` | Save | `{ type: "save", content }` |
| `:q` | Quit | `{ type: "quit", force: false }` |
| `:q!` | Force quit | `{ type: "quit", force: true }` |
| `:wq` / `:x` | Save and quit | `save` + `quit` |
| `:noh` / `:nohlsearch` | Clear search highlight | `mode-change` |
| `:set number` / `:set nu` | Show line numbers | `{ type: "set-option", option: "number", value: true }` |
| `:set nonumber` / `:set nonu` | Hide line numbers | `{ type: "set-option", option: "number", value: false }` |
| `:{number}` | Jump to line | `cursor-move` |
| `:s/old/new/[gi]` | Substitute (current line) | `content-change` |
| `:%s/old/new/[gi]` | Substitute (all lines) | `content-change` |
| `:N,Ms/old/new/[gi]` | Substitute (line range) | `content-change` |

### Macros

| Key | Description |
|---|---|
| `q{a-z}` | Start recording macro into register |
| `q` | Stop recording (while recording) |
| `@{a-z}` | Playback macro from register |
| `@@` | Repeat last macro |

### Marks

| Key | Description |
|---|---|
| `m{a-z}` | Set mark |
| `'{a-z}` | Jump to mark |

### Registers

| Key | Description |
|---|---|
| `"a` – `"z` | Named registers |
| `""` | Unnamed register (default) |

### Visual Block

| Key | Description |
|---|---|
| `Ctrl-V` | Enter visual block mode |
| `I` | Block insert (prepend to each line) |
| `A` | Block append (append to each line) |

### Scroll

| Key | Description |
|---|---|
| `Ctrl-U` | Half page up |
| `Ctrl-D` | Half page down |
| `Ctrl-B` | Full page up |
| `Ctrl-F` | Full page down |

### Counts

All motions, operators, and editing commands support count prefixes (e.g. `3dd`, `5j`, `2dw`).

## Development

```bash
# Install
bun install

# Build all packages
bun run build

# Run all tests
bun run test

# Type check
bun run typecheck

# Lint
bun run lint

# Generate a changeset
bun run changeset:gen          # auto-detect from commits
bun run changeset:gen major    # force major bump
```

## Debug App

A debug app is included for local development and E2E testing. It provides a minimal page for each plugin.

```bash
# Start the debug app dev server
bun run debug
```

The debug app uses `workspace:*` to reference local packages, so any changes you build in `packages/*` are reflected immediately.

## Monorepo Structure

```
packages/
├── core/              # @vimee/core — headless vim engine
├── react/             # @vimee/react — React useVim hook
├── plugin-textarea/   # @vimee/plugin-textarea — vim for any textarea
├── plugin-monaco/     # @vimee/plugin-monaco — vim for any Monaco Editor
├── plugin-codemirror/ # @vimee/plugin-codemirror — vim for any CodeMirror 6 editor
├── shiki-editor/      # @vimee/shiki-editor — editor component with Shiki
└── testkit/           # @vimee/testkit — test utilities for Vim operations
debug/                 # Debug app for local development (Vite MPA)
e2e/                   # Playwright E2E tests
```

Built with [Bun](https://bun.sh) workspaces, [tsup](https://tsup.egoist.dev/) for bundling, and [Vitest](https://vitest.dev/) for testing.

## License

MIT
