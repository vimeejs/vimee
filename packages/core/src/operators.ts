/**
 * operators.ts
 *
 * Execution logic for Vim operators (d, y, c).
 *
 * Operators are used in combination with motions:
 *   d + w -> delete a word
 *   y + $ -> yank to end of line
 *   c + c -> change the entire line
 *
 * This module handles the actual buffer operations and action generation.
 */

import type { CursorPosition, VimAction, VimMode, Operator } from "./types";
import type { TextBuffer } from "./buffer";
import type { MotionRange } from "./motions";

/** Operator execution result */
export interface OperatorResult {
  /** List of actions after execution */
  actions: VimAction[];
  /** Cursor position after the operation */
  newCursor: CursorPosition;
  /** Mode after the operation (becomes insert for 'c') */
  newMode: VimMode;
  /** The yanked text */
  yankedText: string;
  /** Status message to display (e.g. "6 lines yanked") */
  statusMessage: string;
}

/**
 * Execute an operator on a motion range.
 *
 * If linewise, operates on whole lines; otherwise operates character-wise.
 * For the 'c' operator, transitions to insert mode after deletion.
 */
export function executeOperatorOnRange(
  operator: Operator,
  range: MotionRange,
  buffer: TextBuffer,
  cursor: CursorPosition,
  indentOptions?: { style: "space" | "tab"; width: number },
): OperatorResult {
  // Indent/dedent always operates linewise
  if (operator === ">" || operator === "<") {
    return executeIndentOperator(operator, range, buffer, cursor, indentOptions);
  }
  if (range.linewise) {
    return executeLinewiseOperator(operator, range, buffer, cursor);
  }
  return executeCharwiseOperator(operator, range, buffer, cursor);
}

/**
 * Line-wise operator execution.
 * Used for dd, yy, cc, and combinations with j/k motions.
 */
function executeLinewiseOperator(
  operator: Operator,
  range: MotionRange,
  buffer: TextBuffer,
  _cursor: CursorPosition,
): OperatorResult {
  const startLine = Math.min(range.start.line, range.end.line);
  const endLine = Math.max(range.start.line, range.end.line);
  const lineCount = endLine - startLine + 1;

  // Get the text to yank (append a newline to indicate line-wise operation)
  const deletedLines = buffer
    .getLines()
    .slice(startLine, endLine + 1)
    .join("\n");
  const yankedText = deletedLines + "\n";

  const actions: VimAction[] = [{ type: "yank", text: yankedText }];

  // Status message for 2+ lines (Vim's default report threshold)
  const statusMessage =
    lineCount >= 2
      ? operator === "y"
        ? `${lineCount} lines yanked`
        : `${lineCount} fewer lines`
      : "";

  // y (yank) does not delete
  if (operator === "y") {
    return {
      actions,
      newCursor: { line: startLine, col: 0 },
      newMode: "normal",
      yankedText,
      statusMessage,
    };
  }

  // d / c delete the lines
  buffer.deleteLines(startLine, lineCount);

  // If the buffer becomes empty, insert a blank line
  if (buffer.getLineCount() === 0) {
    buffer.insertLine(0, "");
  }

  const newLine = Math.min(startLine, buffer.getLineCount() - 1);

  if (operator === "c") {
    // c (change): insert a blank line at the deleted position and enter insert mode
    buffer.insertLine(newLine, "");
    actions.push({ type: "content-change", content: buffer.getContent() });
    return {
      actions,
      newCursor: { line: newLine, col: 0 },
      newMode: "insert",
      yankedText,
      statusMessage,
    };
  }

  // d (delete)
  actions.push({ type: "content-change", content: buffer.getContent() });
  return {
    actions,
    newCursor: { line: newLine, col: 0 },
    newMode: "normal",
    yankedText,
    statusMessage,
  };
}

/**
 * Character-wise operator execution.
 * Used for character-range operations like dw, cw, y$, etc.
 */
function executeCharwiseOperator(
  operator: Operator,
  range: MotionRange,
  buffer: TextBuffer,
  _cursor: CursorPosition,
): OperatorResult {
  // Normalize the order of start and end
  let start = range.start;
  let end = range.end;

  if (start.line > end.line || (start.line === end.line && start.col > end.col)) {
    [start, end] = [end, start];
  }

  // If inclusive, advance end.col by one (deleteRange is exclusive)
  const endCol = range.inclusive ? end.col + 1 : end.col;

  // Get the text to yank
  const yankedText = getTextInRange(buffer, start, { line: end.line, col: endCol });

  const actions: VimAction[] = [{ type: "yank", text: yankedText }];

  // y (yank) does not delete
  if (operator === "y") {
    const yankLines = yankedText.split("\n").length;
    return {
      actions,
      newCursor: { ...start },
      newMode: "normal",
      yankedText,
      statusMessage: yankLines >= 2 ? `${yankLines} lines yanked` : "",
    };
  }

  // Track line count before deletion for status message
  const linesBefore = buffer.getLineCount();

  // d / c delete the range
  buffer.deleteRange(start.line, start.col, end.line, endCol);
  actions.push({ type: "content-change", content: buffer.getContent() });

  const linesAfter = buffer.getLineCount();
  const linesRemoved = linesBefore - linesAfter;

  // Calculate cursor position
  const newCursor = {
    line: start.line,
    col:
      operator === "c"
        ? start.col
        : Math.min(start.col, Math.max(0, buffer.getLineLength(start.line) - 1)),
  };

  return {
    actions,
    newCursor,
    newMode: operator === "c" ? "insert" : "normal",
    yankedText,
    statusMessage: linesRemoved >= 2 ? `${linesRemoved} fewer lines` : "",
  };
}

/**
 * Get text from the buffer within the specified range (non-destructive)
 */
function getTextInRange(buffer: TextBuffer, start: CursorPosition, end: CursorPosition): string {
  if (start.line === end.line) {
    return buffer.getLine(start.line).slice(start.col, end.col);
  }

  const lines: string[] = [];
  lines.push(buffer.getLine(start.line).slice(start.col));
  for (let i = start.line + 1; i < end.line; i++) {
    lines.push(buffer.getLine(i));
  }
  lines.push(buffer.getLine(end.line).slice(0, end.col));
  return lines.join("\n");
}

/**
 * Execute indent (>) or dedent (<) on a line range.
 */
function executeIndentOperator(
  operator: ">" | "<",
  range: MotionRange,
  buffer: TextBuffer,
  cursor: CursorPosition,
  indentOptions?: { style: "space" | "tab"; width: number },
): OperatorResult {
  const startLine = Math.min(range.start.line, range.end.line);
  const endLine = Math.max(range.start.line, range.end.line);
  const lineCount = endLine - startLine + 1;

  const style = indentOptions?.style ?? "space";
  const width = indentOptions?.width ?? 2;
  const indentUnit = style === "tab" ? "\t" : " ".repeat(width);

  for (let l = startLine; l <= endLine; l++) {
    const line = buffer.getLine(l);
    if (operator === ">") {
      buffer.setLine(l, indentUnit + line);
    } else {
      // Remove one level of leading indent
      if (line.startsWith(indentUnit)) {
        buffer.setLine(l, line.slice(indentUnit.length));
      } else if (line.startsWith("\t")) {
        buffer.setLine(l, line.slice(1));
      } else {
        // Remove as many leading spaces as possible (up to indent width)
        const leadingSpaces = line.match(/^ */)?.[0].length ?? 0;
        const toRemove = Math.min(leadingSpaces, indentUnit.length);
        if (toRemove > 0) {
          buffer.setLine(l, line.slice(toRemove));
        }
      }
    }
  }

  const statusMessage =
    lineCount >= 2 ? `${lineCount} lines ${operator === ">" ? ">" : "<"}ed 1 time` : "";

  return {
    actions: [{ type: "content-change", content: buffer.getContent() }],
    newCursor: { line: startLine, col: 0 },
    newMode: "normal",
    yankedText: "",
    statusMessage,
  };
}

/**
 * Execute a line-wise operator (dd, yy, cc, >>, <<).
 * Operates on multiple lines according to count.
 */
export function executeLineOperator(
  operator: Operator,
  cursor: CursorPosition,
  count: number,
  buffer: TextBuffer,
  indentOptions?: { style: "space" | "tab"; width: number },
): OperatorResult {
  const startLine = cursor.line;
  const endLine = Math.min(startLine + count - 1, buffer.getLineCount() - 1);

  const range: MotionRange = {
    start: { line: startLine, col: 0 },
    end: { line: endLine, col: 0 },
    linewise: true,
    inclusive: true,
  };

  return executeOperatorOnRange(operator, range, buffer, cursor, indentOptions);
}
