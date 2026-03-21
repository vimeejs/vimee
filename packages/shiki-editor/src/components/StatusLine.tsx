/**
 * StatusLine.tsx
 *
 * Status line component at the bottom of the editor.
 * Mimics the Vim status bar display:
 *
 * [Mode display]                  [Cursor position]
 * -- INSERT --                   12:34
 *
 * In command-line mode, displays command input:
 * :w
 * /search_pattern
 */

import type { CursorPosition, VimMode } from "@vimee/core";

export interface StatusLineProps {
  /** Current Vim mode */
  mode: VimMode;
  /** Cursor position (0-based) */
  cursor: CursorPosition;
  /** Status message (mode display or error messages) */
  statusMessage: string;
  /** Command line input (input after : or /) */
  commandLine: string;
  /** Total number of lines */
  totalLines: number;
}

/**
 * Renders the status line.
 */
export function StatusLine({
  mode,
  cursor,
  statusMessage,
  commandLine,
  totalLines,
}: StatusLineProps) {
  if (mode === "command-line" && commandLine) {
    return (
      <div className="sv-statusline">
        <span className="sv-statusline-left">
          <span className="sv-command-input">{commandLine}</span>
          <span className="sv-command-cursor">▋</span>
        </span>
        <span className="sv-statusline-right">
          {formatCursorPosition(cursor, totalLines)}
        </span>
      </div>
    );
  }

  return (
    <div className="sv-statusline">
      <span className="sv-statusline-left">
        {statusMessage && (
          <span className={`sv-mode-indicator sv-mode-${mode}`}>
            {statusMessage}
          </span>
        )}
      </span>
      <span className="sv-statusline-right">
        {formatCursorPosition(cursor, totalLines)}
      </span>
    </div>
  );
}

/**
 * Format cursor position in "line:column" format (1-based).
 * Also displays the position percentage within the file.
 */
function formatCursorPosition(
  cursor: CursorPosition,
  totalLines: number,
): string {
  const line = cursor.line + 1;
  const col = cursor.col + 1;
  const percentage =
    totalLines <= 1
      ? "All"
      : cursor.line === 0
        ? "Top"
        : cursor.line >= totalLines - 1
          ? "Bot"
          : `${Math.round((cursor.line / (totalLines - 1)) * 100)}%`;

  return `${line}:${col}    ${percentage}`;
}
