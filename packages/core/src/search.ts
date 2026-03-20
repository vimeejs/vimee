/**
 * search.ts
 *
 * Implementation of text search within the buffer.
 * Supports / (forward search) and ? (backward search).
 * Search patterns are interpreted as JavaScript regular expressions.
 */

import type { CursorPosition } from "./types";
import type { TextBuffer } from "./buffer";

/**
 * Search within the buffer and return the position of the first match.
 *
 * The search starts from the position after (forward search) or before (backward search)
 * the cursor, and wraps around when the end (or beginning) of the buffer is reached.
 *
 * @param buffer - The text buffer to search in
 * @param pattern - The regular expression pattern string
 * @param cursor - The current cursor position (search start position)
 * @param direction - The search direction
 * @returns The matched position, or null if not found
 */
export function searchInBuffer(
  buffer: TextBuffer,
  pattern: string,
  cursor: CursorPosition,
  direction: "forward" | "backward",
): CursorPosition | null {
  // Compile the pattern as a regular expression
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, "gi");
  } catch {
    // Return null for invalid regular expressions
    return null;
  }

  const lineCount = buffer.getLineCount();

  if (direction === "forward") {
    return searchForward(buffer, regex, cursor, lineCount);
  }
  return searchBackward(buffer, regex, cursor, lineCount);
}

/**
 * Forward search (from the position after the cursor toward the end, with wraparound)
 */
function searchForward(
  buffer: TextBuffer,
  regex: RegExp,
  cursor: CursorPosition,
  lineCount: number,
): CursorPosition | null {
  for (let i = 0; i < lineCount; i++) {
    const lineIdx = (cursor.line + i) % lineCount;
    const line = buffer.getLine(lineIdx);

    // For the first line, start searching from the position after the cursor
    const startCol = i === 0 ? cursor.col + 1 : 0;
    const searchTarget = line.slice(startCol);

    // Get matches using matchAll
    const matches = [...searchTarget.matchAll(regex)];
    if (matches.length > 0) {
      // Return the first match (since this is a forward search)
      return { line: lineIdx, col: startCol + matches[0].index };
    }
  }

  return null;
}

/**
 * Backward search (from the position before the cursor toward the beginning, with wraparound)
 */
function searchBackward(
  buffer: TextBuffer,
  regex: RegExp,
  cursor: CursorPosition,
  lineCount: number,
): CursorPosition | null {
  for (let i = 0; i < lineCount; i++) {
    const lineIdx = (cursor.line - i + lineCount) % lineCount;
    const line = buffer.getLine(lineIdx);

    // Collect all matches on this line
    const allMatches = [...line.matchAll(regex)];

    // For the first line, only include matches before the cursor position
    const validMatches =
      i === 0
        ? allMatches.filter((m) => (m.index ?? 0) < cursor.col)
        : allMatches;

    if (validMatches.length > 0) {
      // Return the last match (closest to the cursor in a backward search)
      const last = validMatches[validMatches.length - 1];
      return { line: lineIdx, col: last.index ?? 0 };
    }
  }

  return null;
}
