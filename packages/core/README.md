# @vimee/core

**Headless vim engine with a pure function API**

[![npm](https://img.shields.io/npm/v/@vimee/core)](https://www.npmjs.com/package/@vimee/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Zero dependencies. Framework agnostic. Fully tested with 729 tests and 97%+ line coverage.

## Install

```bash
npm install @vimee/core
```

## Core Concept

The engine is a **pure function** — give it a key and the current state, and it returns the new state plus a list of actions:

```ts
processKeystroke(key, ctx, buffer, ctrlKey?, readOnly?)
  → { newCtx: VimContext, actions: VimAction[] }
```

No side effects. No DOM. No framework. Just state in, state out.

## Quick Start

```ts
import { TextBuffer, createInitialContext, processKeystroke } from "@vimee/core";

// Create a buffer and initial context
const buffer = new TextBuffer("Hello, world!\nSecond line");
let ctx = createInitialContext({ line: 0, col: 0 });

// Move down with "j"
const { newCtx, actions } = processKeystroke("j", ctx, buffer);
ctx = newCtx;
console.log(ctx.cursor); // { line: 1, col: 0 }

// Delete line with "dd"
let r = processKeystroke("d", ctx, buffer);
r = processKeystroke("d", r.newCtx, buffer);
console.log(buffer.getContent()); // "Hello, world!"
```

## API Reference

### `processKeystroke(key, ctx, buffer, ctrlKey?, readOnly?)`

The main entry point. Processes a single keystroke through the Vim state machine.

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string` | The key pressed (e.g. `"j"`, `"Escape"`, `"d"`) |
| `ctx` | `VimContext` | Current vim state |
| `buffer` | `TextBuffer` | The text buffer (mutated in place) |
| `ctrlKey` | `boolean?` | Whether Ctrl was held (default: `false`) |
| `readOnly` | `boolean?` | Block mutations (default: `false`) |

**Returns** `{ newCtx: VimContext, actions: VimAction[] }`

### `createInitialContext(cursor, opts?)`

Creates the initial `VimContext`.

```ts
const ctx = createInitialContext(
  { line: 0, col: 0 },
  { indentStyle: "space", indentWidth: 4 },
);
```

### `parseCursorPosition(pos)`

Converts a `"line:col"` string (1-based) to a `CursorPosition` (0-based).

```ts
parseCursorPosition("3:5"); // { line: 2, col: 4 }
```

### `TextBuffer`

Manages text content with undo/redo support.

```ts
const buffer = new TextBuffer("initial content");

buffer.getContent();          // Full text
buffer.getLine(0);            // First line
buffer.getLineCount();        // Number of lines
buffer.getLineLength(0);      // Length of first line
buffer.insertAt(0, 5, "!");   // Insert at position
buffer.deleteRange(0, 0, 0, 5); // Delete range
buffer.checkpoint(cursor);    // Save undo point
buffer.undo();                // Undo last change
buffer.redo();                // Redo
```

## Types

### `CursorPosition`

```ts
interface CursorPosition {
  line: number; // 0-based line
  col: number;  // 0-based column
}
```

### `VimMode`

```ts
type VimMode =
  | "normal"
  | "insert"
  | "visual"
  | "visual-line"
  | "visual-block"
  | "command-line";
```

### `VimAction`

Discriminated union of all actions the engine can emit:

```ts
type VimAction =
  | { type: "cursor-move"; position: CursorPosition }
  | { type: "content-change"; content: string }
  | { type: "mode-change"; mode: VimMode }
  | { type: "yank"; text: string }
  | { type: "save"; content: string }
  | { type: "status-message"; message: string }
  | { type: "scroll"; direction: "up" | "down"; amount: number }
  | { type: "set-option"; option: string; value: boolean }
  | { type: "noop" };
```

### `VimContext`

Full state of the vim engine. Key fields:

| Field | Type | Description |
|-------|------|-------------|
| `mode` | `VimMode` | Current mode |
| `cursor` | `CursorPosition` | Cursor position |
| `phase` | `CommandPhase` | Parser state (`"idle"`, `"operator-pending"`, etc.) |
| `count` | `number` | Accumulated count prefix |
| `operator` | `Operator \| null` | Pending operator (`d`, `y`, `c`, `>`, `<`) |
| `register` | `string` | Unnamed register content |
| `registers` | `Record<string, string>` | Named registers (a-z) |
| `visualAnchor` | `CursorPosition \| null` | Visual mode selection anchor |
| `lastSearch` | `string` | Last search pattern |
| `marks` | `Record<string, CursorPosition>` | User marks (a-z) |
| `macroRecording` | `string \| null` | Register being recorded into |
| `macros` | `Record<string, string[]>` | Recorded macro sequences |
| `statusMessage` | `string` | Status bar text |
| `indentStyle` | `"space" \| "tab"` | Indent character |
| `indentWidth` | `number` | Spaces per indent level |

## Supported Vim Features

**Motions**: `h` `j` `k` `l` `w` `W` `b` `B` `e` `E` `0` `$` `^` `gg` `G` `f/F/t/T` `;` `,` `H` `M` `L` `{` `}` `*` `#`

**Operators**: `d` `y` `c` `>` `<` — all work with motions, text objects, counts, and visual selections

**Text Objects**: `iw` `aw` `i"` `a"` `i'` `a'` `i(` `a(` `i[` `a[` `i{` `a{` `i<` `a<` `` i` `` `` a` ``

**Editing**: `x` `X` `r` `s` `S` `J` `o` `O` `~` `p` `P` `.` `u` `Ctrl-R`

**Search**: `/pattern` `?pattern` `n` `N`

**Command-Line**: `:w` `:q` `:wq` `:{number}` `:set` `:s/pattern/replace/flags`

**Macros**: `q{a-z}` `@{a-z}` `@@` — record, playback, repeat

**Marks**: `m{a-z}` `'{a-z}`

**Visual Block**: `Ctrl-V`, block `I`/`A` insert

## License

MIT
