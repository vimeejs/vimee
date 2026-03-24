/**
 * apply-actions.ts
 *
 * Shared helper for applying VimAction arrays to VimContext.
 * Used by both custom keybind callbacks and user-defined ex commands.
 */

import type { VimContext, VimAction } from "./types";
import type { TextBuffer } from "./buffer";
import type { KeystrokeResult } from "./key-utils";

/**
 * Apply an array of VimActions to a VimContext and buffer.
 *
 * Handles:
 * - cursor-move: updates ctx.cursor
 * - mode-change: updates ctx.mode and resets phase to idle
 * - content-change: mutates buffer via replaceContent
 * - register-write: updates ctx.registers (and unnamed register)
 * - mark-set: updates ctx.marks
 * - status-message: updates ctx.statusMessage
 * - Other actions: passed through to the host
 */
export function applyUserActions(
  userActions: VimAction[],
  ctx: VimContext,
  buffer: TextBuffer,
): KeystrokeResult {
  let newCtx = { ...ctx };
  const emittedActions: VimAction[] = [];

  for (const action of userActions) {
    switch (action.type) {
      case "cursor-move":
        newCtx = { ...newCtx, cursor: action.position };
        emittedActions.push(action);
        break;
      case "mode-change":
        newCtx = {
          ...newCtx,
          mode: action.mode,
          phase: "idle",
          count: 0,
          operator: null,
          statusMessage:
            action.mode === "normal"
              ? ""
              : action.mode === "insert"
                ? "-- INSERT --"
                : newCtx.statusMessage,
        };
        emittedActions.push(action);
        break;
      case "content-change":
        buffer.replaceContent(action.content);
        emittedActions.push(action);
        break;
      case "register-write":
        newCtx = {
          ...newCtx,
          registers: { ...newCtx.registers, [action.register]: action.text },
        };
        if (action.register === '"' || action.register === "") {
          newCtx.register = action.text;
        }
        emittedActions.push(action);
        break;
      case "mark-set":
        newCtx = {
          ...newCtx,
          marks: { ...newCtx.marks, [action.name]: action.position },
        };
        emittedActions.push(action);
        break;
      case "status-message":
        newCtx = { ...newCtx, statusMessage: action.message, statusError: false };
        emittedActions.push(action);
        break;
      default:
        // yank, save, scroll, set-option, quit, noop → pass through
        emittedActions.push(action);
        break;
    }
  }

  return { newCtx, actions: emittedActions };
}
