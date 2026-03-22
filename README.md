<div align="center">

<img src=".github/vimee.svg" width="120" alt="vimee" />

# vimee

**A headless vim engine for the web**

[![CI](https://github.com/vimeejs/vimee/workflows/CI/badge.svg)](https://github.com/vimeejs/vimee/actions/workflows/ci.yaml)
[![CodSpeed](https://img.shields.io/endpoint?url=https://codspeed.io/badge.json)](https://codspeed.io/vimeejs/vimee?utm_source=badge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

---

<div align="center">

<img src="https://assets.vimee.dev/brandresource/vimee.gif" alt="vimee demo" width="720" />

</div>

vimee is a **framework-agnostic, pure-function Vim engine** that you can plug into any editor UI. The core engine has **zero runtime dependencies** — it takes a keystroke and returns state transitions. Framework bindings (React, etc.) are thin wrappers that turn those transitions into reactive state.

## Packages

| Package                                                | Description                                         | Version                                                                                                             | Size                                                                                                                                        |
| ------------------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@vimee/core`](./packages/core)                       | Headless vim engine with pure function API          | [![npm](https://img.shields.io/npm/v/@vimee/core)](https://www.npmjs.com/package/@vimee/core)                       | [![bundle](https://img.shields.io/bundlephobia/minzip/@vimee/core)](https://bundlephobia.com/package/@vimee/core)                           |
| [`@vimee/react`](./packages/react)                     | React `useVim` hook                                 | [![npm](https://img.shields.io/npm/v/@vimee/react)](https://www.npmjs.com/package/@vimee/react)                     | [![bundle](https://img.shields.io/bundlephobia/minzip/@vimee/react)](https://bundlephobia.com/package/@vimee/react)                         |
| [`@vimee/plugin-textarea`](./packages/plugin-textarea) | Attach vim to any textarea                          | [![npm](https://img.shields.io/npm/v/@vimee/plugin-textarea)](https://www.npmjs.com/package/@vimee/plugin-textarea) | [![bundle](https://img.shields.io/bundlephobia/minzip/@vimee/plugin-textarea)](https://bundlephobia.com/package/@vimee/plugin-textarea)     |
| [`@vimee/shiki-editor`](./packages/shiki-editor)       | Vim editor component with Shiki syntax highlighting | [![npm](https://img.shields.io/npm/v/@vimee/shiki-editor)](https://www.npmjs.com/package/@vimee/shiki-editor)       | [![bundle](https://img.shields.io/bundlephobia/minzip/@vimee/shiki-editor)](https://bundlephobia.com/package/@vimee/shiki-editor)           |
| [`@vimee/testkit`](./packages/testkit)                 | Test utilities for Vim operations                   | [![npm](https://img.shields.io/npm/v/@vimee/testkit)](https://www.npmjs.com/package/@vimee/testkit)                 | [![bundle](https://img.shields.io/bundlephobia/minzip/@vimee/testkit)](https://bundlephobia.com/package/@vimee/testkit)                     |

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

- **Modes**: Normal, Insert, Visual, Visual-Line, Visual-Block, Command-Line
- **Motions**: `h` `j` `k` `l` `w` `W` `b` `B` `e` `E` `0` `$` `^` `gg` `G` `f` `F` `t` `T` `;` `,` `H` `M` `L` `{` `}`
- **Operators**: `d` `y` `c` `>` `<` with motions and text objects
- **Text Objects**: `iw` `aw` `i"` `a"` `i'` `a'` `i(` `a(` `i[` `a[` `i{` `a{` `i<` `a<` `` i` `` `` a` ``
- **Search**: `/pattern` `?pattern` `n` `N` `*` `#`
- **Command-Line**: `:w` `:q` `:wq` `:{number}` `:set` `:s/pattern/replace/flags`
- **Editing**: `x` `X` `r` `s` `S` `J` `o` `O` `~` `.` `u` `Ctrl-R`
- **Registers**: `"a`–`"z` named registers, unnamed register
- **Macros**: `q{a-z}` record, `@{a-z}` playback, `@@` repeat last
- **Marks**: `m{a-z}` set mark, `'{a-z}` jump to mark
- **Counts**: `3dd`, `5j`, `2dw`, etc.
- **Visual Block**: `Ctrl-V`, block `I`/`A` insert
- **Scroll**: `Ctrl-U` `Ctrl-D` `Ctrl-B` `Ctrl-F`
- **Indent**: `>>` `<<` with configurable style/width

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

## Playground

A live playground app is included as a [git submodule](https://git-scm.com/book/en/v2/Git-Tools-Submodules).

```bash
# Clone with playground
git clone --recursive https://github.com/vimeejs/vimee.git

# Or, if you already cloned without --recursive
git submodule update --init

# Install dependencies (includes playground)
bun install

# Build all packages, then start the playground
bun run build
cd playground && bun run dev
```

The playground uses `workspace:*` to reference local packages, so any changes you build in `packages/*` are reflected immediately.

## Monorepo Structure

```
packages/
├── core/              # @vimee/core — headless vim engine
├── react/             # @vimee/react — React useVim hook
├── plugin-textarea/   # @vimee/plugin-textarea — vim for any textarea
├── shiki-editor/      # @vimee/shiki-editor — editor component with Shiki
└── testkit/           # @vimee/testkit — test utilities for Vim operations
playground/            # Live demo app (git submodule)
```

Built with [Bun](https://bun.sh) workspaces, [tsup](https://tsup.egoist.dev/) for bundling, and [Vitest](https://vitest.dev/) for testing.

## License

MIT
