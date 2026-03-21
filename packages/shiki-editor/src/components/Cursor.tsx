/**
 * Cursor.tsx
 *
 * Cursor component.
 * Displays in different shapes depending on the mode:
 * - Normal mode: block cursor (one character wide)
 * - Insert mode: line cursor (vertical bar)
 * - Visual mode: block cursor
 *
 * Cursor position is controlled via CSS variables,
 * calculated using `ch` / `lh` units of a monospace font.
 */

import { useState, useEffect, useRef } from "react";
import type { CursorPosition, VimMode } from "@vimee/core";

export interface CursorProps {
  /** Cursor position (0-based) */
  position: CursorPosition;
  /** Visual column (accounting for tab width) */
  visualCol: number;
  /** Current Vim mode */
  mode: VimMode;
  /** Whether line numbers are displayed */
  showLineNumbers: boolean;
  /** Gutter width for line numbers (in ch units) */
  gutterWidth: number;
}

/**
 * Renders the editor cursor.
 *
 * Displayed as an overlay using absolute positioning.
 * left / top are calculated accounting for the line number gutter offset.
 */
const BLINK_RESTART_DELAY = 500;

export function Cursor({
  position,
  visualCol,
  mode,
  showLineNumbers,
  gutterWidth,
}: CursorProps) {
  const cursorClass = getCursorClass(mode);

  // Pause blink while cursor is moving, resume after idle
  const [blinking, setBlinking] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setBlinking(false);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setBlinking(true), BLINK_RESTART_DELAY);
    return () => clearTimeout(timerRef.current);
  }, [position.line, position.col]);

  // Gutter offset (only when line numbers are displayed)
  const gutterOffset = showLineNumbers ? gutterWidth + 1 : 0;

  return (
    <div
      className={`sv-cursor ${cursorClass}`}
      style={{
        ["--cursor-col" as string]: visualCol + gutterOffset,
        ["--cursor-line" as string]: position.line,
        animation: blinking ? undefined : "none",
        opacity: blinking ? undefined : 1,
      }}
      aria-hidden="true"
    />
  );
}

/**
 * Returns the CSS class for the cursor based on the mode.
 */
function getCursorClass(mode: VimMode): string {
  switch (mode) {
    case "insert":
      return "sv-cursor-line";
    case "normal":
    case "visual":
    case "visual-line":
    case "visual-block":
    case "command-line":
      return "sv-cursor-block";
    default:
      return "sv-cursor-block";
  }
}
