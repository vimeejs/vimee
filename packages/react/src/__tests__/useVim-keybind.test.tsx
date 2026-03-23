/**
 * @vitest-environment happy-dom
 */

/**
 * useVim-keybind.test.tsx
 *
 * Integration tests for addKeybind and actions exposed by useVim.
 * Tests real-world usage patterns from the React hook perspective:
 * - addKeybind returns from useVim
 * - actions returns from useVim
 * - Single-key custom keybind
 * - Multi-key leader-style keybind
 * - Insert mode jj/jk escape
 * - Override built-in keys
 * - Empty actions (external hook)
 * - Remap keybinds (Y -> y$)
 * - onAction receives custom keybind actions
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { useVim } from "../useVim";

// =====================
// Custom renderHook implementation
// =====================

interface RenderHookResult<T> {
  result: { current: T };
  rerender: () => void;
  unmount: () => void;
}

function renderHook<T>(hookFn: () => T): RenderHookResult<T> {
  const resultRef = { current: null as unknown as T };
  const container = document.createElement("div");
  document.body.appendChild(container);

  function TestComponent() {
    resultRef.current = hookFn();
    return null;
  }

  const root = createRoot(container);

  flushSync(() => {
    root.render(React.createElement(TestComponent));
  });

  return {
    result: resultRef,
    rerender: () => {
      flushSync(() => {
        root.render(React.createElement(TestComponent));
      });
    },
    unmount: () => {
      flushSync(() => {
        root.unmount();
      });
      if (container.parentNode) {
        document.body.removeChild(container);
      }
    },
  };
}

function act(fn: () => void) {
  flushSync(fn);
}

// =====================
// Helper to create mock keyboard events
// =====================

function createKeyEvent(
  key: string,
  options: { ctrlKey?: boolean; isComposing?: boolean } = {},
): React.KeyboardEvent {
  return {
    key,
    ctrlKey: options.ctrlKey ?? false,
    preventDefault: vi.fn(),
    nativeEvent: { isComposing: options.isComposing ?? false },
  } as unknown as React.KeyboardEvent;
}

// =====================
// Tests
// =====================

describe("useVim keybind integration", () => {
  // --- Hook exposes addKeybind and actions ---

  it("exposes addKeybind function", () => {
    const { result } = renderHook(() => useVim({ content: "test" }));
    expect(typeof result.current.addKeybind).toBe("function");
  });

  it("exposes actions object with helpers", () => {
    const { result } = renderHook(() => useVim({ content: "test" }));
    const { actions } = result.current;
    expect(typeof actions.cursorMove).toBe("function");
    expect(typeof actions.modeChange).toBe("function");
    expect(typeof actions.statusMessage).toBe("function");
    expect(typeof actions.registerWrite).toBe("function");
    expect(typeof actions.markSet).toBe("function");
    expect(typeof actions.contentChange).toBe("function");
    expect(typeof actions.cursorRelative).toBe("function");
    expect(typeof actions.yank).toBe("function");
    expect(typeof actions.noop).toBe("function");
  });

  // --- Single-key keybind ---

  it("executes a single-key custom keybind and updates status", () => {
    const { result } = renderHook(() => useVim({ content: "hello" }));

    act(() => {
      result.current.addKeybind("normal", "Z", {
        execute: () => [result.current.actions.statusMessage("custom Z!")],
      });
    });

    act(() => {
      result.current.handleKeyDown(createKeyEvent("Z"));
    });

    expect(result.current.statusMessage).toBe("custom Z!");
  });

  // --- Multi-key leader-style keybind ---

  it("resolves a multi-key leader-style keybind", () => {
    const externalCallback = vi.fn();
    const { result } = renderHook(() => useVim({ content: "const x = 1;" }));

    act(() => {
      result.current.addKeybind("normal", "\\i", {
        execute: () => {
          externalCallback("show type info");
          return [result.current.actions.statusMessage("type: number")];
        },
      });
    });

    // First key: pending
    act(() => {
      result.current.handleKeyDown(createKeyEvent("\\"));
    });
    expect(result.current.statusMessage).toBe("\\");

    // Second key: matched
    act(() => {
      result.current.handleKeyDown(createKeyEvent("i"));
    });
    expect(externalCallback).toHaveBeenCalledWith("show type info");
    expect(result.current.statusMessage).toBe("type: number");
  });

  // --- Insert mode: jj to escape ---

  it("supports jj in insert mode to return to normal mode", () => {
    const { result } = renderHook(() => useVim({ content: "test" }));

    act(() => {
      result.current.addKeybind("insert", "jj", {
        execute: () => [result.current.actions.modeChange("normal")],
      });
    });

    // Enter insert mode first
    act(() => {
      result.current.handleKeyDown(createKeyEvent("i"));
    });
    expect(result.current.mode).toBe("insert");

    // j -> pending
    act(() => {
      result.current.handleKeyDown(createKeyEvent("j"));
    });

    // j -> matched -> back to normal
    act(() => {
      result.current.handleKeyDown(createKeyEvent("j"));
    });
    expect(result.current.mode).toBe("normal");
  });

  // --- Insert mode: jk to escape ---

  it("supports jk in insert mode to return to normal mode", () => {
    const { result } = renderHook(() => useVim({ content: "test" }));

    act(() => {
      result.current.addKeybind("insert", "jk", {
        execute: () => [result.current.actions.modeChange("normal")],
      });
    });

    // Enter insert mode
    act(() => {
      result.current.handleKeyDown(createKeyEvent("i"));
    });
    expect(result.current.mode).toBe("insert");

    // jk -> normal
    act(() => {
      result.current.handleKeyDown(createKeyEvent("j"));
    });
    act(() => {
      result.current.handleKeyDown(createKeyEvent("k"));
    });
    expect(result.current.mode).toBe("normal");
  });

  // --- Override built-in ---

  it("overrides built-in x with custom keybind", () => {
    const { result } = renderHook(() => useVim({ content: "hello" }));

    act(() => {
      result.current.addKeybind("normal", "x", {
        execute: () => [result.current.actions.statusMessage("custom x!")],
      });
    });

    act(() => {
      result.current.handleKeyDown(createKeyEvent("x"));
    });

    // Custom keybind fires, NOT the built-in delete
    expect(result.current.statusMessage).toBe("custom x!");
    expect(result.current.content).toBe("hello"); // content unchanged
  });

  // --- Empty actions (external-only hook) ---

  it("supports empty action array for external-only hooks", () => {
    const externalFn = vi.fn();
    const { result } = renderHook(() => useVim({ content: "test" }));

    act(() => {
      result.current.addKeybind("normal", "\\h", {
        execute: () => {
          externalFn("hover triggered");
          return [];
        },
      });
    });

    act(() => {
      result.current.handleKeyDown(createKeyEvent("\\"));
    });
    act(() => {
      result.current.handleKeyDown(createKeyEvent("h"));
    });

    expect(externalFn).toHaveBeenCalledWith("hover triggered");
  });

  // --- Escape cancels pending ---

  it("cancels pending keybind on Escape", () => {
    const executeFn = vi.fn(() => []);
    const { result } = renderHook(() => useVim({ content: "test" }));

    act(() => {
      result.current.addKeybind("normal", "\\i", { execute: executeFn });
    });

    // Enter pending state
    act(() => {
      result.current.handleKeyDown(createKeyEvent("\\"));
    });

    // Escape cancels
    act(() => {
      result.current.handleKeyDown(createKeyEvent("Escape"));
    });

    expect(executeFn).not.toHaveBeenCalled();
  });

  // --- onAction receives keybind actions ---

  it("onAction callback receives actions from custom keybinds", () => {
    const onAction = vi.fn();
    const { result } = renderHook(() => useVim({ content: "test", onAction }));

    act(() => {
      result.current.addKeybind("normal", "Z", {
        execute: () => [result.current.actions.statusMessage("hello")],
      });
    });

    act(() => {
      result.current.handleKeyDown(createKeyEvent("Z"));
    });

    expect(onAction).toHaveBeenCalledWith({ type: "status-message", message: "hello" }, "Z");
  });

  // --- Remap keybind (Y -> y$) ---

  it("remaps Y to y$ and triggers yank", () => {
    const onYank = vi.fn();
    const { result } = renderHook(() =>
      useVim({ content: "hello world", cursorPosition: "1:3", onYank }),
    );

    act(() => {
      result.current.addKeybind("normal", "Y", { keys: "y$" });
    });

    act(() => {
      result.current.handleKeyDown(createKeyEvent("Y"));
    });

    expect(onYank).toHaveBeenCalledWith("llo world");
  });

  // --- Ctrl key keybind ---

  it("resolves Ctrl+s keybind", () => {
    const saveFn = vi.fn();
    const { result } = renderHook(() => useVim({ content: "test" }));

    act(() => {
      result.current.addKeybind("normal", "<C-s>", {
        execute: () => {
          saveFn();
          return [result.current.actions.statusMessage("saved")];
        },
      });
    });

    act(() => {
      result.current.handleKeyDown(createKeyEvent("s", { ctrlKey: true }));
    });

    expect(saveFn).toHaveBeenCalledOnce();
    expect(result.current.statusMessage).toBe("saved");
  });

  // --- Mode change via action updates React state ---

  it("mode-change action from keybind updates React mode state", () => {
    const onModeChange = vi.fn();
    const { result } = renderHook(() => useVim({ content: "test", onModeChange }));

    act(() => {
      result.current.addKeybind("normal", "\\e", {
        execute: () => [result.current.actions.modeChange("insert")],
      });
    });

    act(() => {
      result.current.handleKeyDown(createKeyEvent("\\"));
    });
    act(() => {
      result.current.handleKeyDown(createKeyEvent("e"));
    });

    expect(result.current.mode).toBe("insert");
    expect(onModeChange).toHaveBeenCalledWith("insert");
  });

  // --- Without any keybinds, normal behavior preserved ---

  it("works normally when no keybinds are registered", () => {
    const { result } = renderHook(() => useVim({ content: "hello" }));

    act(() => {
      result.current.handleKeyDown(createKeyEvent("x"));
    });

    // Built-in "x" deletes character
    expect(result.current.content).toBe("ello");
  });
});
