/**
 * Line.tsx
 *
 * Component that renders a single line of the editor.
 * Receives a Shiki token sequence and renders it as colored spans.
 *
 * Also handles visual mode selection and search highlighting.
 */

import type { ThemedToken } from "shiki";

export interface LineProps {
  /** Line number (0-based) */
  lineIndex: number;
  /** Shiki token sequence for this line */
  tokens: ThemedToken[];
  /** Whether to display line numbers */
  showLineNumbers: boolean;
  /** Total number of lines (for calculating line number digit width) */
  totalLines: number;
  /** Whether this line is selected (for visual mode) */
  isSelected: boolean;
  /** Selection start column within the line (for character-wise selection) */
  selectionStartCol?: number;
  /** Selection end column within the line (for character-wise selection) */
  selectionEndCol?: number;
  /** Search match ranges on this line as [startCol, endCol] pairs */
  searchMatches?: [number, number][];
}

/**
 * Renders a single line of the editor.
 *
 * Composed of a line number and a token sequence.
 * Empty lines contain an invisible space to maintain height.
 */
export function Line({
  lineIndex,
  tokens,
  showLineNumbers,
  totalLines,
  isSelected,
  selectionStartCol,
  selectionEndCol,
  searchMatches,
}: LineProps) {
  const gutterWidth = String(totalLines).length;

  return (
    <div className="sv-line" data-line={lineIndex}>
      {/* Line number gutter */}
      {showLineNumbers && (
        <span className="sv-line-number" style={{ minWidth: `${gutterWidth + 1}ch` }}>
          {lineIndex + 1}
        </span>
      )}

      {/* Line content */}
      <span className="sv-line-content">
        {tokens.length === 0 || (tokens.length === 1 && tokens[0].content === "") ? (
          <span>{"\n"}</span>
        ) : (
          renderTokens(tokens, isSelected, selectionStartCol, selectionEndCol, searchMatches)
        )}
      </span>
    </div>
  );
}

/**
 * Render the token sequence as spans.
 * If there is a selection, apply selection styles to the range.
 */
function renderTokens(
  tokens: ThemedToken[],
  isSelected: boolean,
  selectionStartCol?: number,
  selectionEndCol?: number,
  searchMatches?: [number, number][],
): React.ReactNode[] {
  // Entire line is selected (visual-line mode)
  if (isSelected && selectionStartCol === undefined) {
    return tokens.map((token, i) => (
      <span key={i} className="sv-token sv-selected" style={{ color: token.color }}>
        {token.content}
      </span>
    ));
  }

  // Character-wise selection present: split tokens and highlight
  if (selectionStartCol !== undefined && selectionEndCol !== undefined) {
    return renderTokensWithSelection(tokens, selectionStartCol, selectionEndCol);
  }

  // Search match highlighting
  if (searchMatches && searchMatches.length > 0) {
    return renderTokensWithSearch(tokens, searchMatches);
  }

  // Normal rendering
  return tokens.map((token, i) => (
    <span key={i} className="sv-token" style={{ color: token.color }}>
      {token.content}
    </span>
  ));
}

/**
 * Token rendering when character-wise selection is present.
 * When token boundaries and selection boundaries do not align,
 * tokens are split and the selected portions are given a CSS class.
 */
function renderTokensWithSelection(
  tokens: ThemedToken[],
  selStart: number,
  selEnd: number,
): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let col = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const tokenStart = col;
    const tokenEnd = col + token.content.length;

    if (tokenEnd <= selStart || tokenStart >= selEnd) {
      result.push(
        <span key={`${i}`} className="sv-token" style={{ color: token.color }}>
          {token.content}
        </span>,
      );
    } else if (tokenStart >= selStart && tokenEnd <= selEnd) {
      result.push(
        <span key={`${i}`} className="sv-token sv-selected" style={{ color: token.color }}>
          {token.content}
        </span>,
      );
    } else {
      const parts = splitTokenBySelection(token, tokenStart, selStart, selEnd);
      parts.forEach((part, j) => {
        result.push(
          <span
            key={`${i}-${j}`}
            className={`sv-token${part.selected ? " sv-selected" : ""}`}
            style={{ color: token.color }}
          >
            {part.content}
          </span>,
        );
      });
    }

    col = tokenEnd;
  }

  return result;
}

/**
 * Split a token by the selection range.
 */
export function splitTokenBySelection(
  token: ThemedToken,
  tokenStart: number,
  selStart: number,
  selEnd: number,
): { content: string; selected: boolean }[] {
  const parts: { content: string; selected: boolean }[] = [];
  const text = token.content;
  const relSelStart = Math.max(0, selStart - tokenStart);
  const relSelEnd = Math.min(text.length, selEnd - tokenStart);

  if (relSelStart > 0) {
    parts.push({ content: text.slice(0, relSelStart), selected: false });
  }

  if (relSelEnd > relSelStart) {
    parts.push({
      content: text.slice(relSelStart, relSelEnd),
      selected: true,
    });
  }

  if (relSelEnd < text.length) {
    parts.push({ content: text.slice(relSelEnd), selected: false });
  }

  return parts;
}

/**
 * Render tokens with search match highlighting.
 * Splits tokens at match boundaries and applies the sv-search-match class.
 */
function renderTokensWithSearch(
  tokens: ThemedToken[],
  matches: [number, number][],
): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  let col = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const tokenStart = col;
    const tokenEnd = col + token.content.length;

    const overlapping = matches.filter(([ms, me]) => ms < tokenEnd && me > tokenStart);

    if (overlapping.length === 0) {
      result.push(
        <span key={`${i}`} className="sv-token" style={{ color: token.color }}>
          {token.content}
        </span>,
      );
    } else {
      let pos = 0;
      for (const [ms, me] of overlapping) {
        const relStart = Math.max(0, ms - tokenStart);
        const relEnd = Math.min(token.content.length, me - tokenStart);

        if (relStart > pos) {
          result.push(
            <span key={`${i}-b${pos}`} className="sv-token" style={{ color: token.color }}>
              {token.content.slice(pos, relStart)}
            </span>,
          );
        }
        result.push(
          <span
            key={`${i}-m${relStart}`}
            className="sv-token sv-search-match"
            style={{ color: token.color }}
          >
            {token.content.slice(relStart, relEnd)}
          </span>,
        );
        pos = relEnd;
      }
      if (pos < token.content.length) {
        result.push(
          <span key={`${i}-a${pos}`} className="sv-token" style={{ color: token.color }}>
            {token.content.slice(pos)}
          </span>,
        );
      }
    }

    col = tokenEnd;
  }

  return result;
}
