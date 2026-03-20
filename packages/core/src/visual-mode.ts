/**
 * visual-mode.ts
 *
 * Visual mode (v, V) keystroke processing.
 *
 * In visual mode:
 * - The range is defined by the anchor (selection start) and cursor (selection end)
 * - Motions move the cursor, expanding/shrinking the selection
 * - Operators (d, y, c, x) act on the selected range
 * - Escape returns to normal mode
 * - v / V toggles between selection modes
 *
 * visual:      Character-wise selection
 * visual-line: Line-wise selection
 */

import type { CursorPosition, VimContext, Operator } from "./types";
import type { TextBuffer } from "./buffer";
import type { MotionResult, MotionRange } from "./motions";
import type { KeystrokeResult } from "./key-utils";
import {
  isCountKey,
  getEffectiveCount,
  isCountExplicit,
  resetContext,
} from "./key-utils";
import { handleCtrlKey } from "./ctrl-keys";
import { resolveMotion } from "./motion-resolver";
import { executeOperatorOnRange } from "./operators";
import { motionGG } from "./motions";
import { resolveTextObject } from "./text-objects";

/**
 * Main handler for visual mode.
 */
export function processVisualMode(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
  ctrlKey: boolean,
  readOnly: boolean = false,
): KeystrokeResult {
  // --- Escape -> return to normal mode ---
  if (key === "Escape") {
    return exitVisualMode(ctx);
  }

  // --- g-pending ---
  if (ctx.phase === "g-pending") {
    return handleGPendingInVisual(key, ctx, buffer);
  }

  // --- Text object pending (viw, va", etc.) ---
  if (ctx.phase === "text-object-pending" && ctx.textObjectModifier) {
    const range = resolveTextObject(ctx.textObjectModifier, key, ctx.cursor, buffer);
    if (range) {
      return {
        newCtx: {
          ...ctx,
          phase: "idle",
          textObjectModifier: null,
          visualAnchor: range.start,
          cursor: range.end,
          count: 0,
        },
        actions: [{ type: "cursor-move", position: range.end }],
      };
    }
    return {
      newCtx: { ...ctx, phase: "idle", textObjectModifier: null, count: 0 },
      actions: [],
    };
  }

  // --- Register pending ---
  if (ctx.phase === "register-pending") {
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
    return {
      newCtx: { ...ctx, phase: "idle", count: 0 },
      actions: [],
    };
  }

  // --- Ctrl key ---
  if (ctrlKey) {
    return handleCtrlKey(key, ctx, buffer);
  }

  // --- Count ---
  if (isCountKey(key, ctx)) {
    return {
      newCtx: { ...ctx, count: ctx.count * 10 + Number.parseInt(key, 10) },
      actions: [],
    };
  }

  // --- Motion ---
  const count = getEffectiveCount(ctx);
  const countExplicit = isCountExplicit(ctx);
  const motion = resolveMotion(key, ctx.cursor, buffer, count, countExplicit, ctx);
  if (motion) {
    return {
      newCtx: {
        ...ctx,
        cursor: motion.cursor,
        count: 0,
      },
      actions: [{ type: "cursor-move", position: motion.cursor }],
    };
  }

  // --- g prefix ---
  if (key === "g") {
    return {
      newCtx: { ...ctx, phase: "g-pending" },
      actions: [],
    };
  }

  // --- Register prefix ("x) ---
  if (key === '"') {
    return {
      newCtx: { ...ctx, phase: "register-pending" },
      actions: [],
    };
  }

  // --- Text object entry (viw, va", etc.) ---
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

  // --- Visual-block I/A: insert at block column ---
  if (ctx.mode === "visual-block" && (key === "I" || key === "A") && ctx.visualAnchor) {
    if (readOnly) return { newCtx: ctx, actions: [] };
    return enterBlockInsert(key, ctx);
  }

  // --- Operator execution ---
  if (key === "d" || key === "x" || key === "y" || key === "c") {
    // readOnly: block delete/change (y is allowed)
    if (readOnly && key !== "y") {
      return { newCtx: ctx, actions: [] };
    }
    return executeVisualOperator(key, ctx, buffer);
  }

  // --- Mode switch ---
  if (key === "v") {
    return ctx.mode === "visual"
      ? exitVisualMode(ctx)
      : switchVisualSubMode(ctx, "visual");
  }
  if (key === "V") {
    return ctx.mode === "visual-line"
      ? exitVisualMode(ctx)
      : switchVisualSubMode(ctx, "visual-line");
  }

  // --- o: swap anchor and cursor ---
  if (key === "o") {
    if (ctx.visualAnchor) {
      return {
        newCtx: {
          ...ctx,
          cursor: ctx.visualAnchor,
          visualAnchor: ctx.cursor,
        },
        actions: [{ type: "cursor-move", position: ctx.visualAnchor }],
      };
    }
  }

  return { newCtx: ctx, actions: [] };
}

/**
 * Exit visual mode and return to normal mode.
 */
function exitVisualMode(ctx: VimContext): KeystrokeResult {
  return {
    newCtx: {
      ...resetContext(ctx),
      mode: "normal",
      visualAnchor: null,
    },
    actions: [{ type: "mode-change", mode: "normal" }],
  };
}

/**
 * Switch between visual sub-modes (visual <-> visual-line).
 */
function switchVisualSubMode(
  ctx: VimContext,
  mode: "visual" | "visual-line" | "visual-block",
): KeystrokeResult {
  const statusMessages: Record<string, string> = {
    visual: "-- VISUAL --",
    "visual-line": "-- VISUAL LINE --",
    "visual-block": "-- VISUAL BLOCK --",
  };
  const statusMessage = statusMessages[mode];

  return {
    newCtx: { ...ctx, mode, statusMessage },
    actions: [{ type: "mode-change", mode }],
  };
}

/**
 * Handle g prefix (gg)
 */
function handleGPendingInVisual(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  if (key === "g") {
    const count = ctx.count > 0 ? ctx.count : null;
    const result = motionGG(ctx.cursor, buffer, count);
    return {
      newCtx: {
        ...ctx,
        phase: "idle",
        count: 0,
        cursor: result.cursor,
      },
      actions: [{ type: "cursor-move", position: result.cursor }],
    };
  }

  // Unknown g command -> reset
  return {
    newCtx: { ...ctx, phase: "idle", count: 0 },
    actions: [],
  };
}

/**
 * Execute an operator on the visual selection range.
 *
 * d / x: Delete
 * y: Yank
 * c: Change (delete and enter insert mode)
 */
function executeVisualOperator(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  if (!ctx.visualAnchor) {
    return { newCtx: ctx, actions: [] };
  }

  buffer.saveUndoPoint(ctx.cursor);

  // x behaves the same as d
  const operator: Operator = key === "x" ? "d" : (key as Operator);

  if (ctx.mode === "visual-block") {
    return executeVisualBlockOperator(operator, ctx, buffer);
  }

  // Normalize the selection range (start <= end)
  const { start, end } = normalizeSelection(ctx.visualAnchor, ctx.cursor);
  const isLinewise = ctx.mode === "visual-line";

  const range: MotionRange = {
    start,
    end: isLinewise ? { line: end.line, col: 0 } : end,
    linewise: isLinewise,
    inclusive: true,
  };

  const result = executeOperatorOnRange(operator, range, buffer, ctx.cursor, {
    style: ctx.indentStyle,
    width: ctx.indentWidth,
  });

  // Build status message with register name
  let statusMessage = result.statusMessage || "";
  if (result.newMode === "insert") {
    statusMessage = "-- INSERT --";
  } else if (ctx.selectedRegister && statusMessage) {
    statusMessage += ` into "${ctx.selectedRegister}`;
  } else if (ctx.selectedRegister && result.yankedText) {
    const lines = result.yankedText.split("\n").length - (result.yankedText.endsWith("\n") ? 1 : 0);
    if (lines >= 1 && operator === "y") {
      statusMessage = lines >= 2
        ? `${lines} lines yanked into "${ctx.selectedRegister}`
        : `yanked into "${ctx.selectedRegister}`;
    }
  }

  // Store in named register if selected
  const registerUpdates: Partial<import("./types").VimContext> = {
    register: result.yankedText,
  };
  if (ctx.selectedRegister) {
    registerUpdates.registers = {
      ...ctx.registers,
      [ctx.selectedRegister]: result.yankedText,
    };
  }

  return {
    newCtx: {
      ...resetContext(ctx),
      mode: result.newMode,
      cursor: result.newCursor,
      ...registerUpdates,
      visualAnchor: null,
      statusMessage,
    },
    actions: [
      ...result.actions,
      { type: "cursor-move", position: result.newCursor },
      { type: "mode-change", mode: result.newMode },
    ],
  };
}

/**
 * Enter insert mode from visual-block with I or A.
 * I inserts at the left edge of the block, A appends at the right edge.
 * The blockInsert info is stored so that on Escape, the typed text
 * is replicated to all lines in the block.
 */
function enterBlockInsert(
  key: string,
  ctx: VimContext,
): KeystrokeResult {
  const anchor = ctx.visualAnchor!;
  const startLine = Math.min(anchor.line, ctx.cursor.line);
  const endLine = Math.max(anchor.line, ctx.cursor.line);
  const leftCol = Math.min(anchor.col, ctx.cursor.col);
  const rightCol = Math.max(anchor.col, ctx.cursor.col);

  const col = key === "I" ? leftCol : rightCol + 1;
  const newCursor = { line: startLine, col };

  return {
    newCtx: {
      ...ctx,
      mode: "insert",
      phase: "idle",
      count: 0,
      visualAnchor: null,
      cursor: newCursor,
      statusMessage: "-- INSERT --",
      blockInsert: {
        startLine,
        endLine,
        col,
        cursorAtInsertStart: { ...newCursor },
      },
    },
    actions: [
      { type: "cursor-move", position: newCursor },
      { type: "mode-change", mode: "insert" },
    ],
  };
}

/**
 * Execute an operator on a visual-block (rectangular) selection.
 * Operates column-by-column on each line in the block.
 */
function executeVisualBlockOperator(
  operator: Operator,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  const anchor = ctx.visualAnchor!;
  const startLine = Math.min(anchor.line, ctx.cursor.line);
  const endLine = Math.max(anchor.line, ctx.cursor.line);
  const startCol = Math.min(anchor.col, ctx.cursor.col);
  const endCol = Math.max(anchor.col, ctx.cursor.col);

  // Collect yanked text (each line's block portion, joined by newlines)
  const yankLines: string[] = [];
  for (let l = startLine; l <= endLine; l++) {
    const line = buffer.getLine(l);
    yankLines.push(line.slice(startCol, endCol + 1));
  }
  const yankedText = yankLines.join("\n");

  const actions: import("./types").VimAction[] = [
    { type: "yank", text: yankedText },
  ];

  // Named register support
  const regUpdates: Partial<import("./types").VimContext> = {
    register: yankedText,
  };
  if (ctx.selectedRegister) {
    regUpdates.registers = {
      ...ctx.registers,
      [ctx.selectedRegister]: yankedText,
    };
  }

  if (operator === "y") {
    const newCursor = { line: startLine, col: startCol };
    const regSuffix = ctx.selectedRegister ? ` into "${ctx.selectedRegister}` : "";
    const lineCount = endLine - startLine + 1;
    return {
      newCtx: {
        ...resetContext(ctx),
        mode: "normal",
        cursor: newCursor,
        ...regUpdates,
        visualAnchor: null,
        statusMessage: lineCount >= 2 ? `${lineCount} lines yanked${regSuffix}` : regSuffix ? `yanked${regSuffix}` : "",
      },
      actions: [
        ...actions,
        { type: "cursor-move", position: newCursor },
        { type: "mode-change", mode: "normal" },
      ],
    };
  }

  // d / c: delete the block region from each line
  for (let l = endLine; l >= startLine; l--) {
    const line = buffer.getLine(l);
    const before = line.slice(0, startCol);
    const after = line.slice(endCol + 1);
    buffer.setLine(l, before + after);
  }

  actions.push({ type: "content-change", content: buffer.getContent() });

  const newCursor = { line: startLine, col: startCol };
  const newMode = operator === "c" ? "insert" : "normal";

  return {
    newCtx: {
      ...resetContext(ctx),
      mode: newMode as import("./types").VimMode,
      cursor: newCursor,
      ...regUpdates,
      visualAnchor: null,
      statusMessage: newMode === "insert" ? "-- INSERT --" : "",
    },
    actions: [
      ...actions,
      { type: "cursor-move", position: newCursor },
      { type: "mode-change", mode: newMode as import("./types").VimMode },
    ],
  };
}

/**
 * Normalize two cursor positions so that start <= end.
 */
function normalizeSelection(
  a: CursorPosition,
  b: CursorPosition,
): { start: CursorPosition; end: CursorPosition } {
  if (a.line < b.line || (a.line === b.line && a.col <= b.col)) {
    return { start: a, end: b };
  }
  return { start: b, end: a };
}
