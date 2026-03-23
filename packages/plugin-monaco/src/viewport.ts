/**
 * viewport.ts
 *
 * Utilities for computing viewport information from a Monaco Editor.
 * Handles viewport tracking for H/M/L motions and
 * Ctrl-U/D/B/F page scrolling.
 */

import type { MonacoEditor } from "./types";

/**
 * Get the first visible line (0-based) from the Monaco editor.
 */
export function getTopLine(editor: MonacoEditor): number {
  const ranges = editor.getVisibleRanges();
  if (ranges.length === 0) return 0;
  return ranges[0].startLineNumber - 1; // Convert to 0-based
}

/**
 * Get the number of visible lines in the Monaco editor viewport.
 */
export function getVisibleLines(editor: MonacoEditor): number {
  const ranges = editor.getVisibleRanges();
  if (ranges.length === 0) return 20; // Fallback
  const first = ranges[0];
  const last = ranges[ranges.length - 1];
  return last.endLineNumber - first.startLineNumber + 1;
}

/**
 * Scroll the Monaco editor to reveal a specific line (0-based).
 */
export function revealLine(editor: MonacoEditor, line: number): void {
  editor.revealLine(line + 1); // Convert to 1-based
}
