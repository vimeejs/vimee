export { VimHarness } from "./harness";
export type { VimOptions } from "./harness";
export { parseKeys } from "./key-parser";
export type { KeyInput } from "./key-parser";

import { VimHarness } from "./harness";
import type { VimOptions } from "./harness";

/**
 * Create a VimHarness for testing Vim operations.
 *
 * @param text - Initial buffer content
 * @param opts - Options (cursor, mode, anchor, indentStyle, indentWidth)
 * @returns VimHarness instance
 *
 * @example
 * ```typescript
 * const v = vim("hello\nworld");
 * v.type("dd");
 * expect(v.content()).toBe("world");
 * ```
 */
export function vim(text: string, opts?: VimOptions): VimHarness {
  return new VimHarness(text, opts);
}
