/**
 * text-objects.ts
 *
 * Text object resolution for operator + text-object combinations (ciw, daw, yi", etc.)
 * and visual mode text object selection (viw, va", etc.).
 *
 * Text objects define a range around or inside a semantic unit:
 * - iw / aw: inner/a word
 * - iW / aW: inner/a WORD (whitespace-delimited)
 * - i" / a" / i' / a' / i` / a`: inner/a quoted string
 * - i( / a( / i) / a): inner/a parentheses
 * - i{ / a{ / i} / a}: inner/a braces
 * - i[ / a[ / i] / a]: inner/a brackets
 * - i< / a< / i> / a>: inner/a angle brackets
 */

import type { CursorPosition } from "./types";
import type { TextBuffer } from "./buffer";
import type { MotionRange } from "./motions";

function isWordChar(ch: string): boolean {
  return /\w/.test(ch);
}

/**
 * Resolve a text object from the modifier (i/a) and the object key.
 * Returns null if the key is not a valid text object.
 */
export function resolveTextObject(
  modifier: "i" | "a",
  key: string,
  cursor: CursorPosition,
  buffer: TextBuffer,
): MotionRange | null {
  switch (key) {
    case "w":
      return modifier === "i"
        ? innerWord(cursor, buffer)
        : aWord(cursor, buffer);
    case "W":
      return modifier === "i"
        ? innerBigWord(cursor, buffer)
        : aBigWord(cursor, buffer);
    case '"':
    case "'":
    case "`":
      return modifier === "i"
        ? innerQuote(cursor, buffer, key)
        : aQuote(cursor, buffer, key);
    case "(":
    case ")":
      return modifier === "i"
        ? innerPair(cursor, buffer, "(", ")")
        : aPair(cursor, buffer, "(", ")");
    case "{":
    case "}":
      return modifier === "i"
        ? innerPair(cursor, buffer, "{", "}")
        : aPair(cursor, buffer, "{", "}");
    case "[":
    case "]":
      return modifier === "i"
        ? innerPair(cursor, buffer, "[", "]")
        : aPair(cursor, buffer, "[", "]");
    case "<":
    case ">":
      return modifier === "i"
        ? innerPair(cursor, buffer, "<", ">")
        : aPair(cursor, buffer, "<", ">");
    default:
      return null;
  }
}

// --- Word text objects ---

function innerWord(cursor: CursorPosition, buffer: TextBuffer): MotionRange | null {
  const line = buffer.getLine(cursor.line);
  if (line.length === 0) return null;

  const col = Math.min(cursor.col, line.length - 1);
  const ch = line[col];

  let start = col;
  let end = col;

  if (isWordChar(ch)) {
    while (start > 0 && isWordChar(line[start - 1])) start--;
    while (end < line.length - 1 && isWordChar(line[end + 1])) end++;
  } else if (ch === " " || ch === "\t") {
    while (start > 0 && (line[start - 1] === " " || line[start - 1] === "\t")) start--;
    while (end < line.length - 1 && (line[end + 1] === " " || line[end + 1] === "\t")) end++;
  } else {
    // Punctuation
    while (start > 0 && !isWordChar(line[start - 1]) && line[start - 1] !== " " && line[start - 1] !== "\t") start--;
    while (end < line.length - 1 && !isWordChar(line[end + 1]) && line[end + 1] !== " " && line[end + 1] !== "\t") end++;
  }

  return {
    start: { line: cursor.line, col: start },
    end: { line: cursor.line, col: end },
    linewise: false,
    inclusive: true,
  };
}

function aWord(cursor: CursorPosition, buffer: TextBuffer): MotionRange | null {
  const range = innerWord(cursor, buffer);
  if (!range) return null;

  const line = buffer.getLine(cursor.line);

  // Include trailing whitespace, or leading if at end of line
  let end = range.end.col;
  let start = range.start.col;

  if (end < line.length - 1 && (line[end + 1] === " " || line[end + 1] === "\t")) {
    end++;
    while (end < line.length - 1 && (line[end + 1] === " " || line[end + 1] === "\t")) end++;
  } else if (start > 0 && (line[start - 1] === " " || line[start - 1] === "\t")) {
    start--;
    while (start > 0 && (line[start - 1] === " " || line[start - 1] === "\t")) start--;
  }

  return {
    start: { line: cursor.line, col: start },
    end: { line: cursor.line, col: end },
    linewise: false,
    inclusive: true,
  };
}

// --- WORD text objects ---

function innerBigWord(cursor: CursorPosition, buffer: TextBuffer): MotionRange | null {
  const line = buffer.getLine(cursor.line);
  if (line.length === 0) return null;

  const col = Math.min(cursor.col, line.length - 1);
  const ch = line[col];

  let start = col;
  let end = col;

  if (ch === " " || ch === "\t") {
    while (start > 0 && (line[start - 1] === " " || line[start - 1] === "\t")) start--;
    while (end < line.length - 1 && (line[end + 1] === " " || line[end + 1] === "\t")) end++;
  } else {
    while (start > 0 && line[start - 1] !== " " && line[start - 1] !== "\t") start--;
    while (end < line.length - 1 && line[end + 1] !== " " && line[end + 1] !== "\t") end++;
  }

  return {
    start: { line: cursor.line, col: start },
    end: { line: cursor.line, col: end },
    linewise: false,
    inclusive: true,
  };
}

function aBigWord(cursor: CursorPosition, buffer: TextBuffer): MotionRange | null {
  const range = innerBigWord(cursor, buffer);
  if (!range) return null;

  const line = buffer.getLine(cursor.line);
  let end = range.end.col;
  let start = range.start.col;

  if (end < line.length - 1 && (line[end + 1] === " " || line[end + 1] === "\t")) {
    end++;
    while (end < line.length - 1 && (line[end + 1] === " " || line[end + 1] === "\t")) end++;
  } else if (start > 0 && (line[start - 1] === " " || line[start - 1] === "\t")) {
    start--;
    while (start > 0 && (line[start - 1] === " " || line[start - 1] === "\t")) start--;
  }

  return {
    start: { line: cursor.line, col: start },
    end: { line: cursor.line, col: end },
    linewise: false,
    inclusive: true,
  };
}

// --- Quote text objects ---

function innerQuote(
  cursor: CursorPosition,
  buffer: TextBuffer,
  quote: string,
): MotionRange | null {
  const line = buffer.getLine(cursor.line);
  const col = cursor.col;

  // Find the opening and closing quote around the cursor
  let open = -1;
  let close = -1;

  // Scan for quote pairs on the line
  let inQuote = false;
  let quoteStart = -1;

  for (let i = 0; i < line.length; i++) {
    if (line[i] === quote && (i === 0 || line[i - 1] !== "\\")) {
      if (!inQuote) {
        quoteStart = i;
        inQuote = true;
      } else {
        // Found a pair
        if (col >= quoteStart && col <= i) {
          open = quoteStart;
          close = i;
          break;
        }
        inQuote = false;
      }
    }
  }

  // If cursor is not inside a pair, try to find the next pair on the line
  if (open === -1) {
    inQuote = false;
    for (let i = col; i < line.length; i++) {
      if (line[i] === quote && (i === 0 || line[i - 1] !== "\\")) {
        if (!inQuote) {
          quoteStart = i;
          inQuote = true;
        } else {
          open = quoteStart;
          close = i;
          break;
        }
      }
    }
  }

  if (open === -1 || close === -1 || close <= open) return null;

  return {
    start: { line: cursor.line, col: open + 1 },
    end: { line: cursor.line, col: close - 1 },
    linewise: false,
    inclusive: true,
  };
}

function aQuote(
  cursor: CursorPosition,
  buffer: TextBuffer,
  quote: string,
): MotionRange | null {
  const inner = innerQuote(cursor, buffer, quote);
  if (!inner) return null;

  // a" includes the quotes themselves
  return {
    start: { line: cursor.line, col: inner.start.col - 1 },
    end: { line: cursor.line, col: inner.end.col + 1 },
    linewise: false,
    inclusive: true,
  };
}

// --- Pair/bracket text objects (multi-line) ---

function innerPair(
  cursor: CursorPosition,
  buffer: TextBuffer,
  open: string,
  close: string,
): MotionRange | null {
  const pair = findMatchingPair(cursor, buffer, open, close);
  if (!pair) return null;

  // Inner: between the brackets (exclusive of brackets)
  const start = { line: pair.open.line, col: pair.open.col + 1 };
  const end = { line: pair.close.line, col: pair.close.col - 1 };

  // If the brackets are adjacent (e.g., "()"), end < start
  if (end.line < start.line || (end.line === start.line && end.col < start.col)) {
    return {
      start,
      end: { ...start },
      linewise: false,
      inclusive: true,
    };
  }

  return {
    start,
    end,
    linewise: false,
    inclusive: true,
  };
}

function aPair(
  cursor: CursorPosition,
  buffer: TextBuffer,
  open: string,
  close: string,
): MotionRange | null {
  const pair = findMatchingPair(cursor, buffer, open, close);
  if (!pair) return null;

  return {
    start: pair.open,
    end: pair.close,
    linewise: false,
    inclusive: true,
  };
}

/**
 * Find the innermost matching pair of brackets around the cursor.
 */
function findMatchingPair(
  cursor: CursorPosition,
  buffer: TextBuffer,
  open: string,
  close: string,
): { open: CursorPosition; close: CursorPosition } | null {
  // Search backward for the opening bracket
  let depth = 0;
  let openPos: CursorPosition | null = null;

  let l = cursor.line;
  let c = cursor.col;

  // If cursor is on the close bracket, start searching from just before it
  const cursorChar = buffer.getLine(l)[c];
  if (cursorChar === close) {
    // Check if there's a matching open
  } else if (cursorChar === open) {
    // Cursor is on the open bracket
    openPos = { line: l, col: c };
  }

  if (!openPos) {
    // Search backward for open bracket
    let sl = cursor.line;
    let sc = cursor.col;
    depth = 0;

    while (sl >= 0) {
      const text = buffer.getLine(sl);
      const startCol = sl === cursor.line ? sc : text.length - 1;
      for (let i = startCol; i >= 0; i--) {
        if (text[i] === close) depth++;
        else if (text[i] === open) {
          if (depth === 0) {
            openPos = { line: sl, col: i };
            break;
          }
          depth--;
        }
      }
      if (openPos) break;
      sl--;
    }
  }

  if (!openPos) return null;

  // Search forward from open bracket for the closing bracket
  depth = 0;
  let closePos: CursorPosition | null = null;

  l = openPos.line;
  c = openPos.col + 1;

  while (l < buffer.getLineCount()) {
    const text = buffer.getLine(l);
    const startCol = l === openPos.line ? c : 0;
    for (let i = startCol; i < text.length; i++) {
      if (text[i] === open) depth++;
      else if (text[i] === close) {
        if (depth === 0) {
          closePos = { line: l, col: i };
          break;
        }
        depth--;
      }
    }
    if (closePos) break;
    l++;
  }

  if (!closePos) return null;

  return { open: openPos, close: closePos };
}
