/**
 * key-utils.ts
 *
 * Utility functions for keystroke processing.
 * Includes count detection, operator detection, mode transition helpers, etc.
 */

import type { VimContext, VimAction, VimMode, Operator, CharCommand } from "./types";

/**
 * Result returned by keystroke processing functions.
 */
export interface KeystrokeResult {
  newCtx: VimContext;
  actions: VimAction[];
}

/**
 * Determine whether a key is a count input.
 * - 1-9 are always count keys
 * - 0 is a count key only when a count has already been entered (otherwise it moves to the beginning of the line)
 */
export function isCountKey(key: string, ctx: VimContext): boolean {
  if (key >= "1" && key <= "9") return true;
  if (key === "0" && ctx.count > 0) return true;
  return false;
}

/**
 * Determine whether a key is an operator.
 * d: delete, y: yank, c: change
 */
export function isOperator(key: string): key is Operator {
  return key === "d" || key === "y" || key === "c" || key === ">" || key === "<";
}

/**
 * Determine whether a key is a character-pending command.
 * f: forward character search, F: backward character search
 * t: forward character search (stop before), T: backward character search (stop after)
 * r: single character replace
 */
export function isCharCommand(key: string): key is CharCommand {
  return key === "f" || key === "F" || key === "t" || key === "T" || key === "r";
}

/**
 * Get the effective count value. Treats 0 as 1.
 * In Vim, an unspecified count implicitly means 1.
 */
export function getEffectiveCount(ctx: VimContext): number {
  return Math.max(1, ctx.count);
}

/**
 * Whether a count was explicitly specified.
 * Needed to differentiate behavior between gg and G.
 * - gg: no count -> beginning of file, with count -> go to specified line
 * - G: no count -> end of file, with count -> go to specified line
 */
export function isCountExplicit(ctx: VimContext): boolean {
  return ctx.count > 0;
}

/**
 * Helper for mode transitions.
 * Also sets the status message corresponding to the mode.
 */
export function modeChange(ctx: VimContext, mode: VimMode): KeystrokeResult {
  const statusMessage = getModeStatusMessage(mode);

  return {
    newCtx: {
      ...ctx,
      mode,
      phase: "idle",
      count: 0,
      operator: null,
      statusMessage,
    },
    actions: [{ type: "mode-change", mode }],
  };
}

/**
 * Get the status message corresponding to a mode.
 */
export function getModeStatusMessage(mode: VimMode): string {
  switch (mode) {
    case "insert":
      return "-- INSERT --";
    case "visual":
      return "-- VISUAL --";
    case "visual-line":
      return "-- VISUAL LINE --";
    case "visual-block":
      return "-- VISUAL BLOCK --";
    default:
      return "";
  }
}

/**
 * Accumulate a count digit.
 * Example: when count=3 and key="2" -> count=32
 */
export function accumulateCount(key: string, ctx: VimContext): KeystrokeResult {
  const newCount = ctx.count * 10 + Number.parseInt(key, 10);
  return {
    newCtx: { ...ctx, count: newCount },
    actions: [],
  };
}

/**
 * Reset the context (when a command is completed or becomes invalid).
 */
export function resetContext(ctx: VimContext): VimContext {
  return {
    ...ctx,
    phase: "idle",
    count: 0,
    operator: null,
    charCommand: null,
    textObjectModifier: null,
    selectedRegister: null,
    statusMessage: "",
  };
}
