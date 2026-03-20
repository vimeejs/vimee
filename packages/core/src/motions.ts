import type { CursorPosition } from "./types";
import type { TextBuffer } from "./buffer";

/**
 * Range covered by a motion (used when combined with operators)
 */
export interface MotionRange {
  start: CursorPosition;
  end: CursorPosition;
  /** Whether the motion operates on whole lines */
  linewise: boolean;
  /** Whether the end position is inclusive */
  inclusive: boolean;
}

/**
 * Result of resolving a motion
 */
export interface MotionResult {
  cursor: CursorPosition;
  range: MotionRange;
}

// --- Helper functions ---

function isWordChar(ch: string): boolean {
  return /\w/.test(ch);
}

function isPunctuation(ch: string): boolean {
  return !isWordChar(ch) && ch !== " " && ch !== "\t" && ch !== "";
}

function clampLine(line: number, buffer: TextBuffer): number {
  return Math.max(0, Math.min(line, buffer.getLineCount() - 1));
}

function clampCol(col: number, line: number, buffer: TextBuffer): number {
  const maxCol = Math.max(0, buffer.getLineLength(line) - 1);
  return Math.max(0, Math.min(col, maxCol));
}

function clampColInsert(col: number, line: number, buffer: TextBuffer): number {
  const maxCol = buffer.getLineLength(line);
  return Math.max(0, Math.min(col, maxCol));
}

function firstNonBlank(line: string): number {
  const match = line.match(/\S/);
  return match ? match.index! : 0;
}

// --- Motion implementations ---

export function motionH(
  cursor: CursorPosition,
  buffer: TextBuffer,
  count: number,
): MotionResult {
  const newCol = Math.max(0, cursor.col - count);
  const newCursor = { line: cursor.line, col: newCol };
  return {
    cursor: newCursor,
    range: {
      start: newCursor,
      end: cursor,
      linewise: false,
      inclusive: false,
    },
  };
}

export function motionL(
  cursor: CursorPosition,
  buffer: TextBuffer,
  count: number,
): MotionResult {
  const maxCol = Math.max(0, buffer.getLineLength(cursor.line) - 1);
  const newCol = Math.min(maxCol, cursor.col + count);
  const newCursor = { line: cursor.line, col: newCol };
  return {
    cursor: newCursor,
    range: {
      start: cursor,
      end: newCursor,
      linewise: false,
      inclusive: true,
    },
  };
}

export function motionJ(
  cursor: CursorPosition,
  buffer: TextBuffer,
  count: number,
): MotionResult {
  const newLine = clampLine(cursor.line + count, buffer);
  const newCol = clampCol(cursor.col, newLine, buffer);
  const newCursor = { line: newLine, col: newCol };
  return {
    cursor: newCursor,
    range: {
      start: cursor.line < newLine ? cursor : newCursor,
      end: cursor.line < newLine ? newCursor : cursor,
      linewise: true,
      inclusive: true,
    },
  };
}

export function motionK(
  cursor: CursorPosition,
  buffer: TextBuffer,
  count: number,
): MotionResult {
  const newLine = clampLine(cursor.line - count, buffer);
  const newCol = clampCol(cursor.col, newLine, buffer);
  const newCursor = { line: newLine, col: newCol };
  return {
    cursor: newCursor,
    range: {
      start: newLine < cursor.line ? newCursor : cursor,
      end: newLine < cursor.line ? cursor : newCursor,
      linewise: true,
      inclusive: true,
    },
  };
}

export function motionW(
  cursor: CursorPosition,
  buffer: TextBuffer,
  count: number,
): MotionResult {
  let { line, col } = cursor;

  for (let i = 0; i < count; i++) {
    // Save previous position (to revert if movement fails)
    const prevLine = line;
    const prevCol = col;

    const text = buffer.getLine(line);

    // If already past end of line, move to the next line
    if (col >= text.length) {
      if (line < buffer.getLineCount() - 1) {
        line++;
        col = 0;
      }
      continue;
    }

    const ch = text[col];
    // Skip the current character class (word / punctuation)
    if (isWordChar(ch)) {
      while (col < text.length && isWordChar(text[col])) col++;
    } else if (isPunctuation(ch)) {
      while (col < text.length && isPunctuation(text[col])) col++;
    }
    // Skip whitespace
    while (col < text.length && (text[col] === " " || text[col] === "\t"))
      col++;

    // If end of line is reached, move to the beginning of the next line
    if (col >= text.length) {
      if (line < buffer.getLineCount() - 1) {
        line++;
        col = 0;
      } else {
        // End of file: cannot move, revert to previous position
        line = prevLine;
        col = prevCol;
        break;
      }
    }
  }

  // Clamp col within buffer range
  const clampedLine = clampLine(line, buffer);
  const lineLen = buffer.getLineLength(clampedLine);
  const newCursor = {
    line: clampedLine,
    col: lineLen > 0 ? Math.min(Math.max(0, col), lineLen - 1) : 0,
  };
  return {
    cursor: newCursor,
    range: {
      start: cursor,
      end: newCursor,
      linewise: false,
      inclusive: false,
    },
  };
}

export function motionE(
  cursor: CursorPosition,
  buffer: TextBuffer,
  count: number,
): MotionResult {
  let { line, col } = cursor;

  for (let i = 0; i < count; i++) {
    col++;
    const text = buffer.getLine(line);

    // Skip whitespace and line breaks
    while (col >= buffer.getLineLength(line)) {
      if (line >= buffer.getLineCount() - 1) break;
      line++;
      col = 0;
    }

    const lineText = buffer.getLine(line);
    // Skip whitespace on the new line
    while (
      col < lineText.length &&
      (lineText[col] === " " || lineText[col] === "\t")
    ) {
      col++;
    }

    // Move to end of word
    if (col < lineText.length) {
      const ch = lineText[col];
      if (isWordChar(ch)) {
        while (col + 1 < lineText.length && isWordChar(lineText[col + 1]))
          col++;
      } else if (isPunctuation(ch)) {
        while (col + 1 < lineText.length && isPunctuation(lineText[col + 1]))
          col++;
      }
    }
  }

  const newCursor = {
    line: clampLine(line, buffer),
    col: clampCol(col, clampLine(line, buffer), buffer),
  };
  return {
    cursor: newCursor,
    range: {
      start: cursor,
      end: newCursor,
      linewise: false,
      inclusive: true,
    },
  };
}

export function motionB(
  cursor: CursorPosition,
  buffer: TextBuffer,
  count: number,
): MotionResult {
  let { line, col } = cursor;

  for (let i = 0; i < count; i++) {
    col--;

    // Go to previous line if at start
    while (col < 0) {
      if (line <= 0) {
        col = 0;
        break;
      }
      line--;
      col = buffer.getLineLength(line) - 1;
    }

    const text = buffer.getLine(line);
    // Skip whitespace backwards
    while (col > 0 && (text[col] === " " || text[col] === "\t")) col--;

    // Move to start of word
    if (col >= 0) {
      const ch = text[col];
      if (isWordChar(ch)) {
        while (col > 0 && isWordChar(text[col - 1])) col--;
      } else if (isPunctuation(ch)) {
        while (col > 0 && isPunctuation(text[col - 1])) col--;
      }
    }
  }

  const newCursor = {
    line: clampLine(line, buffer),
    col: Math.max(0, col),
  };
  return {
    cursor: newCursor,
    range: {
      start: newCursor,
      end: cursor,
      linewise: false,
      inclusive: false,
    },
  };
}

/**
 * W: Move forward by WORD (whitespace-delimited)
 */
export function motionBigW(
  cursor: CursorPosition,
  buffer: TextBuffer,
  count: number,
): MotionResult {
  let { line, col } = cursor;

  for (let i = 0; i < count; i++) {
    const prevLine = line;
    const prevCol = col;
    const text = buffer.getLine(line);

    if (col >= text.length) {
      if (line < buffer.getLineCount() - 1) {
        line++;
        col = 0;
      }
      continue;
    }

    // Skip non-whitespace
    while (col < text.length && text[col] !== " " && text[col] !== "\t") col++;
    // Skip whitespace
    while (col < text.length && (text[col] === " " || text[col] === "\t")) col++;

    if (col >= text.length) {
      if (line < buffer.getLineCount() - 1) {
        line++;
        col = 0;
      } else {
        line = prevLine;
        col = prevCol;
        break;
      }
    }
  }

  const clampedLine = clampLine(line, buffer);
  const lineLen = buffer.getLineLength(clampedLine);
  const newCursor = {
    line: clampedLine,
    col: lineLen > 0 ? Math.min(Math.max(0, col), lineLen - 1) : 0,
  };
  return {
    cursor: newCursor,
    range: {
      start: cursor,
      end: newCursor,
      linewise: false,
      inclusive: false,
    },
  };
}

/**
 * B: Move backward by WORD (whitespace-delimited)
 */
export function motionBigB(
  cursor: CursorPosition,
  buffer: TextBuffer,
  count: number,
): MotionResult {
  let { line, col } = cursor;

  for (let i = 0; i < count; i++) {
    col--;

    // Go to previous line if at start
    while (col < 0) {
      if (line <= 0) {
        col = 0;
        break;
      }
      line--;
      col = buffer.getLineLength(line) - 1;
    }

    const text = buffer.getLine(line);
    // Skip whitespace backwards
    while (col > 0 && (text[col] === " " || text[col] === "\t")) col--;

    // Skip non-whitespace backwards
    while (col > 0 && text[col - 1] !== " " && text[col - 1] !== "\t") col--;
  }

  const newCursor = {
    line: clampLine(line, buffer),
    col: Math.max(0, col),
  };
  return {
    cursor: newCursor,
    range: {
      start: newCursor,
      end: cursor,
      linewise: false,
      inclusive: false,
    },
  };
}

export function motionZero(
  cursor: CursorPosition,
  _buffer: TextBuffer,
  _count: number,
): MotionResult {
  const newCursor = { line: cursor.line, col: 0 };
  return {
    cursor: newCursor,
    range: {
      start: newCursor,
      end: cursor,
      linewise: false,
      inclusive: false,
    },
  };
}

export function motionCaret(
  cursor: CursorPosition,
  buffer: TextBuffer,
  _count: number,
): MotionResult {
  const line = buffer.getLine(cursor.line);
  const col = firstNonBlank(line);
  const newCursor = { line: cursor.line, col };
  return {
    cursor: newCursor,
    range: {
      start: col < cursor.col ? newCursor : cursor,
      end: col < cursor.col ? cursor : newCursor,
      linewise: false,
      inclusive: true,
    },
  };
}

export function motionDollar(
  cursor: CursorPosition,
  buffer: TextBuffer,
  _count: number,
): MotionResult {
  const lineLen = buffer.getLineLength(cursor.line);
  const col = Math.max(0, lineLen - 1);
  const newCursor = { line: cursor.line, col };
  return {
    cursor: newCursor,
    range: {
      start: cursor,
      end: { line: cursor.line, col: lineLen },
      linewise: false,
      inclusive: true,
    },
  };
}

export function motionGG(
  cursor: CursorPosition,
  buffer: TextBuffer,
  count: number | null,
): MotionResult {
  const targetLine =
    count !== null ? clampLine(count - 1, buffer) : 0;
  const col = firstNonBlank(buffer.getLine(targetLine));
  const newCursor = { line: targetLine, col };
  return {
    cursor: newCursor,
    range: {
      start: targetLine < cursor.line ? newCursor : cursor,
      end: targetLine < cursor.line ? cursor : newCursor,
      linewise: true,
      inclusive: true,
    },
  };
}

export function motionG(
  cursor: CursorPosition,
  buffer: TextBuffer,
  count: number | null,
): MotionResult {
  const targetLine =
    count !== null
      ? clampLine(count - 1, buffer)
      : buffer.getLineCount() - 1;
  const col = firstNonBlank(buffer.getLine(targetLine));
  const newCursor = { line: targetLine, col };
  return {
    cursor: newCursor,
    range: {
      start: cursor.line < targetLine ? cursor : newCursor,
      end: cursor.line < targetLine ? newCursor : cursor,
      linewise: true,
      inclusive: true,
    },
  };
}

/**
 * H: Move to top of viewport
 */
export function motionBigH(
  cursor: CursorPosition,
  buffer: TextBuffer,
  count: number,
  viewportTopLine: number,
): MotionResult {
  // H with count goes to Nth line from top of viewport
  const targetLine = clampLine(viewportTopLine + (count - 1), buffer);
  const col = firstNonBlank(buffer.getLine(targetLine));
  const newCursor = { line: targetLine, col };
  return {
    cursor: newCursor,
    range: {
      start: targetLine < cursor.line ? newCursor : cursor,
      end: targetLine < cursor.line ? cursor : newCursor,
      linewise: true,
      inclusive: true,
    },
  };
}

/**
 * M: Move to middle of viewport
 */
export function motionBigM(
  cursor: CursorPosition,
  buffer: TextBuffer,
  viewportTopLine: number,
  viewportHeight: number,
): MotionResult {
  const targetLine = clampLine(
    viewportTopLine + Math.floor(viewportHeight / 2),
    buffer,
  );
  const col = firstNonBlank(buffer.getLine(targetLine));
  const newCursor = { line: targetLine, col };
  return {
    cursor: newCursor,
    range: {
      start: targetLine < cursor.line ? newCursor : cursor,
      end: targetLine < cursor.line ? cursor : newCursor,
      linewise: true,
      inclusive: true,
    },
  };
}

/**
 * L: Move to bottom of viewport
 */
export function motionBigL(
  cursor: CursorPosition,
  buffer: TextBuffer,
  count: number,
  viewportTopLine: number,
  viewportHeight: number,
): MotionResult {
  // L with count goes to Nth line from bottom of viewport
  const bottomLine = viewportTopLine + viewportHeight - 1;
  const targetLine = clampLine(bottomLine - (count - 1), buffer);
  const col = firstNonBlank(buffer.getLine(targetLine));
  const newCursor = { line: targetLine, col };
  return {
    cursor: newCursor,
    range: {
      start: targetLine < cursor.line ? newCursor : cursor,
      end: targetLine < cursor.line ? cursor : newCursor,
      linewise: true,
      inclusive: true,
    },
  };
}

export function motionFChar(
  cursor: CursorPosition,
  buffer: TextBuffer,
  char: string,
  count: number,
): MotionResult {
  const line = buffer.getLine(cursor.line);
  let col = cursor.col;
  let found = 0;

  for (let i = col + 1; i < line.length; i++) {
    if (line[i] === char) {
      found++;
      col = i;
      if (found >= count) break;
    }
  }

  const newCursor = { line: cursor.line, col };
  return {
    cursor: newCursor,
    range: {
      start: cursor,
      end: newCursor,
      linewise: false,
      inclusive: true,
    },
  };
}

export function motionFCharBack(
  cursor: CursorPosition,
  buffer: TextBuffer,
  char: string,
  count: number,
): MotionResult {
  const line = buffer.getLine(cursor.line);
  let col = cursor.col;
  let found = 0;

  for (let i = col - 1; i >= 0; i--) {
    if (line[i] === char) {
      found++;
      col = i;
      if (found >= count) break;
    }
  }

  const newCursor = { line: cursor.line, col };
  return {
    cursor: newCursor,
    range: {
      start: newCursor,
      end: cursor,
      linewise: false,
      inclusive: true,
    },
  };
}

export function motionTChar(
  cursor: CursorPosition,
  buffer: TextBuffer,
  char: string,
  count: number,
): MotionResult {
  const result = motionFChar(cursor, buffer, char, count);
  if (result.cursor.col > cursor.col) {
    result.cursor.col--;
    result.range.end = { ...result.cursor };
  }
  return result;
}

export function motionTCharBack(
  cursor: CursorPosition,
  buffer: TextBuffer,
  char: string,
  count: number,
): MotionResult {
  const result = motionFCharBack(cursor, buffer, char, count);
  if (result.cursor.col < cursor.col) {
    result.cursor.col++;
    result.range.start = { ...result.cursor };
  }
  return result;
}

/**
 * Match bracket motion (%)
 */
export function motionMatchBracket(
  cursor: CursorPosition,
  buffer: TextBuffer,
  _count: number,
): MotionResult {
  const pairs: Record<string, string> = {
    "(": ")",
    ")": "(",
    "[": "]",
    "]": "[",
    "{": "}",
    "}": "{",
  };
  const openBrackets = new Set(["(", "[", "{"]);

  const line = buffer.getLine(cursor.line);
  const ch = line[cursor.col];

  if (!ch || !pairs[ch]) {
    // Search forward on the line for the first bracket
    for (let i = cursor.col; i < line.length; i++) {
      if (pairs[line[i]]) {
        return motionMatchBracket({ line: cursor.line, col: i }, buffer, 0);
      }
    }
    return {
      cursor: { ...cursor },
      range: {
        start: cursor,
        end: cursor,
        linewise: false,
        inclusive: true,
      },
    };
  }

  const isOpen = openBrackets.has(ch);
  const match = pairs[ch];
  let depth = 1;

  if (isOpen) {
    // Search forward
    let l = cursor.line;
    let c = cursor.col + 1;
    while (l < buffer.getLineCount()) {
      const text = buffer.getLine(l);
      while (c < text.length) {
        if (text[c] === ch) depth++;
        else if (text[c] === match) depth--;
        if (depth === 0) {
          const newCursor = { line: l, col: c };
          return {
            cursor: newCursor,
            range: {
              start: cursor,
              end: newCursor,
              linewise: false,
              inclusive: true,
            },
          };
        }
        c++;
      }
      l++;
      c = 0;
    }
  } else {
    // Search backward (closing bracket -> find opening bracket)
    let l = cursor.line;
    let c = cursor.col - 1;

    // If col at cursor position is 0, start searching from the previous line
    if (c < 0) {
      l--;
      c = l >= 0 ? buffer.getLineLength(l) - 1 : -1;
    }

    while (l >= 0) {
      const text = buffer.getLine(l);
      while (c >= 0) {
        if (text[c] === ch) depth++;
        else if (text[c] === match) depth--;
        if (depth === 0) {
          const newCursor = { line: l, col: c };
          return {
            cursor: newCursor,
            range: {
              start: newCursor,
              end: cursor,
              linewise: false,
              inclusive: true,
            },
          };
        }
        c--;
      }
      l--;
      c = l >= 0 ? buffer.getLineLength(l) - 1 : -1;
    }
  }

  // No match found
  return {
    cursor: { ...cursor },
    range: {
      start: cursor,
      end: cursor,
      linewise: false,
      inclusive: true,
    },
  };
}
