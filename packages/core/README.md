# @vimee/core

**Headless vim engine with a pure function API**

[![npm](https://img.shields.io/npm/v/@vimee/core)](https://www.npmjs.com/package/@vimee/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Zero dependencies. Framework agnostic. Thoroughly tested.

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
  | { type: "register-write"; register: string; text: string }
  | { type: "mark-set"; name: string; position: CursorPosition }
  | { type: "quit"; force: boolean }
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
| `statusError` | `boolean` | Whether the status message is an error |
| `indentStyle` | `"space" \| "tab"` | Indent character |
| `indentWidth` | `number` | Spaces per indent level |

## Supported Vim Features

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

### Visual Block

| Key | Description |
|---|---|
| `Ctrl-V` | Enter visual block mode |
| `I` | Block insert (prepend to each line) |
| `A` | Block append (append to each line) |

## License

MIT
