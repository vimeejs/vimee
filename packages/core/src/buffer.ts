import type { CursorPosition, UndoEntry, BufferReader } from "./types";

/**
 * Text buffer that manages the document content as an array of lines.
 * Provides mutation methods and undo/redo support.
 *
 * Implements BufferReader so that read-only consumers (motions, search,
 * text-objects) can depend on the interface rather than the concrete class.
 * This allows host environments like VS Code to supply their own
 * TextDocument-backed BufferReader without depending on this implementation.
 */
export class TextBuffer implements BufferReader {
  private lines: string[];
  private undoStack: UndoEntry[] = [];
  private redoStack: UndoEntry[] = [];

  constructor(content: string) {
    this.lines = content.split("\n");
  }

  getLine(lineIndex: number): string {
    return this.lines[lineIndex] ?? "";
  }

  getLineLength(lineIndex: number): number {
    return this.getLine(lineIndex).length;
  }

  getLineCount(): number {
    return this.lines.length;
  }

  getContent(): string {
    return this.lines.join("\n");
  }

  getLines(): readonly string[] {
    return this.lines;
  }

  /**
   * Save current state to undo stack before making changes.
   * Clears the redo stack since the history branch diverges.
   */
  saveUndoPoint(cursor: CursorPosition): void {
    this.undoStack.push({
      lines: [...this.lines],
      cursor: { ...cursor },
    });
    // Clear redo stack on new change
    this.redoStack = [];
  }

  /**
   * Undo: restore previous state from the undo stack.
   * Pushes the current state onto the redo stack.
   * Returns the restored cursor position, or null if nothing to undo.
   */
  undo(currentCursor: CursorPosition): CursorPosition | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;

    this.redoStack.push({
      lines: [...this.lines],
      cursor: { ...currentCursor },
    });
    this.lines = entry.lines;
    return entry.cursor;
  }

  /**
   * Redo: restore next state from the redo stack.
   * Pushes the current state onto the undo stack.
   * Returns the restored cursor position, or null if nothing to redo.
   */
  redo(currentCursor: CursorPosition): CursorPosition | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;

    this.undoStack.push({
      lines: [...this.lines],
      cursor: { ...currentCursor },
    });
    this.lines = entry.lines;
    return entry.cursor;
  }

  // --- Mutations ---

  setLine(lineIndex: number, content: string): void {
    if (lineIndex >= 0 && lineIndex < this.lines.length) {
      this.lines[lineIndex] = content;
    }
  }

  insertAt(line: number, col: number, text: string): void {
    const current = this.getLine(line);
    this.lines[line] = current.slice(0, col) + text + current.slice(col);
  }

  deleteAt(line: number, col: number, count: number = 1): string {
    const current = this.getLine(line);
    const deleted = current.slice(col, col + count);
    this.lines[line] = current.slice(0, col) + current.slice(col + count);
    return deleted;
  }

  deleteRange(startLine: number, startCol: number, endLine: number, endCol: number): string {
    if (startLine === endLine) {
      const line = this.getLine(startLine);
      const deleted = line.slice(startCol, endCol);
      this.lines[startLine] = line.slice(0, startCol) + line.slice(endCol);
      return deleted;
    }

    const firstLine = this.getLine(startLine);
    const lastLine = this.getLine(endLine);
    const deleted = [
      firstLine.slice(startCol),
      ...this.lines.slice(startLine + 1, endLine),
      lastLine.slice(0, endCol),
    ].join("\n");

    this.lines[startLine] = firstLine.slice(0, startCol) + lastLine.slice(endCol);
    this.lines.splice(startLine + 1, endLine - startLine);

    return deleted;
  }

  deleteLines(startLine: number, count: number): string[] {
    return this.lines.splice(startLine, Math.min(count, this.lines.length - startLine));
  }

  insertLine(lineIndex: number, content: string): void {
    this.lines.splice(lineIndex, 0, content);
  }

  splitLine(line: number, col: number): void {
    const current = this.getLine(line);
    this.lines[line] = current.slice(0, col);
    this.lines.splice(line + 1, 0, current.slice(col));
  }

  joinLines(line: number): void {
    if (line < this.lines.length - 1) {
      this.lines[line] = this.lines[line] + this.lines[line + 1];
      this.lines.splice(line + 1, 1);
    }
  }

  replaceContent(content: string): void {
    this.lines = content.split("\n");
  }
}
