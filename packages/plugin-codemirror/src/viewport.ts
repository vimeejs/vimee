/**
 * viewport.ts
 *
 * Utilities for computing viewport information from a CodeMirror 6 EditorView.
 * Handles viewport tracking for H/M/L motions and Ctrl-U/D/B/F page scrolling.
 */

import type { CodeMirrorView } from "./types";

/**
 * Get the first visible line (0-based) from the CodeMirror view.
 */
export function getTopLine(view: CodeMirrorView): number {
  return view.state.doc.lineAt(view.viewport.from).number - 1; // Convert to 0-based
}

/**
 * Get the number of visible lines in the CodeMirror viewport.
 */
export function getVisibleLines(view: CodeMirrorView): number {
  const first = view.state.doc.lineAt(view.viewport.from);
  const last = view.state.doc.lineAt(view.viewport.to);
  return last.number - first.number + 1;
}
