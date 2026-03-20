/**
 * motion-resolver.ts
 *
 * Mapping from key strings to motion functions.
 * Integrates individual motion functions from motions.ts
 * and resolves the appropriate motion from a single key.
 */

import type { CursorPosition, VimContext } from "./types";
import type { TextBuffer } from "./buffer";
import type { MotionResult } from "./motions";
import {
  motionH,
  motionJ,
  motionK,
  motionL,
  motionW,
  motionE,
  motionB,
  motionBigW,
  motionBigB,
  motionBigH,
  motionBigM,
  motionBigL,
  motionZero,
  motionCaret,
  motionDollar,
  motionG,
  motionMatchBracket,
} from "./motions";

/**
 * Resolve a key string and return the motion result.
 *
 * @param key - The value of KeyboardEvent.key
 * @param cursor - The current cursor position
 * @param buffer - The text buffer
 * @param count - The repeat count
 * @param countExplicit - Whether the count was explicitly specified
 * @param ctx - The full VimContext (for viewport-dependent motions)
 * @returns The motion result, or null if no motion matches
 */
export function resolveMotion(
  key: string,
  cursor: CursorPosition,
  buffer: TextBuffer,
  count: number,
  countExplicit: boolean,
  ctx?: VimContext,
): MotionResult | null {
  switch (key) {
    // --- Basic movement ---
    case "h":
    case "ArrowLeft":
      return motionH(cursor, buffer, count);

    case "j":
    case "ArrowDown":
      return motionJ(cursor, buffer, count);

    case "k":
    case "ArrowUp":
      return motionK(cursor, buffer, count);

    case "l":
    case "ArrowRight":
      return motionL(cursor, buffer, count);

    // --- Word movement ---
    case "w":
      return motionW(cursor, buffer, count);

    case "e":
      return motionE(cursor, buffer, count);

    case "b":
      return motionB(cursor, buffer, count);

    case "W":
      return motionBigW(cursor, buffer, count);

    case "B":
      return motionBigB(cursor, buffer, count);

    // --- Intra-line movement ---
    case "0":
      return motionZero(cursor, buffer, count);

    case "^":
      return motionCaret(cursor, buffer, count);

    case "$":
      return motionDollar(cursor, buffer, count);

    // --- File-level movement ---
    case "G":
      // G: with count -> go to specified line, without count -> go to end of file
      return motionG(cursor, buffer, countExplicit ? count : null);

    // --- Screen-relative movement ---
    case "H":
      return motionBigH(
        cursor, buffer, count,
        ctx?.viewportTopLine ?? 0,
      );

    case "M":
      return motionBigM(
        cursor, buffer,
        ctx?.viewportTopLine ?? 0,
        ctx?.viewportHeight ?? 50,
      );

    case "L":
      return motionBigL(
        cursor, buffer, count,
        ctx?.viewportTopLine ?? 0,
        ctx?.viewportHeight ?? 50,
      );

    // --- Bracket matching ---
    case "%":
      return motionMatchBracket(cursor, buffer, count);

    default:
      return null;
  }
}
