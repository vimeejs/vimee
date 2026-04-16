/**
 * Cursor.tsx
 *
 * Cursor component.
 * Displays in different shapes depending on the mode:
 * - Normal mode: block cursor (one character wide)
 * - Insert mode: line cursor (vertical bar)
 * - Visual mode: block cursor
 *
 * Cursor position is controlled via pixel values measured from the DOM,
 * ensuring correct alignment with CJK and other variable-width characters.
 */

import { useState, useEffect, useRef } from "react";
import type { VimMode } from "@vimee/core";

export interface CursorProps {
  /** Cursor line (0-based) */
  line: number;
  /** Cursor column (0-based, for blink restart detection) */
  col: number;
  /** Left offset in pixels (measured from DOM) */
  leftPx: number;
  /** Character width in pixels (measured from DOM) */
  widthPx: number;
  /** Current Vim mode */
  mode: VimMode;
}

const BLINK_RESTART_DELAY = 500;

export function Cursor({ line, col, leftPx, widthPx, mode }: CursorProps) {
  const cursorClass = getCursorClass(mode);
  const isBlock = mode !== "insert";

  // Pause blink while cursor is moving, resume after idle
  const [blinking, setBlinking] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setBlinking(false);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setBlinking(true), BLINK_RESTART_DELAY);
    return () => clearTimeout(timerRef.current);
  }, [line, col]);

  return (
    <div
      className={`sv-cursor ${cursorClass}`}
      style={{
        ["--cursor-line" as string]: line,
        left: `${leftPx}px`,
        width: isBlock ? `${widthPx}px` : undefined,
        animation: blinking && mode !== "command-line" ? undefined : "none",
        opacity: mode === "command-line" ? 0 : blinking ? undefined : 1,
      }}
      aria-hidden="true"
    />
  );
}

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
