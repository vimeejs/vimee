/**
 * insert-mode.ts
 *
 * Insert mode keystroke processing.
 *
 * Insert mode handles normal text input:
 * - Character input: Insert a character into the buffer
 * - Backspace: Delete the previous character (join with previous line at line start)
 * - Delete: Delete the next character (join with next line at line end)
 * - Enter: Split the line and create a new line
 * - Tab: Insert two spaces (TODO: make indent width configurable)
 * - Escape: Return to normal mode
 */

import type { VimContext } from "./types";
import type { TextBuffer } from "./buffer";
import type { KeystrokeResult } from "./key-utils";

/**
 * Main handler for insert mode.
 */
export function processInsertMode(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
  ctrlKey: boolean,
): KeystrokeResult {
  // --- Escape -> return to normal mode ---
  if (key === "Escape") {
    return handleEscape(ctx, buffer);
  }

  // --- Ctrl key combinations ---
  if (ctrlKey) {
    if (key === "w") {
      return handleCtrlW(ctx, buffer);
    }
    return { newCtx: ctx, actions: [] };
  }

  // --- Backspace ---
  if (key === "Backspace") {
    return handleBackspace(ctx, buffer);
  }

  // --- Delete ---
  if (key === "Delete") {
    return handleDelete(ctx, buffer);
  }

  // --- Enter ---
  if (key === "Enter") {
    return handleEnter(ctx, buffer);
  }

  // --- Tab ---
  if (key === "Tab") {
    return handleTab(ctx, buffer);
  }

  // --- Normal character input ---
  if (key.length === 1) {
    return handleCharInput(key, ctx, buffer);
  }

  // --- Other keys (arrow keys, etc.) are ignored ---
  return { newCtx: ctx, actions: [] };
}

/**
 * Escape: Transition from insert mode to normal mode.
 * Move the cursor one position to the left (Vim behavior).
 *
 * If blockInsert is set (from visual-block I/A), replicate the typed
 * text to all other lines in the block before returning to normal.
 */
function handleEscape(ctx: VimContext, buffer: TextBuffer): KeystrokeResult {
  const actions: import("./types").VimAction[] = [];

  // Handle visual-block insert replication
  if (ctx.blockInsert) {
    const { startLine, endLine, col, cursorAtInsertStart } = ctx.blockInsert;

    // Figure out what text was typed by reading the first line
    // from the original insert column to the current cursor position
    const firstLine = buffer.getLine(cursorAtInsertStart.line);
    const insertedText = firstLine.slice(col, ctx.cursor.col);

    if (insertedText.length > 0) {
      // Save undo point so the entire block replication can be undone at once
      buffer.saveUndoPoint(ctx.cursor);

      // Insert the same text at the same column on the remaining lines
      for (let l = startLine; l <= endLine; l++) {
        if (l === cursorAtInsertStart.line) continue;
        const line = buffer.getLine(l);
        // Pad with spaces if the line is shorter than the insert column
        const padded = line.length < col
          ? line + " ".repeat(col - line.length)
          : line;
        buffer.setLine(l, padded.slice(0, col) + insertedText + padded.slice(col));
      }
      actions.push({ type: "content-change", content: buffer.getContent() });
    }
  }

  const col = Math.max(0, ctx.cursor.col - 1);
  const newCursor = { line: ctx.cursor.line, col };

  actions.push(
    { type: "cursor-move", position: newCursor },
    { type: "mode-change", mode: "normal" },
  );

  return {
    newCtx: {
      ...ctx,
      mode: "normal",
      phase: "idle",
      count: 0,
      operator: null,
      cursor: newCursor,
      blockInsert: null,
      statusMessage: "",
    },
    actions,
  };
}

/**
 * Backspace: Delete the character before the cursor.
 * At the beginning of a line, join with the previous line.
 */
function handleBackspace(
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  // At the beginning of a line
  if (ctx.cursor.col === 0) {
    // Do nothing at the start of the first line
    if (ctx.cursor.line === 0) {
      return { newCtx: ctx, actions: [] };
    }

    // Join with the previous line
    const prevLineLen = buffer.getLineLength(ctx.cursor.line - 1);
    buffer.joinLines(ctx.cursor.line - 1);
    const newCursor = { line: ctx.cursor.line - 1, col: prevLineLen };

    return {
      newCtx: { ...ctx, cursor: newCursor },
      actions: [
        { type: "content-change", content: buffer.getContent() },
        { type: "cursor-move", position: newCursor },
      ],
    };
  }

  // Normal Backspace: delete one character
  buffer.deleteAt(ctx.cursor.line, ctx.cursor.col - 1);
  const newCursor = { line: ctx.cursor.line, col: ctx.cursor.col - 1 };

  return {
    newCtx: { ...ctx, cursor: newCursor },
    actions: [
      { type: "content-change", content: buffer.getContent() },
      { type: "cursor-move", position: newCursor },
    ],
  };
}

/**
 * Delete: Delete the character at the cursor position.
 * At the end of a line, join with the next line.
 */
function handleDelete(
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  // At the end of a line
  if (ctx.cursor.col >= buffer.getLineLength(ctx.cursor.line)) {
    // Do nothing at the end of the last line
    if (ctx.cursor.line >= buffer.getLineCount() - 1) {
      return { newCtx: ctx, actions: [] };
    }

    // Join with the next line
    buffer.joinLines(ctx.cursor.line);
  } else {
    // Normal Delete: delete one character
    buffer.deleteAt(ctx.cursor.line, ctx.cursor.col);
  }

  return {
    newCtx: ctx,
    actions: [{ type: "content-change", content: buffer.getContent() }],
  };
}

/**
 * Enter: Split the line at the current cursor position.
 * Preserves the indentation of the current line.
 */
function handleEnter(
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  const indent = getLineIndent(buffer.getLine(ctx.cursor.line));
  buffer.splitLine(ctx.cursor.line, ctx.cursor.col);
  if (indent) {
    const newLine = ctx.cursor.line + 1;
    buffer.setLine(newLine, indent + buffer.getLine(newLine));
  }
  const newCursor = { line: ctx.cursor.line + 1, col: indent.length };

  return {
    newCtx: { ...ctx, cursor: newCursor },
    actions: [
      { type: "content-change", content: buffer.getContent() },
      { type: "cursor-move", position: newCursor },
    ],
  };
}

/**
 * Tab: Insert indentation based on context settings.
 */
function handleTab(
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  const indent =
    ctx.indentStyle === "tab" ? "\t" : " ".repeat(ctx.indentWidth);
  buffer.insertAt(ctx.cursor.line, ctx.cursor.col, indent);
  const newCursor = {
    line: ctx.cursor.line,
    col: ctx.cursor.col + indent.length,
  };

  return {
    newCtx: { ...ctx, cursor: newCursor },
    actions: [
      { type: "content-change", content: buffer.getContent() },
      { type: "cursor-move", position: newCursor },
    ],
  };
}

/**
 * Ctrl-W: Delete the word before the cursor.
 */
function handleCtrlW(
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  if (ctx.cursor.col === 0) {
    return { newCtx: ctx, actions: [] };
  }

  const line = buffer.getLine(ctx.cursor.line);
  let col = ctx.cursor.col;

  // Skip whitespace backward
  while (col > 0 && (line[col - 1] === " " || line[col - 1] === "\t")) col--;
  // Skip word characters backward
  if (col > 0 && /\w/.test(line[col - 1])) {
    while (col > 0 && /\w/.test(line[col - 1])) col--;
  } else if (col > 0) {
    // Skip non-word, non-whitespace characters backward
    while (col > 0 && !/\w/.test(line[col - 1]) && line[col - 1] !== " " && line[col - 1] !== "\t") col--;
  }

  const newLine = line.slice(0, col) + line.slice(ctx.cursor.col);
  buffer.setLine(ctx.cursor.line, newLine);
  const newCursor = { line: ctx.cursor.line, col };

  return {
    newCtx: { ...ctx, cursor: newCursor },
    actions: [
      { type: "content-change", content: buffer.getContent() },
      { type: "cursor-move", position: newCursor },
    ],
  };
}

/**
 * Extract the leading whitespace from a line.
 */
function getLineIndent(line: string): string {
  const match = line.match(/^(\s*)/);
  return match ? match[1] : "";
}

/**
 * Normal character input: Insert one character at the cursor position.
 */
function handleCharInput(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  buffer.insertAt(ctx.cursor.line, ctx.cursor.col, key);
  const newCursor = {
    line: ctx.cursor.line,
    col: ctx.cursor.col + 1,
  };

  return {
    newCtx: { ...ctx, cursor: newCursor },
    actions: [
      { type: "content-change", content: buffer.getContent() },
      { type: "cursor-move", position: newCursor },
    ],
  };
}
