/**
 * @vitest-environment happy-dom
 */

/**
 * useVim-keybind.test.tsx
 *
 * Integration tests for declarative keybinds and commands props in useVim.
 * Tests real-world usage patterns from the React hook perspective:
 * - keybinds prop (single-key, multi-key, insert mode, override, remap, Ctrl)
 * - commands prop (user-defined ex commands)
 * - onAction receives custom keybind/command actions
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { useVim } from "../useVim";
import type { KeybindEntry, CommandEntry } from "../useVim";
import { actions } from "@vimee/core";

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
  // --- Single-key keybind ---

  it("executes a single-key custom keybind and updates status", () => {
    const keybinds: KeybindEntry[] = [
      { mode: "normal", keys: "Z", execute: () => [actions.statusMessage("custom Z!")] },
    ];
    const { result } = renderHook(() => useVim({ content: "hello", keybinds }));

    act(() => {
      result.current.handleKeyDown(createKeyEvent("Z"));
    });

    expect(result.current.statusMessage).toBe("custom Z!");
  });

  // --- Multi-key leader-style keybind ---

  it("resolves a multi-key leader-style keybind", () => {
    const externalCallback = vi.fn();
    const keybinds: KeybindEntry[] = [
      {
        mode: "normal",
        keys: "\\i",
        execute: () => {
          externalCallback("show type info");
          return [actions.statusMessage("type: number")];
        },
      },
    ];
    const { result } = renderHook(() => useVim({ content: "const x = 1;", keybinds }));

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
    const keybinds: KeybindEntry[] = [
      { mode: "insert", keys: "jj", execute: () => [actions.modeChange("normal")] },
    ];
    const { result } = renderHook(() => useVim({ content: "test", keybinds }));

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
    const keybinds: KeybindEntry[] = [
      { mode: "insert", keys: "jk", execute: () => [actions.modeChange("normal")] },
    ];
    const { result } = renderHook(() => useVim({ content: "test", keybinds }));

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
    const keybinds: KeybindEntry[] = [
      { mode: "normal", keys: "x", execute: () => [actions.statusMessage("custom x!")] },
    ];
    const { result } = renderHook(() => useVim({ content: "hello", keybinds }));

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
    const keybinds: KeybindEntry[] = [
      {
        mode: "normal",
        keys: "\\h",
        execute: () => {
          externalFn("hover triggered");
          return [];
        },
      },
    ];
    const { result } = renderHook(() => useVim({ content: "test", keybinds }));

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
    const keybinds: KeybindEntry[] = [{ mode: "normal", keys: "\\i", execute: executeFn }];
    const { result } = renderHook(() => useVim({ content: "test", keybinds }));

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
    const keybinds: KeybindEntry[] = [
      { mode: "normal", keys: "Z", execute: () => [actions.statusMessage("hello")] },
    ];
    const { result } = renderHook(() => useVim({ content: "test", onAction, keybinds }));

    act(() => {
      result.current.handleKeyDown(createKeyEvent("Z"));
    });

    expect(onAction).toHaveBeenCalledWith({ type: "status-message", message: "hello" }, "Z");
  });

  // --- Remap keybind (Y -> y$) ---

  it("remaps Y to y$ and triggers yank", () => {
    const onYank = vi.fn();
    const keybinds: KeybindEntry[] = [{ mode: "normal", keys: "Y", remap: "y$" }];
    const { result } = renderHook(() =>
      useVim({ content: "hello world", cursorPosition: "1:3", onYank, keybinds }),
    );

    act(() => {
      result.current.handleKeyDown(createKeyEvent("Y"));
    });

    expect(onYank).toHaveBeenCalledWith("llo world");
  });

  // --- Ctrl key keybind ---

  it("resolves Ctrl+s keybind", () => {
    const saveFn = vi.fn();
    const keybinds: KeybindEntry[] = [
      {
        mode: "normal",
        keys: "<C-s>",
        execute: () => {
          saveFn();
          return [actions.statusMessage("saved")];
        },
      },
    ];
    const { result } = renderHook(() => useVim({ content: "test", keybinds }));

    act(() => {
      result.current.handleKeyDown(createKeyEvent("s", { ctrlKey: true }));
    });

    expect(saveFn).toHaveBeenCalledOnce();
    expect(result.current.statusMessage).toBe("saved");
  });

  // --- Mode change via action updates React state ---

  it("mode-change action from keybind updates React mode state", () => {
    const onModeChange = vi.fn();
    const keybinds: KeybindEntry[] = [
      { mode: "normal", keys: "\\e", execute: () => [actions.modeChange("insert")] },
    ];
    const { result } = renderHook(() => useVim({ content: "test", onModeChange, keybinds }));

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
