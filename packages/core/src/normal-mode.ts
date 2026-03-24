/**
 * normal-mode.ts
 *
 * Normal mode keystroke processing.
 *
 * Normal mode is Vim's default mode and handles:
 * - Count prefixes (3j, 5dw, etc.)
 * - Operators (d, y, c) -> transition to operator-pending state
 * - Motions (h, j, k, l, w, e, b, etc.)
 * - Transition to insert mode (i, a, o, I, A, O)
 * - Edit commands (x, p, P, r, J)
 * - Transition to visual mode (v, V)
 * - Transition to command-line / search (:, /, ?)
 * - Undo / redo (u, Ctrl-R)
 * - g prefix commands (gg)
 * - Character-pending commands (f, F, t, T, r)
 */

import type { VimContext, VimAction, CursorPosition } from "./types";
import type { TextBuffer } from "./buffer";
import type { KeystrokeResult } from "./key-utils";
import {
  isCountKey,
  isOperator,
  isCharCommand,
  getEffectiveCount,
  isCountExplicit,
  modeChange,
  accumulateCount,
  resetContext,
} from "./key-utils";
import { handleCtrlKey } from "./ctrl-keys";
import { resolveMotion } from "./motion-resolver";
import { executeOperatorOnRange, executeLineOperator } from "./operators";
import { handleCharPending } from "./char-pending";
import {
  motionGG,
  motionDollar,
  motionFChar,
  motionFCharBack,
  motionTChar,
  motionTCharBack,
} from "./motions";
import { searchInBuffer } from "./search";
import { resolveTextObject } from "./text-objects";

function indentOpts(ctx: VimContext) {
  return { style: ctx.indentStyle, width: ctx.indentWidth };
}

/**
 * Store yanked text into the appropriate register(s).
 * Always updates the unnamed register. If selectedRegister is set,
 * also stores in the named register and clears the selection.
 */
function storeRegister(ctx: VimContext, text: string): Partial<VimContext> {
  const result: Partial<VimContext> = { register: text };
  if (ctx.selectedRegister) {
    result.registers = {
      ...ctx.registers,
      [ctx.selectedRegister]: text,
    };
  }
  return result;
}

/**
 * Get the text from the active register (selected or unnamed).
 */
function getRegisterText(ctx: VimContext): string {
  if (ctx.selectedRegister) {
    return ctx.registers[ctx.selectedRegister] ?? "";
  }
  return ctx.register;
}

/**
 * Append register name to a status message if a named register is selected.
 */
function withRegisterInfo(ctx: VimContext, msg: string): string {
  if (ctx.selectedRegister && msg) {
    return `${msg} into "${ctx.selectedRegister}`;
  }
  return msg;
}

/**
 * Main handler for normal mode.
 * Receives a keystroke and returns state transitions and actions.
 */
export function processNormalMode(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
  ctrlKey: boolean,
  readOnly: boolean = false,
): KeystrokeResult {
  // --- Mark pending (m + a-z) ---
  if (ctx.phase === "mark-pending") {
    return handleMarkPending(key, ctx);
  }

  // --- Jump to mark pending (` + a-z) ---
  if (ctx.phase === "jump-mark-pending") {
    return handleJumpMarkPending(key, ctx, buffer);
  }

  // --- Register pending ("x) ---
  if (ctx.phase === "register-pending") {
    return handleRegisterPending(key, ctx);
  }

  // --- g prefix pending ---
  if (ctx.phase === "g-pending") {
    return handleGPending(key, ctx, buffer);
  }

  // --- Text object pending (i/a + object key) ---
  if (ctx.phase === "text-object-pending") {
    return handleTextObjectPending(key, ctx, buffer);
  }

  // --- Character pending (f, F, t, T, r) ---
  if (ctx.phase === "char-pending") {
    return handleCharPending(key, ctx, buffer);
  }

  // --- Ctrl key combinations ---
  if (ctrlKey) {
    return handleCtrlKey(key, ctx, buffer, readOnly);
  }

  // --- readOnly: block mutating operations ---
  if (readOnly && ctx.phase === "idle") {
    // prettier-ignore
    const mutatingKeys = new Set([
      "i", "a", "o", "I", "A", "O",  // insert entry
      "x", "p", "P", "~",               // edit commands
      "d", "c", "D", "C", ">", "<",    // mutating operators (y is allowed)
      "J",                              // join lines
      "u",                              // undo
      "r",                              // replace char
      ":",                              // ex commands
      ".",                              // dot repeat
    ]);
    if (mutatingKeys.has(key)) {
      return { newCtx: resetContext(ctx), actions: [] };
    }
  }

  // --- Count input ---
  if (isCountKey(key, ctx)) {
    return accumulateCount(key, ctx);
  }

  // --- Register prefix ("x) ---
  if (key === '"') {
    return {
      newCtx: { ...ctx, phase: "register-pending" },
      actions: [],
    };
  }

  // --- Key processing during operator-pending ---
  if (ctx.phase === "operator-pending" && ctx.operator) {
    return handleOperatorPending(key, ctx, buffer);
  }

  // --- Start operator ---
  if (isOperator(key)) {
    return {
      newCtx: {
        ...ctx,
        operator: key,
        phase: "operator-pending",
        statusMessage: key,
      },
      actions: [],
    };
  }

  // --- Motion ---
  const motionResult = tryMotion(key, ctx, buffer);
  if (motionResult) return motionResult;

  // --- g prefix ---
  if (key === "g") {
    return {
      newCtx: { ...ctx, phase: "g-pending" },
      actions: [],
    };
  }

  // --- Character-pending commands ---
  if (isCharCommand(key)) {
    return {
      newCtx: { ...ctx, phase: "char-pending", charCommand: key },
      actions: [],
    };
  }

  // --- Insert mode entry ---
  const insertResult = tryInsertEntry(key, ctx, buffer);
  if (insertResult) return insertResult;

  // --- Edit commands ---
  const editResult = tryEditCommand(key, ctx, buffer);
  if (editResult) return editResult;

  // --- undo ---
  if (key === "u") {
    return handleUndo(ctx, buffer);
  }

  // --- Visual mode ---
  if (key === "v") {
    return {
      newCtx: {
        ...ctx,
        mode: "visual",
        phase: "idle",
        count: 0,
        visualAnchor: { ...ctx.cursor },
        statusMessage: "-- VISUAL --",
      },
      actions: [{ type: "mode-change", mode: "visual" }],
    };
  }
  if (key === "V") {
    return {
      newCtx: {
        ...ctx,
        mode: "visual-line",
        phase: "idle",
        count: 0,
        visualAnchor: { ...ctx.cursor },
        statusMessage: "-- VISUAL LINE --",
      },
      actions: [{ type: "mode-change", mode: "visual-line" }],
    };
  }

  // --- Command-line / search ---
  if (key === ":" || key === "/" || key === "?") {
    return enterCommandLine(key as ":" | "/" | "?", ctx);
  }

  // --- n / N: repeat search ---
  if (key === "n" || key === "N") {
    return handleSearchRepeat(key, ctx, buffer);
  }

  // --- * / #: search word under cursor ---
  if (key === "*" || key === "#") {
    return handleWordSearch(key, ctx, buffer);
  }

  // --- ; / ,: repeat last f/F/t/T ---
  if (key === ";" || key === ",") {
    return handleCharSearchRepeat(key, ctx, buffer);
  }

  // --- J: join lines ---
  if (key === "J") {
    return handleJoinLines(ctx, buffer);
  }

  // --- m: set mark ---
  if (key === "m") {
    return {
      newCtx: { ...ctx, phase: "mark-pending" },
      actions: [],
    };
  }

  // --- `: jump to mark ---
  if (key === "`") {
    return {
      newCtx: { ...ctx, phase: "jump-mark-pending" },
      actions: [],
    };
  }

  // --- ': jump to mark (line-wise, first non-blank) ---
  if (key === "'") {
    return {
      newCtx: { ...ctx, phase: "jump-mark-pending" },
      actions: [],
    };
  }

  // --- Unmatched key -> reset ---
  return {
    newCtx: resetContext(ctx),
    actions: [],
  };
}

// =====================
// Internal handlers
// =====================

/**
 * Key processing after g prefix.
 * gg -> move to the beginning of the file
 */
/**
 * Key processing during text-object-pending state.
 * Receives the object key (w, W, ", ', (, {, [, etc.) and executes the operator.
 */
/**
 * Handle register name input after " prefix.
 * Valid register names: a-z (named), " (unnamed).
 */
function handleRegisterPending(key: string, ctx: VimContext): KeystrokeResult {
  if (/^[a-z"]$/i.test(key)) {
    return {
      newCtx: {
        ...ctx,
        phase: "idle",
        selectedRegister: key === '"' ? null : key.toLowerCase(),
      },
      actions: [],
    };
  }
  // Invalid register name -> reset
  return { newCtx: resetContext(ctx), actions: [] };
}

function handleTextObjectPending(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  const modifier = ctx.textObjectModifier!;
  const range = resolveTextObject(modifier, key, ctx.cursor, buffer);

  if (!range) {
    return { newCtx: resetContext(ctx), actions: [] };
  }

  // If in operator-pending, execute the operator on the text object range
  if (ctx.operator) {
    buffer.saveUndoPoint(ctx.cursor);
    const result = executeOperatorOnRange(ctx.operator, range, buffer, ctx.cursor, indentOpts(ctx));

    return {
      newCtx: {
        ...resetContext(ctx),
        mode: result.newMode,
        cursor: result.newCursor,
        ...storeRegister(ctx, result.yankedText),
        statusMessage: result.newMode === "insert" ? "-- INSERT --" : result.statusMessage || "",
      },
      actions: [
        ...result.actions,
        { type: "cursor-move", position: result.newCursor },
        ...(result.newMode !== ctx.mode
          ? [{ type: "mode-change" as const, mode: result.newMode }]
          : []),
      ],
    };
  }

  // No operator (shouldn't happen in normal mode, but handle gracefully)
  return { newCtx: resetContext(ctx), actions: [] };
}

function handleGPending(key: string, ctx: VimContext, buffer: TextBuffer): KeystrokeResult {
  if (key === "g") {
    const count = ctx.count > 0 ? ctx.count : null;
    const result = motionGG(ctx.cursor, buffer, count);

    // If in operator-pending state, execute the operator
    if (ctx.operator) {
      buffer.saveUndoPoint(ctx.cursor);
      const opResult = executeOperatorOnRange(
        ctx.operator,
        result.range,
        buffer,
        ctx.cursor,
        indentOpts(ctx),
      );
      return {
        newCtx: {
          ...resetContext(ctx),
          mode: opResult.newMode,
          cursor: opResult.newCursor,
          ...storeRegister(ctx, opResult.yankedText),
          statusMessage: opResult.statusMessage,
        },
        actions: [
          ...opResult.actions,
          { type: "cursor-move", position: opResult.newCursor },
          ...(opResult.newMode !== ctx.mode
            ? [{ type: "mode-change" as const, mode: opResult.newMode }]
            : []),
        ],
      };
    }

    return {
      newCtx: {
        ...resetContext(ctx),
        cursor: result.cursor,
      },
      actions: [{ type: "cursor-move", position: result.cursor }],
    };
  }

  // Unknown g command -> reset
  return {
    newCtx: resetContext(ctx),
    actions: [],
  };
}

/**
 * Key processing during operator-pending state.
 * Waits for a motion or count after the operator.
 */
function handleOperatorPending(key: string, ctx: VimContext, buffer: TextBuffer): KeystrokeResult {
  // Note: Count input is handled by the top-level isCountKey check in processNormalMode
  // before this function is called, so no count check is needed here.

  // Same operator key -> line operation (dd, yy, cc)
  if (key === ctx.operator) {
    buffer.saveUndoPoint(ctx.cursor);
    const count = getEffectiveCount(ctx);
    const result = executeLineOperator(ctx.operator!, ctx.cursor, count, buffer, indentOpts(ctx));

    return {
      newCtx: {
        ...resetContext(ctx),
        mode: result.newMode,
        cursor: result.newCursor,
        ...storeRegister(ctx, result.yankedText),
        statusMessage: withRegisterInfo(ctx, result.statusMessage),
      },
      actions: [
        ...result.actions,
        { type: "cursor-move", position: result.newCursor },
        ...(result.newMode !== ctx.mode
          ? [{ type: "mode-change" as const, mode: result.newMode }]
          : []),
      ],
    };
  }

  // Character-pending commands (e.g., df{char})
  if (isCharCommand(key) && key !== "r") {
    return {
      newCtx: { ...ctx, phase: "char-pending", charCommand: key },
      actions: [],
    };
  }

  // Text object (e.g., diw, ciw, yaw)
  if (key === "i" || key === "a") {
    return {
      newCtx: {
        ...ctx,
        phase: "text-object-pending",
        textObjectModifier: key,
      },
      actions: [],
    };
  }

  // ; / , repeat last char search with operator (e.g., d;)
  if ((key === ";" || key === ",") && ctx.lastCharSearch) {
    const charMotion = resolveCharSearchRepeat(key, ctx, buffer);
    if (
      charMotion &&
      (charMotion.cursor.line !== ctx.cursor.line || charMotion.cursor.col !== ctx.cursor.col)
    ) {
      buffer.saveUndoPoint(ctx.cursor);
      const result = executeOperatorOnRange(
        ctx.operator!,
        charMotion.range,
        buffer,
        ctx.cursor,
        indentOpts(ctx),
      );
      return {
        newCtx: {
          ...resetContext(ctx),
          mode: result.newMode,
          cursor: result.newCursor,
          ...storeRegister(ctx, result.yankedText),
          statusMessage: withRegisterInfo(ctx, result.statusMessage),
        },
        actions: [
          ...result.actions,
          { type: "cursor-move", position: result.newCursor },
          ...(result.newMode !== ctx.mode
            ? [{ type: "mode-change" as const, mode: result.newMode }]
            : []),
        ],
      };
    }
    return { newCtx: resetContext(ctx), actions: [] };
  }

  // g prefix (e.g., dgg)
  if (key === "g") {
    return {
      newCtx: { ...ctx, phase: "g-pending" },
      actions: [],
    };
  }

  // Motion
  const count = getEffectiveCount(ctx);
  const countExplicit = isCountExplicit(ctx);
  const motion = resolveMotion(key, ctx.cursor, buffer, count, countExplicit, ctx);

  if (motion) {
    buffer.saveUndoPoint(ctx.cursor);
    const result = executeOperatorOnRange(
      ctx.operator!,
      motion.range,
      buffer,
      ctx.cursor,
      indentOpts(ctx),
    );

    return {
      newCtx: {
        ...resetContext(ctx),
        mode: result.newMode,
        cursor: result.newCursor,
        ...storeRegister(ctx, result.yankedText),
        statusMessage: withRegisterInfo(ctx, result.statusMessage),
      },
      actions: [
        ...result.actions,
        { type: "cursor-move", position: result.newCursor },
        ...(result.newMode !== ctx.mode
          ? [{ type: "mode-change" as const, mode: result.newMode }]
          : []),
      ],
    };
  }

  // Invalid key -> cancel operator
  return {
    newCtx: resetContext(ctx),
    actions: [],
  };
}

/**
 * Attempt to resolve and execute a motion.
 * Returns null if no motion matches.
 */
function tryMotion(key: string, ctx: VimContext, buffer: TextBuffer): KeystrokeResult | null {
  const count = getEffectiveCount(ctx);
  const countExplicit = isCountExplicit(ctx);
  const motion = resolveMotion(key, ctx.cursor, buffer, count, countExplicit, ctx);

  if (!motion) return null;

  return {
    newCtx: {
      ...resetContext(ctx),
      cursor: motion.cursor,
    },
    actions: [{ type: "cursor-move", position: motion.cursor }],
  };
}

/**
 * Attempt to transition to insert mode.
 * Handles i, a, I, A, o, O.
 */
function tryInsertEntry(key: string, ctx: VimContext, buffer: TextBuffer): KeystrokeResult | null {
  switch (key) {
    case "i":
      return modeChange(ctx, "insert");

    case "a": {
      // Move cursor one position to the right (do not exceed end of line)
      const col = Math.min(ctx.cursor.col + 1, buffer.getLineLength(ctx.cursor.line));
      return modeChange({ ...ctx, cursor: { ...ctx.cursor, col } }, "insert");
    }

    case "I": {
      // Move to the first non-whitespace character on the line and enter insert
      const lineText = buffer.getLine(ctx.cursor.line);
      const col = lineText.match(/\S/)?.index ?? 0;
      return modeChange({ ...ctx, cursor: { ...ctx.cursor, col } }, "insert");
    }

    case "A": {
      // Move to end of line and enter insert
      const col = buffer.getLineLength(ctx.cursor.line);
      return modeChange({ ...ctx, cursor: { ...ctx.cursor, col } }, "insert");
    }

    case "o": {
      // Insert a new line below with same indentation and enter insert
      buffer.saveUndoPoint(ctx.cursor);
      const indent = getLeadingWhitespace(buffer.getLine(ctx.cursor.line));
      buffer.insertLine(ctx.cursor.line + 1, indent);
      const newCursor = { line: ctx.cursor.line + 1, col: indent.length };
      return {
        newCtx: {
          ...resetContext(ctx),
          mode: "insert",
          cursor: newCursor,
          statusMessage: "-- INSERT --",
        },
        actions: [
          { type: "content-change", content: buffer.getContent() },
          { type: "cursor-move", position: newCursor },
          { type: "mode-change", mode: "insert" },
        ],
      };
    }

    case "O": {
      // Insert a new line above with same indentation and enter insert
      buffer.saveUndoPoint(ctx.cursor);
      const indent = getLeadingWhitespace(buffer.getLine(ctx.cursor.line));
      buffer.insertLine(ctx.cursor.line, indent);
      const newCursor = { line: ctx.cursor.line, col: indent.length };
      return {
        newCtx: {
          ...resetContext(ctx),
          mode: "insert",
          cursor: newCursor,
          statusMessage: "-- INSERT --",
        },
        actions: [
          { type: "content-change", content: buffer.getContent() },
          { type: "cursor-move", position: newCursor },
          { type: "mode-change", mode: "insert" },
        ],
      };
    }

    default:
      return null;
  }
}

/**
 * Attempt to handle edit commands (x, p, P).
 */
function tryEditCommand(key: string, ctx: VimContext, buffer: TextBuffer): KeystrokeResult | null {
  const count = getEffectiveCount(ctx);

  switch (key) {
    case "x":
      return handleDeleteChar(ctx, buffer, count);
    case "p":
      return handlePasteAfter(ctx, buffer, count);
    case "P":
      return handlePasteBefore(ctx, buffer, count);
    case "D":
      return handleDeleteToEndOfLine(ctx, buffer);
    case "C":
      return handleChangeToEndOfLine(ctx, buffer);
    case "~":
      return handleToggleCase(ctx, buffer, count);
    default:
      return null;
  }
}

/**
 * D: Delete from cursor to end of line (equivalent to d$)
 */
function handleDeleteToEndOfLine(ctx: VimContext, buffer: TextBuffer): KeystrokeResult {
  const motion = motionDollar(ctx.cursor, buffer, 1);
  buffer.saveUndoPoint(ctx.cursor);
  const result = executeOperatorOnRange("d", motion.range, buffer, ctx.cursor);

  return {
    newCtx: {
      ...resetContext(ctx),
      cursor: result.newCursor,
      register: result.yankedText,
      statusMessage: result.statusMessage,
    },
    actions: [...result.actions, { type: "cursor-move", position: result.newCursor }],
  };
}

/**
 * C: Change from cursor to end of line (equivalent to c$)
 */
function handleChangeToEndOfLine(ctx: VimContext, buffer: TextBuffer): KeystrokeResult {
  const motion = motionDollar(ctx.cursor, buffer, 1);
  buffer.saveUndoPoint(ctx.cursor);
  const result = executeOperatorOnRange("c", motion.range, buffer, ctx.cursor);

  return {
    newCtx: {
      ...resetContext(ctx),
      mode: "insert",
      cursor: result.newCursor,
      register: result.yankedText,
      statusMessage: result.statusMessage || "-- INSERT --",
    },
    actions: [
      ...result.actions,
      { type: "cursor-move", position: result.newCursor },
      { type: "mode-change", mode: "insert" },
    ],
  };
}

/**
 * ~: Toggle case of the character under the cursor and advance
 */
function handleToggleCase(ctx: VimContext, buffer: TextBuffer, count: number): KeystrokeResult {
  const lineLen = buffer.getLineLength(ctx.cursor.line);
  if (lineLen === 0) {
    return { newCtx: resetContext(ctx), actions: [] };
  }

  buffer.saveUndoPoint(ctx.cursor);

  const line = buffer.getLine(ctx.cursor.line);
  const chars = line.split("");
  const end = Math.min(ctx.cursor.col + count, lineLen);

  for (let i = ctx.cursor.col; i < end; i++) {
    const ch = chars[i];
    chars[i] = ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase();
  }

  buffer.setLine(ctx.cursor.line, chars.join(""));

  const newCol = Math.min(end, lineLen - 1);
  const newCursor = { line: ctx.cursor.line, col: newCol };

  return {
    newCtx: { ...resetContext(ctx), cursor: newCursor },
    actions: [
      { type: "content-change", content: buffer.getContent() },
      { type: "cursor-move", position: newCursor },
    ],
  };
}

/**
 * x: Delete the character under the cursor
 */
function handleDeleteChar(ctx: VimContext, buffer: TextBuffer, count: number): KeystrokeResult {
  if (buffer.getLineLength(ctx.cursor.line) === 0) {
    return { newCtx: ctx, actions: [] };
  }

  buffer.saveUndoPoint(ctx.cursor);
  const deleted = buffer.deleteAt(ctx.cursor.line, ctx.cursor.col, count);
  const maxCol = Math.max(0, buffer.getLineLength(ctx.cursor.line) - 1);
  const newCursor = {
    line: ctx.cursor.line,
    col: Math.min(ctx.cursor.col, maxCol),
  };

  return {
    newCtx: {
      ...resetContext(ctx),
      ...storeRegister(ctx, deleted),
      cursor: newCursor,
    },
    actions: [
      { type: "yank", text: deleted },
      { type: "content-change", content: buffer.getContent() },
      { type: "cursor-move", position: newCursor },
    ],
  };
}

/**
 * p: Paste after the cursor
 */
function handlePasteAfter(ctx: VimContext, buffer: TextBuffer, count: number): KeystrokeResult {
  const text = getRegisterText(ctx);
  if (!text) return { newCtx: resetContext(ctx), actions: [] };

  buffer.saveUndoPoint(ctx.cursor);

  // Line-wise paste (when the register ends with a newline)
  if (text.endsWith("\n")) {
    const lines = text.slice(0, -1).split("\n");
    const totalLines = lines.length * count;
    for (let i = 0; i < count; i++) {
      for (let j = lines.length - 1; j >= 0; j--) {
        buffer.insertLine(ctx.cursor.line + 1, lines[j]);
      }
    }
    const newCursor = { line: ctx.cursor.line + 1, col: 0 };
    return {
      newCtx: {
        ...resetContext(ctx),
        cursor: newCursor,
        statusMessage: totalLines >= 2 ? `${totalLines} more lines` : "",
      },
      actions: [
        { type: "content-change", content: buffer.getContent() },
        { type: "cursor-move", position: newCursor },
      ],
    };
  }

  // Character-wise paste
  const col = ctx.cursor.col + 1;
  for (let i = 0; i < count; i++) {
    buffer.insertAt(ctx.cursor.line, col, text);
  }
  const newCursor = {
    line: ctx.cursor.line,
    col: col + text.length * count - 1,
  };
  return {
    newCtx: { ...resetContext(ctx), cursor: newCursor },
    actions: [
      { type: "content-change", content: buffer.getContent() },
      { type: "cursor-move", position: newCursor },
    ],
  };
}

/**
 * P: Paste before the cursor
 */
function handlePasteBefore(ctx: VimContext, buffer: TextBuffer, count: number): KeystrokeResult {
  const text = getRegisterText(ctx);
  if (!text) return { newCtx: resetContext(ctx), actions: [] };

  buffer.saveUndoPoint(ctx.cursor);

  if (text.endsWith("\n")) {
    const lines = text.slice(0, -1).split("\n");
    const totalLines = lines.length * count;
    for (let i = 0; i < count; i++) {
      for (let j = lines.length - 1; j >= 0; j--) {
        buffer.insertLine(ctx.cursor.line, lines[j]);
      }
    }
    const newCursor = { line: ctx.cursor.line, col: 0 };
    return {
      newCtx: {
        ...resetContext(ctx),
        cursor: newCursor,
        statusMessage: totalLines >= 2 ? `${totalLines} more lines` : "",
      },
      actions: [
        { type: "content-change", content: buffer.getContent() },
        { type: "cursor-move", position: newCursor },
      ],
    };
  }

  for (let i = 0; i < count; i++) {
    buffer.insertAt(ctx.cursor.line, ctx.cursor.col, text);
  }
  const newCursor = {
    line: ctx.cursor.line,
    col: ctx.cursor.col + text.length * count - 1,
  };
  return {
    newCtx: { ...resetContext(ctx), cursor: newCursor },
    actions: [
      { type: "content-change", content: buffer.getContent() },
      { type: "cursor-move", position: newCursor },
    ],
  };
}

/**
 * u: undo
 */
function handleUndo(ctx: VimContext, buffer: TextBuffer): KeystrokeResult {
  const linesBefore = buffer.getLineCount();
  const restored = buffer.undo(ctx.cursor);

  if (restored) {
    const linesAfter = buffer.getLineCount();
    const diff = linesAfter - linesBefore;
    let statusMessage = "";
    if (diff >= 2) {
      statusMessage = `${diff} more lines`;
    } else if (diff <= -2) {
      statusMessage = `${Math.abs(diff)} fewer lines`;
    }

    return {
      newCtx: { ...resetContext(ctx), cursor: restored, statusMessage },
      actions: [
        { type: "content-change", content: buffer.getContent() },
        { type: "cursor-move", position: restored },
      ],
    };
  }

  return {
    newCtx: { ...ctx, count: 0, statusMessage: "Already at oldest change" },
    actions: [{ type: "status-message", message: "Already at oldest change" }],
  };
}

/**
 * Transition to command-line / search mode
 */
function enterCommandLine(type: ":" | "/" | "?", ctx: VimContext): KeystrokeResult {
  return {
    newCtx: {
      ...ctx,
      mode: "command-line",
      commandType: type,
      commandBuffer: "",
      statusMessage: type,
      ...(type !== ":" && {
        searchDirection: type === "/" ? ("forward" as const) : ("backward" as const),
      }),
    },
    actions: [{ type: "mode-change", mode: "command-line" }],
  };
}

/**
 * n / N: Repeat the last search
 */
/**
 * * / #: Search for the word under the cursor.
 * * searches forward, # searches backward.
 */
function handleWordSearch(key: string, ctx: VimContext, buffer: TextBuffer): KeystrokeResult {
  const line = buffer.getLine(ctx.cursor.line);
  const word = getWordUnderCursor(line, ctx.cursor.col);

  if (!word) {
    return { newCtx: resetContext(ctx), actions: [] };
  }

  // Use \b word boundaries for whole-word matching
  const pattern = `\\b${escapeRegExp(word)}\\b`;
  const direction = key === "*" ? "forward" : "backward";

  const found = searchInBuffer(buffer, pattern, ctx.cursor, direction);

  if (found) {
    return {
      newCtx: {
        ...resetContext(ctx),
        cursor: found,
        lastSearch: pattern,
        searchDirection: direction === "forward" ? "forward" : "backward",
      },
      actions: [{ type: "cursor-move", position: found }],
    };
  }

  return {
    newCtx: {
      ...resetContext(ctx),
      statusMessage: `Pattern not found: ${pattern}`,
    },
    actions: [{ type: "status-message", message: `Pattern not found: ${pattern}` }],
  };
}

/**
 * Extract the word under the cursor position.
 */
function getWordUnderCursor(line: string, col: number): string | null {
  if (col >= line.length) return null;

  // Check if cursor is on a word character
  if (!/\w/.test(line[col])) return null;

  // Expand left
  let start = col;
  while (start > 0 && /\w/.test(line[start - 1])) start--;

  // Expand right
  let end = col;
  while (end < line.length - 1 && /\w/.test(line[end + 1])) end++;

  return line.slice(start, end + 1);
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function handleSearchRepeat(key: string, ctx: VimContext, buffer: TextBuffer): KeystrokeResult {
  if (!ctx.lastSearch) {
    return { newCtx: ctx, actions: [] };
  }

  // N reverses the search direction
  const direction =
    key === "n"
      ? ctx.searchDirection
      : ctx.searchDirection === "forward"
        ? ("backward" as const)
        : ("forward" as const);

  const found = searchInBuffer(buffer, ctx.lastSearch, ctx.cursor, direction);

  if (found) {
    return {
      newCtx: { ...resetContext(ctx), cursor: found },
      actions: [{ type: "cursor-move", position: found }],
    };
  }

  return {
    newCtx: {
      ...ctx,
      count: 0,
      statusMessage: `Pattern not found: ${ctx.lastSearch}`,
    },
    actions: [
      {
        type: "status-message",
        message: `Pattern not found: ${ctx.lastSearch}`,
      },
    ],
  };
}

/**
 * Resolve the motion for a ; or , repeat of last f/F/t/T.
 */
function resolveCharSearchRepeat(key: string, ctx: VimContext, buffer: TextBuffer) {
  if (!ctx.lastCharSearch) return null;

  const count = getEffectiveCount(ctx);
  const { command, char } = ctx.lastCharSearch;
  const reverseMap: Record<string, "f" | "F" | "t" | "T"> = {
    f: "F",
    F: "f",
    t: "T",
    T: "t",
  };
  const effectiveCommand = key === "," ? reverseMap[command] : command;

  switch (effectiveCommand) {
    case "f":
      return motionFChar(ctx.cursor, buffer, char, count);
    case "F":
      return motionFCharBack(ctx.cursor, buffer, char, count);
    case "t":
      return motionTChar(ctx.cursor, buffer, char, count);
    case "T":
      return motionTCharBack(ctx.cursor, buffer, char, count);
  }
}

/**
 * ; / ,: Repeat last f/F/t/T search
 * ; repeats in the same direction, , repeats in the opposite direction.
 */
function handleCharSearchRepeat(key: string, ctx: VimContext, buffer: TextBuffer): KeystrokeResult {
  const motion = resolveCharSearchRepeat(key, ctx, buffer);

  if (!motion || (motion.cursor.line === ctx.cursor.line && motion.cursor.col === ctx.cursor.col)) {
    return { newCtx: resetContext(ctx), actions: [] };
  }

  return {
    newCtx: {
      ...resetContext(ctx),
      cursor: motion.cursor,
    },
    actions: [{ type: "cursor-move", position: motion.cursor }],
  };
}

/**
 * J: Join the current line with the next line
 */
/**
 * m{a-z}: Set a mark at the current cursor position.
 */
function handleMarkPending(key: string, ctx: VimContext): KeystrokeResult {
  if (/^[a-z]$/.test(key)) {
    return {
      newCtx: {
        ...resetContext(ctx),
        marks: {
          ...ctx.marks,
          [key]: { ...ctx.cursor },
        },
      },
      actions: [],
    };
  }
  return { newCtx: resetContext(ctx), actions: [] };
}

/**
 * `{a-z} or '{a-z}: Jump to a mark.
 * ` jumps to exact position, ' jumps to the line's first non-blank character.
 */
function handleJumpMarkPending(key: string, ctx: VimContext, buffer: TextBuffer): KeystrokeResult {
  if (/^[a-z]$/.test(key) && ctx.marks[key]) {
    const mark = ctx.marks[key];
    // Clamp to buffer bounds
    const line = Math.min(mark.line, buffer.getLineCount() - 1);
    const maxCol = Math.max(0, buffer.getLineLength(line) - 1);
    const newCursor = { line, col: Math.min(mark.col, maxCol) };

    return {
      newCtx: {
        ...resetContext(ctx),
        cursor: newCursor,
      },
      actions: [{ type: "cursor-move", position: newCursor }],
    };
  }

  if (/^[a-z]$/.test(key) && !ctx.marks[key]) {
    return {
      newCtx: {
        ...resetContext(ctx),
        statusMessage: `Mark '${key}' not set`,
      },
      actions: [{ type: "status-message", message: `Mark '${key}' not set` }],
    };
  }

  return { newCtx: resetContext(ctx), actions: [] };
}

function getLeadingWhitespace(line: string): string {
  const match = line.match(/^(\s*)/);
  return match ? match[1] : "";
}

function handleJoinLines(ctx: VimContext, buffer: TextBuffer): KeystrokeResult {
  if (ctx.cursor.line >= buffer.getLineCount() - 1) {
    return { newCtx: ctx, actions: [] };
  }

  buffer.saveUndoPoint(ctx.cursor);

  const currentLen = buffer.getLineLength(ctx.cursor.line);
  const nextLine = buffer.getLine(ctx.cursor.line + 1).trimStart();

  buffer.setLine(ctx.cursor.line, buffer.getLine(ctx.cursor.line) + " " + nextLine);
  buffer.deleteLines(ctx.cursor.line + 1, 1);

  const newCursor = { line: ctx.cursor.line, col: currentLen };

  return {
    newCtx: { ...resetContext(ctx), cursor: newCursor },
    actions: [
      { type: "content-change", content: buffer.getContent() },
      { type: "cursor-move", position: newCursor },
    ],
  };
}
