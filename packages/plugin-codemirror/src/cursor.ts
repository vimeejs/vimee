/**
 * cursor.ts
 *
 * Utilities for converting between vimee's 0-based CursorPosition
 * and CodeMirror's flat character offsets.
 */

import type { CursorPosition } from "@vimee/core";

/**
 * Convert a 0-based CursorPosition to a flat character offset.
 */
export function cursorToOffset(content: string, cursor: CursorPosition): number {
  const lines = content.split("\n");
  let offset = 0;
  for (let i = 0; i < cursor.line && i < lines.length; i++) {
    offset += lines[i].length + 1; // +1 for newline
  }
  const lineLength = lines[cursor.line]?.length ?? 0;
  offset += Math.min(cursor.col, lineLength);
  return offset;
}

/**
 * Convert a flat character offset to a 0-based CursorPosition.
 */
export function offsetToCursor(content: string, offset: number): CursorPosition {
  let remaining = offset;
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (remaining <= lines[i].length) {
      return { line: i, col: remaining };
    }
    remaining -= lines[i].length + 1; // +1 for newline
  }
  // Past end of content
  const lastLine = lines.length - 1;
  return { line: lastLine, col: lines[lastLine]?.length ?? 0 };
}
