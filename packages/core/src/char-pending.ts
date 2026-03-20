/**
 * char-pending.ts
 *
 * Handler for character-pending commands (f, F, t, T, r).
 *
 * These commands wait for the next character after being pressed:
 * - f{char}: Search forward on the line for {char} and jump to it
 * - F{char}: Search backward on the line for {char} and jump to it
 * - t{char}: Search forward on the line and jump to just before {char}
 * - T{char}: Search backward on the line and jump to just after {char}
 * - r{char}: Replace the character under the cursor with {char}
 *
 * When in operator-pending state (e.g., df{char}),
 * the operator is applied to the motion range.
 */

import type { VimContext } from "./types";
import type { TextBuffer } from "./buffer";
import type { KeystrokeResult } from "./key-utils";
import { getEffectiveCount, resetContext } from "./key-utils";
import { executeOperatorOnRange } from "./operators";
import {
  motionFChar,
  motionFCharBack,
  motionTChar,
  motionTCharBack,
} from "./motions";

/**
 * Process key input for character-pending commands.
 * The pending command type is stored in ctx.charCommand.
 */
export function handleCharPending(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  const count = getEffectiveCount(ctx);

  // r (single character replace) is handled specially
  if (ctx.charCommand === "r") {
    return handleReplace(key, ctx, buffer);
  }

  // Resolve motion for f, F, t, T
  const motion = resolveCharMotion(ctx.charCommand!, key, ctx, buffer, count);

  if (!motion) {
    // Invalid character -> reset
    return {
      newCtx: resetContext(ctx),
      actions: [],
    };
  }

  const lastCharSearch = {
    command: ctx.charCommand as "f" | "F" | "t" | "T",
    char: key,
  };

  // If in operator-pending state (e.g., df{char})
  if (ctx.operator) {
    buffer.saveUndoPoint(ctx.cursor);
    const result = executeOperatorOnRange(
      ctx.operator,
      motion.range,
      buffer,
      ctx.cursor,
      { style: ctx.indentStyle, width: ctx.indentWidth },
    );

    return {
      newCtx: {
        ...resetContext(ctx),
        mode: result.newMode,
        cursor: result.newCursor,
        register: result.yankedText,
        lastCharSearch,
        statusMessage:
          result.newMode === "insert"
            ? "-- INSERT --"
            : result.statusMessage || "",
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

  // Simple motion
  return {
    newCtx: {
      ...resetContext(ctx),
      cursor: motion.cursor,
      lastCharSearch,
    },
    actions: [{ type: "cursor-move", position: motion.cursor }],
  };
}

/**
 * r{char}: Replace the single character under the cursor.
 * Does nothing if the line is empty.
 */
function handleReplace(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  if (buffer.getLineLength(ctx.cursor.line) === 0) {
    return {
      newCtx: resetContext(ctx),
      actions: [],
    };
  }

  buffer.saveUndoPoint(ctx.cursor);

  const lineText = buffer.getLine(ctx.cursor.line);
  const newLine =
    lineText.slice(0, ctx.cursor.col) +
    key +
    lineText.slice(ctx.cursor.col + 1);
  buffer.setLine(ctx.cursor.line, newLine);

  return {
    newCtx: resetContext(ctx),
    actions: [{ type: "content-change", content: buffer.getContent() }],
  };
}

/**
 * Resolve a motion result from the charCommand and the input character.
 */
function resolveCharMotion(
  command: string,
  char: string,
  ctx: VimContext,
  buffer: TextBuffer,
  count: number,
) {
  switch (command) {
    case "f":
      return motionFChar(ctx.cursor, buffer, char, count);
    case "F":
      return motionFCharBack(ctx.cursor, buffer, char, count);
    case "t":
      return motionTChar(ctx.cursor, buffer, char, count);
    case "T":
      return motionTCharBack(ctx.cursor, buffer, char, count);
    default:
      return null;
  }
}
