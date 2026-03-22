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

  it("inserts text in insert mode", () => {
    textarea = createTextarea("hello");
    const onChange = vi.fn();
    const vim = attach(textarea, { onChange });

    // Enter insert mode
    pressKey(textarea, "i");
    expect(vim.getMode()).toBe("insert");

    // Type characters
    pressKey(textarea, "H");
    pressKey(textarea, "i");

    expect(vim.getContent()).toBe("Hihello");
    expect(textarea.value).toBe("Hihello");
    expect(onChange).toHaveBeenLastCalledWith("Hihello");
    vim.destroy();
  });

  it("inserts indentation when Tab is pressed in insert mode", () => {
    textarea = createTextarea("hello");
    const vim = attach(textarea);

    pressKey(textarea, "i");

    // Press Tab — default indentation is 2 spaces
    const tabEvent = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    const preventSpy = vi.spyOn(tabEvent, "preventDefault");
    textarea.dispatchEvent(tabEvent);

    expect(preventSpy).toHaveBeenCalled();
    expect(vim.getContent()).toBe("  hello");
    expect(vim.getCursor().col).toBe(2);
    vim.destroy();
  });

  it("inserts a newline when Enter is pressed in insert mode", () => {
    textarea = createTextarea("hello");
    const vim = attach(textarea);

    // Move to col 3 with lll, then enter insert mode with i
    pressKey(textarea, "l");
    pressKey(textarea, "l");
    pressKey(textarea, "l");
    pressKey(textarea, "i");

    pressKey(textarea, "Enter");

    expect(vim.getContent()).toBe("hel\nlo");
    expect(vim.getCursor().line).toBe(1);
    vim.destroy();
  });

  it("deletes a character when Backspace is pressed in insert mode", () => {
    textarea = createTextarea("hello");
    const vim = attach(textarea);

    // Position cursor at col 3, then enter insert mode (cursor stays at col 3)
    pressKey(textarea, "l");
    pressKey(textarea, "l");
    pressKey(textarea, "l");
    pressKey(textarea, "i");

    pressKey(textarea, "Backspace");

    expect(vim.getContent()).toBe("helo");
    expect(vim.getCursor().col).toBe(2);
    vim.destroy();
  });

  it("does not prevent default for modifier-only keys in normal mode", () => {
    textarea = createTextarea("hello");
    const vim = attach(textarea);

    for (const key of ["Shift", "Control", "Alt", "Meta"]) {
      const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
      });
      const spy = vi.spyOn(event, "preventDefault");
      textarea.dispatchEvent(event);

      expect(spy).not.toHaveBeenCalled();
    }

    // Content unchanged — modifier keys are no-ops
    expect(vim.getContent()).toBe("hello");
    vim.destroy();
  });

  it("does not prevent default for Ctrl-C and Ctrl-A in normal mode", () => {
    textarea = createTextarea("hello");
    const vim = attach(textarea);

    // Ctrl-C (copy)
    const ctrlC = new KeyboardEvent("keydown", {
      key: "c",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    const spyC = vi.spyOn(ctrlC, "preventDefault");
    textarea.dispatchEvent(ctrlC);
    expect(spyC).not.toHaveBeenCalled();

    // Ctrl-A (select all)
    const ctrlA = new KeyboardEvent("keydown", {
      key: "a",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    const spyA = vi.spyOn(ctrlA, "preventDefault");
    textarea.dispatchEvent(ctrlA);
    expect(spyA).not.toHaveBeenCalled();

    // Content should not be modified
    expect(vim.getContent()).toBe("hello");
    vim.destroy();
  });

  it("calls onAction callback with the correct action and key", () => {
    textarea = createTextarea("hello");
    const onAction = vi.fn();
    const vim = attach(textarea);

    // Re-attach with onAction to capture actions
    vim.destroy();
    const vim2 = attach(textarea, { onAction });

    // Delete a character with x — should produce a content-change action
    pressKey(textarea, "x");

    expect(onAction).toHaveBeenCalled();
    const calls = onAction.mock.calls;
    const contentChangeCall = calls.find(
      ([action]: [{ type: string }]) => action.type === "content-change",
    );
    expect(contentChangeCall).toBeDefined();
    expect(contentChangeCall![1]).toBe("x");
    vim2.destroy();
  });

  it("calls onYank callback when yy yanks a line", () => {
    textarea = createTextarea("first\nsecond\nthird");
    const onYank = vi.fn();
    const vim = attach(textarea, { onYank });

    // yy yanks the current line
    pressKey(textarea, "y");
    pressKey(textarea, "y");

    expect(onYank).toHaveBeenCalledWith("first\n");
    // Content should be unchanged — yank does not delete
    expect(vim.getContent()).toBe("first\nsecond\nthird");
    vim.destroy();
  });

  it("updates data-vimee-mode to visual when v is pressed", () => {
    textarea = createTextarea("hello");
    const onModeChange = vi.fn();
    const vim = attach(textarea, { onModeChange });

    pressKey(textarea, "v");

    expect(vim.getMode()).toBe("visual");
    expect(textarea.dataset.vimeeMode).toBe("visual");
    expect(onModeChange).toHaveBeenCalledWith("visual");
    vim.destroy();
  });

  it("restores content after dw followed by undo", () => {
    textarea = createTextarea("hello world");
    const vim = attach(textarea);

    // dw deletes from cursor to start of next word
    pressKey(textarea, "d");
    pressKey(textarea, "w");

    expect(vim.getContent()).toBe("world");

    // u undoes the deletion
    pressKey(textarea, "u");

    expect(vim.getContent()).toBe("hello world");
    vim.destroy();
  });

  it("enters command-line mode when / is pressed for search", () => {
    textarea = createTextarea("hello world");
    const onModeChange = vi.fn();
    const vim = attach(textarea, { onModeChange });

    pressKey(textarea, "/");

    expect(vim.getMode()).toBe("command-line");
    expect(textarea.dataset.vimeeMode).toBe("command-line");
    vim.destroy();
  });

  it("handles scroll event without crashing (viewport sync)", () => {
    textarea = createTextarea("hello\nworld\nfoo\nbar");
    const vim = attach(textarea);

    // Dispatch a scroll event — should not throw
    const scrollEvent = new Event("scroll", { bubbles: true });
    expect(() => textarea.dispatchEvent(scrollEvent)).not.toThrow();

    // Vim state remains valid after scroll
    expect(vim.getMode()).toBe("normal");
    expect(vim.getContent()).toBe("hello\nworld\nfoo\nbar");
    vim.destroy();
  });
});
