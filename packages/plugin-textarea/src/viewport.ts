/**
 * viewport.ts
 *
 * Utilities for computing viewport information from a textarea element.
 * Handles scroll-based viewport tracking for H/M/L motions and
 * Ctrl-U/D/B/F page scrolling.
 */

/**
 * Compute the line height of the textarea by measuring a single line.
 */
export function getLineHeight(textarea: HTMLTextAreaElement): number {
  const computed = getComputedStyle(textarea);
  const lineHeight = parseFloat(computed.lineHeight);
  if (!Number.isNaN(lineHeight) && lineHeight > 0) return lineHeight;
  // Fallback: estimate from font size * 1.2
  const fontSize = parseFloat(computed.fontSize);
  return fontSize * 1.2;
}

/**
 * Compute the number of visible lines in the textarea viewport.
 */
export function getVisibleLines(textarea: HTMLTextAreaElement): number {
  const lineHeight = getLineHeight(textarea);
  if (lineHeight <= 0) return 20;
  const computed = getComputedStyle(textarea);
  const paddingTop = parseFloat(computed.paddingTop) || 0;
  const paddingBottom = parseFloat(computed.paddingBottom) || 0;
  const usableHeight = textarea.clientHeight - paddingTop - paddingBottom;
  return Math.max(1, Math.floor(usableHeight / lineHeight));
}

/**
 * Compute the first visible line based on the textarea's scroll position.
 */
export function getTopLine(textarea: HTMLTextAreaElement): number {
  const lineHeight = getLineHeight(textarea);
  if (lineHeight <= 0) return 0;
  return Math.max(0, Math.floor(textarea.scrollTop / lineHeight));
}

/**
 * Scroll the textarea so the given line is visible.
 */
export function scrollToLine(textarea: HTMLTextAreaElement, line: number): void {
  const lineHeight = getLineHeight(textarea);
  if (lineHeight <= 0) return;

  const computed = getComputedStyle(textarea);
  const paddingTop = parseFloat(computed.paddingTop) || 0;
  const cursorTop = line * lineHeight + paddingTop;
  const cursorBottom = cursorTop + lineHeight;

  if (cursorTop < textarea.scrollTop) {
    textarea.scrollTop = cursorTop - paddingTop;
  } else if (cursorBottom > textarea.scrollTop + textarea.clientHeight) {
    textarea.scrollTop = cursorBottom - textarea.clientHeight;
  }
}
