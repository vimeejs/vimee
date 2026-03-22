/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusLine } from "../components/StatusLine";
import type { StatusLineProps } from "../components/StatusLine";

function renderStatusLineHTML(props: StatusLineProps) {
  return renderToStaticMarkup(createElement(StatusLine, props));
}

const defaultProps: StatusLineProps = {
  mode: "normal",
  cursor: { line: 0, col: 0 },
  statusMessage: "",
  statusError: false,
  commandLine: "",
  totalLines: 1,
};

describe("StatusLine", () => {
  describe("command-line mode display", () => {
    it("renders command input and command cursor when mode is command-line", () => {
      const html = renderStatusLineHTML({
        ...defaultProps,
        mode: "command-line",
        commandLine: ":w",
      });
      expect(html).toContain("sv-command-input");
      expect(html).toContain(":w");
      expect(html).toContain("sv-command-cursor");
    });

    it("falls back to normal status line when commandLine is empty in command-line mode", () => {
      const html = renderStatusLineHTML({
        ...defaultProps,
        mode: "command-line",
        commandLine: "",
      });
      expect(html).not.toContain("sv-command-input");
      expect(html).not.toContain("sv-command-cursor");
    });
  });

  describe("normal mode with no status", () => {
    it("does not render a mode indicator when statusMessage is empty", () => {
      const html = renderStatusLineHTML({
        ...defaultProps,
        mode: "normal",
        statusMessage: "",
      });
      expect(html).not.toContain("sv-mode-indicator");
      expect(html).not.toContain("sv-mode-normal");
      expect(html).toContain("sv-statusline");
    });
  });

  describe("insert mode status", () => {
    it("renders mode indicator with sv-mode-insert class", () => {
      const html = renderStatusLineHTML({
        ...defaultProps,
        mode: "insert",
        statusMessage: "-- INSERT --",
      });
      expect(html).toContain("sv-mode-indicator");
      expect(html).toContain("sv-mode-insert");
      expect(html).toContain("-- INSERT --");
    });
  });

  describe("error status message", () => {
    it("renders sv-status-error class instead of mode indicator class", () => {
      const html = renderStatusLineHTML({
        ...defaultProps,
        mode: "normal",
        statusMessage: "E492: Not an editor command",
        statusError: true,
      });
      expect(html).toContain("sv-status-error");
      expect(html).toContain("E492: Not an editor command");
      expect(html).not.toContain("sv-mode-indicator");
    });
  });

  describe("cursor position formatting", () => {
    it('shows "All" for a single line file', () => {
      const html = renderStatusLineHTML({
        ...defaultProps,
        cursor: { line: 0, col: 0 },
        totalLines: 1,
      });
      expect(html).toContain("1:1");
      expect(html).toContain("All");
    });

    it('shows "Top" when cursor is at line 0 of a multi-line file', () => {
      const html = renderStatusLineHTML({
        ...defaultProps,
        cursor: { line: 0, col: 5 },
        totalLines: 100,
      });
      expect(html).toContain("1:6");
      expect(html).toContain("Top");
    });

    it('shows "Bot" when cursor is at the last line', () => {
      const html = renderStatusLineHTML({
        ...defaultProps,
        cursor: { line: 99, col: 0 },
        totalLines: 100,
      });
      expect(html).toContain("100:1");
      expect(html).toContain("Bot");
    });

    it("shows percentage when cursor is in the middle", () => {
      const html = renderStatusLineHTML({
        ...defaultProps,
        cursor: { line: 49, col: 0 },
        totalLines: 100,
      });
      expect(html).toContain("50:1");
      // 49 / 99 * 100 = ~49%
      expect(html).toContain("49%");
    });

    it("shows correct percentage at 50% of file", () => {
      // line 50 out of 101 lines (0-100), 50/100 = 50%
      const html = renderStatusLineHTML({
        ...defaultProps,
        cursor: { line: 50, col: 0 },
        totalLines: 101,
      });
      expect(html).toContain("51:1");
      expect(html).toContain("50%");
    });
  });

  describe("visual mode indicator", () => {
    it("renders sv-mode-visual class for visual mode", () => {
      const html = renderStatusLineHTML({
        ...defaultProps,
        mode: "visual",
        statusMessage: "-- VISUAL --",
      });
      expect(html).toContain("sv-mode-indicator");
      expect(html).toContain("sv-mode-visual");
      expect(html).toContain("-- VISUAL --");
    });

    it("renders sv-mode-visual-line class for visual-line mode", () => {
      const html = renderStatusLineHTML({
        ...defaultProps,
        mode: "visual-line",
        statusMessage: "-- VISUAL LINE --",
      });
      expect(html).toContain("sv-mode-visual-line");
      expect(html).toContain("-- VISUAL LINE --");
    });

    it("renders sv-mode-visual-block class for visual-block mode", () => {
      const html = renderStatusLineHTML({
        ...defaultProps,
        mode: "visual-block",
        statusMessage: "-- VISUAL BLOCK --",
      });
      expect(html).toContain("sv-mode-visual-block");
      expect(html).toContain("-- VISUAL BLOCK --");
    });
  });
});
