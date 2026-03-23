/**
 * cursor.ts
 *
 * Utilities for converting between vimee's 0-based CursorPosition
 * and Monaco's 1-based IPosition.
 */

import type { CursorPosition } from "@vimee/core";
import type { IPosition } from "./types";

/**
 * Convert a vimee 0-based CursorPosition to a Monaco 1-based IPosition.
 */
export function cursorToMonacoPosition(cursor: CursorPosition): IPosition {
  return {
    lineNumber: cursor.line + 1,
    column: cursor.col + 1,
  };
}

/**
 * Convert a Monaco 1-based IPosition to a vimee 0-based CursorPosition.
 */
export function monacoPositionToCursor(position: IPosition): CursorPosition {
  return {
    line: position.lineNumber - 1,
    col: position.column - 1,
  };
}
