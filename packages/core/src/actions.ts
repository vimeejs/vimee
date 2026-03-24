/**
 * actions.ts
 *
 * Helper functions for creating VimAction values.
 * Designed for use in custom keybind callbacks to reduce boilerplate
 * and ensure type safety.
 *
 * @example
 * ```ts
 * import { actions } from "@vimee/core";
 *
 * addKeybind("normal", "\\r", {
 *   execute: (ctx, buffer) => [
 *     actions.statusMessage("Formatted!"),
 *   ],
 * });
 * ```
 */

import type { CursorPosition, VimMode, VimAction, VimContext } from "./types";

/**
 * Create a cursor-move action with an absolute position.
 */
export function cursorMove(position: CursorPosition): VimAction {
  return { type: "cursor-move", position };
}

/**
 * Create a cursor-move action relative to the current cursor position.
 * Positive values move down/right, negative values move up/left.
 */
export function cursorRelative(
  ctx: Readonly<VimContext>,
  deltaLine: number,
  deltaCol: number = 0,
): VimAction {
  return {
    type: "cursor-move",
    position: {
      line: Math.max(0, ctx.cursor.line + deltaLine),
      col: Math.max(0, ctx.cursor.col + deltaCol),
    },
  };
}

/**
 * Create a mode-change action.
 */
export function modeChange(mode: VimMode): VimAction {
  return { type: "mode-change", mode };
}

/**
 * Create a content-change action with new buffer content.
 */
export function contentChange(content: string): VimAction {
  return { type: "content-change", content };
}

/**
 * Create a status-message action.
 */
export function statusMessage(message: string): VimAction {
  return { type: "status-message", message };
}

/**
 * Create a register-write action to store text in a named register.
 */
export function registerWrite(register: string, text: string): VimAction {
  return { type: "register-write", register, text };
}

/**
 * Create a mark-set action to store a cursor position as a mark.
 */
export function markSet(name: string, position: CursorPosition): VimAction {
  return { type: "mark-set", name, position };
}

/**
 * Create a yank action (notifies the host about yanked text).
 */
export function yank(text: string): VimAction {
  return { type: "yank", text };
}

/**
 * Create a quit action (signals the host to close/quit).
 */
export function quit(force: boolean = false): VimAction {
  return { type: "quit", force };
}

/**
 * Create a noop action (explicitly does nothing).
 */
export function noop(): VimAction {
  return { type: "noop" };
}

/**
 * Collection of all action helpers for convenient import.
 *
 * @example
 * ```ts
 * import { actions } from "@vimee/core";
 * return [actions.modeChange("normal"), actions.statusMessage("Done")];
 * ```
 */
export const actions = {
  cursorMove,
  cursorRelative,
  modeChange,
  contentChange,
  statusMessage,
  registerWrite,
  markSet,
  yank,
  quit,
  noop,
} as const;
