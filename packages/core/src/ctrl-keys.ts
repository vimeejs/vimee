/**
 * ctrl-keys.ts
 *
 * Processing of Ctrl key combination commands.
 * - Ctrl-R: Redo
 * - Ctrl-B: Scroll full page up
 * - Ctrl-F: Scroll full page down
 * - Ctrl-U: Scroll half page up
 * - Ctrl-D: Scroll half page down
 */

import type { VimContext, VimAction } from "./types";
import type { TextBuffer } from "./buffer";
import type { KeystrokeResult } from "./key-utils";

/**
 * Handle Ctrl key combinations.
 * Common processing called from both normal mode and visual mode.
 */
export function handleCtrlKey(
  key: string,
  ctx: VimContext,
  buffer: TextBuffer,
  readOnly: boolean = false,
): KeystrokeResult {
  switch (key) {
    case "r":
      // readOnly: block redo
      if (readOnly) return { newCtx: ctx, actions: [] };
      return handleCtrlR(ctx, buffer);
    case "b":
      return handleCtrlB(ctx);
    case "f":
      return handleCtrlF(ctx);
    case "u":
      return handleCtrlU(ctx);
    case "d":
      return handleCtrlD(ctx);
    case "v":
      return handleCtrlV(ctx);
    default:
      return { newCtx: ctx, actions: [] };
  }
}

/**
 * Ctrl-R: Redo
 * Reverses the last undo.
 */
function handleCtrlR(
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  const linesBefore = buffer.getLineCount();
  const restored = buffer.redo(ctx.cursor);

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
      newCtx: { ...ctx, cursor: restored, count: 0, statusMessage },
      actions: [
        { type: "content-change", content: buffer.getContent() },
        { type: "cursor-move", position: restored },
      ],
    };
  }

  return {
    newCtx: { ...ctx, count: 0, statusMessage: "Already at newest change" },
    actions: [
      { type: "status-message", message: "Already at newest change" },
    ],
  };
}

/**
 * Ctrl-B: Scroll full page up
 */
function handleCtrlB(ctx: VimContext): KeystrokeResult {
  return {
    newCtx: { ...ctx, count: 0, statusMessage: "" },
    actions: [{ type: "scroll", direction: "up", amount: 1.0 }],
  };
}

/**
 * Ctrl-F: Scroll full page down
 */
function handleCtrlF(ctx: VimContext): KeystrokeResult {
  return {
    newCtx: { ...ctx, count: 0, statusMessage: "" },
    actions: [{ type: "scroll", direction: "down", amount: 1.0 }],
  };
}

/**
 * Ctrl-U: Scroll half page up
 * The actual scroll amount is calculated on the component side.
 */
function handleCtrlU(ctx: VimContext): KeystrokeResult {
  return {
    newCtx: { ...ctx, count: 0, statusMessage: "" },
    actions: [{ type: "scroll", direction: "up", amount: 0.5 }],
  };
}

/**
 * Ctrl-D: Scroll half page down
 */
function handleCtrlD(ctx: VimContext): KeystrokeResult {
  return {
    newCtx: { ...ctx, count: 0, statusMessage: "" },
    actions: [{ type: "scroll", direction: "down", amount: 0.5 }],
  };
}

/**
 * Ctrl-V: Enter visual-block mode (or toggle if already in visual)
 */
function handleCtrlV(ctx: VimContext): KeystrokeResult {
  if (ctx.mode === "visual-block") {
    // Toggle off -> normal
    return {
      newCtx: {
        ...ctx,
        mode: "normal",
        phase: "idle",
        count: 0,
        visualAnchor: null,
        statusMessage: "",
      },
      actions: [{ type: "mode-change", mode: "normal" }],
    };
  }

  // Enter visual-block (from normal, visual, or visual-line)
  const anchor =
    ctx.mode === "visual" || ctx.mode === "visual-line"
      ? ctx.visualAnchor ?? { ...ctx.cursor }
      : { ...ctx.cursor };

  return {
    newCtx: {
      ...ctx,
      mode: "visual-block",
      phase: "idle",
      count: 0,
      visualAnchor: anchor,
      statusMessage: "-- VISUAL BLOCK --",
    },
    actions: [{ type: "mode-change", mode: "visual-block" }],
  };
}
