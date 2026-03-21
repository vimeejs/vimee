/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { attach } from "../attach";

function createTextarea(value = ""): HTMLTextAreaElement {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.selectionStart = 0;
  textarea.selectionEnd = 0;
  document.body.appendChild(textarea);
  return textarea;
}

function pressKey(
  textarea: HTMLTextAreaElement,
  key: string,
  opts: Partial<KeyboardEventInit> = {},
): void {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  });
  textarea.dispatchEvent(event);
}

describe("attach", () => {
  let textarea: HTMLTextAreaElement;

  beforeEach(() => {
    // Clean up DOM between tests
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it("returns a VimTextarea handle", () => {
    textarea = createTextarea("hello");
    const vim = attach(textarea);
    expect(vim.getMode()).toBe("normal");
    expect(vim.getContent()).toBe("hello");
    expect(vim.getCursor()).toEqual({ line: 0, col: 0 });
    vim.destroy();
  });

  it("sets data-vimee-mode attribute", () => {
    textarea = createTextarea("hello");
    const vim = attach(textarea);
    expect(textarea.dataset.vimeeMode).toBe("normal");
    vim.destroy();
  });

  it("removes data-vimee-mode on destroy", () => {
    textarea = createTextarea("hello");
    const vim = attach(textarea);
    vim.destroy();
    expect(textarea.dataset.vimeeMode).toBeUndefined();
  });

  it("enters insert mode with i", () => {
    textarea = createTextarea("hello");
    const onModeChange = vi.fn();
    const vim = attach(textarea, { onModeChange });

    pressKey(textarea, "i");

    expect(vim.getMode()).toBe("insert");
    expect(textarea.dataset.vimeeMode).toBe("insert");
    expect(onModeChange).toHaveBeenCalledWith("insert");
    vim.destroy();
  });

  it("exits insert mode with Escape", () => {
    textarea = createTextarea("hello");
    const vim = attach(textarea);

    pressKey(textarea, "i");
    expect(vim.getMode()).toBe("insert");

    pressKey(textarea, "Escape");
    expect(vim.getMode()).toBe("normal");
    vim.destroy();
  });

  it("moves cursor with h/j/k/l", () => {
    textarea = createTextarea("hello\nworld");
    const vim = attach(textarea);

    pressKey(textarea, "l");
    expect(vim.getCursor().col).toBe(1);

    pressKey(textarea, "j");
    expect(vim.getCursor().line).toBe(1);

    pressKey(textarea, "h");
    expect(vim.getCursor().col).toBe(0);

    pressKey(textarea, "k");
    expect(vim.getCursor().line).toBe(0);

    vim.destroy();
  });

  it("fires onChange on content change", () => {
    textarea = createTextarea("hello");
    const onChange = vi.fn();
    const vim = attach(textarea, { onChange });

    // Delete a character with x
    pressKey(textarea, "x");

    expect(onChange).toHaveBeenCalledWith("ello");
    expect(textarea.value).toBe("ello");
    vim.destroy();
  });

  it("fires onSave on :w", () => {
    textarea = createTextarea("hello");
    const onSave = vi.fn();
    const vim = attach(textarea, { onSave });

    pressKey(textarea, ":");
    pressKey(textarea, "w");
    pressKey(textarea, "Enter");

    expect(onSave).toHaveBeenCalledWith("hello");
    vim.destroy();
  });

  it("handles dd to delete a line", () => {
    textarea = createTextarea("first\nsecond\nthird");
    const onChange = vi.fn();
    const vim = attach(textarea, { onChange });

    pressKey(textarea, "d");
    pressKey(textarea, "d");

    expect(vim.getContent()).toBe("second\nthird");
    expect(onChange).toHaveBeenCalled();
    vim.destroy();
  });

  it("does not process keys during IME composition", () => {
    textarea = createTextarea("hello");
    const vim = attach(textarea);

    // Simulate compositionstart
    textarea.dispatchEvent(new Event("compositionstart"));

    // These keys should be ignored
    pressKey(textarea, "d");
    pressKey(textarea, "d");

    expect(vim.getContent()).toBe("hello");

    // Simulate compositionend
    textarea.dispatchEvent(new Event("compositionend"));

    // Now keys work again
    pressKey(textarea, "x");
    expect(vim.getContent()).toBe("ello");

    vim.destroy();
  });

  it("prevents default for keys in normal mode", () => {
    textarea = createTextarea("hello");
    const vim = attach(textarea);

    const event = new KeyboardEvent("keydown", {
      key: "j",
      bubbles: true,
      cancelable: true,
    });
    const spy = vi.spyOn(event, "preventDefault");
    textarea.dispatchEvent(event);

    expect(spy).toHaveBeenCalled();
    vim.destroy();
  });

  it("supports readOnly mode", () => {
    textarea = createTextarea("hello");
    const vim = attach(textarea, { readOnly: true });

    pressKey(textarea, "x");
    expect(vim.getContent()).toBe("hello");

    // Motions still work
    pressKey(textarea, "l");
    expect(vim.getCursor().col).toBe(1);

    vim.destroy();
  });

  it("handles Ctrl-D/U for scrolling", () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");
    textarea = createTextarea(lines);
    const vim = attach(textarea);

    // Ctrl-D should move cursor down
    pressKey(textarea, "d", { ctrlKey: true });
    expect(vim.getCursor().line).toBeGreaterThan(0);

    vim.destroy();
  });

  it("cleans up all event listeners on destroy", () => {
    textarea = createTextarea("hello");
    const removeSpy = vi.spyOn(textarea, "removeEventListener");
    const vim = attach(textarea);
    vim.destroy();

    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("compositionstart", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("compositionend", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("scroll", expect.any(Function));
  });
});
