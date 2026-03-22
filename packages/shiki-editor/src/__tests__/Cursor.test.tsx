/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Cursor } from "../components/Cursor";
import type { VimMode } from "@vimee/core";

function renderCursorHTML(mode: VimMode) {
  return renderToStaticMarkup(
    createElement(Cursor, {
      position: { line: 0, col: 0 },
      visualCol: 0,
      mode,
      showLineNumbers: false,
      gutterWidth: 0,
    }),
  );
}

describe("Cursor", () => {
  it("is hidden in command-line mode", () => {
    const html = renderCursorHTML("command-line");
    expect(html).toContain("animation:none");
    expect(html).toContain("opacity:0");
  });

  it("uses block cursor class in command-line mode", () => {
    const html = renderCursorHTML("command-line");
    expect(html).toContain("sv-cursor-block");
  });

  it("allows blink animation in normal mode", () => {
    const html = renderCursorHTML("normal");
    // Initial render: blinking state starts true (useState default),
    // but useEffect sets it to false — SSR doesn't run effects,
    // so blinking=true and mode is not command-line → no inline animation override
    expect(html).not.toContain("animation:none");
  });

  it("uses line cursor class in insert mode", () => {
    const html = renderCursorHTML("insert");
    expect(html).toContain("sv-cursor-line");
  });
});
