/**
 * keybind.test.ts
 *
 * Tests for the custom keybinding system:
 * - parseKeySequence: key sequence parsing and validation
 * - normalizeKey: keyboard event normalization
 * - KeybindMap: Trie-based keybind resolution, multi-key sequences, pending state
 */

import { describe, it, expect } from "vitest";
import { parseKeySequence, normalizeKey, createKeybindMap } from "../keybind";

// =====================
// parseKeySequence
// =====================

describe("parseKeySequence", () => {
  it("parses single characters", () => {
    expect(parseKeySequence("a")).toEqual(["a"]);
    expect(parseKeySequence("Z")).toEqual(["Z"]);
    expect(parseKeySequence("1")).toEqual(["1"]);
  });

  it("parses multi-character sequences", () => {
    expect(parseKeySequence("gd")).toEqual(["g", "d"]);
    expect(parseKeySequence("\\i")).toEqual(["\\", "i"]);
    expect(parseKeySequence("abc")).toEqual(["a", "b", "c"]);
  });

  it("parses special key notations", () => {
    expect(parseKeySequence("<Esc>")).toEqual(["<Esc>"]);
    expect(parseKeySequence("<CR>")).toEqual(["<CR>"]);
    expect(parseKeySequence("<Tab>")).toEqual(["<Tab>"]);
    expect(parseKeySequence("<BS>")).toEqual(["<BS>"]);
    expect(parseKeySequence("<Del>")).toEqual(["<Del>"]);
    expect(parseKeySequence("<Space>")).toEqual(["<Space>"]);
  });

  it("parses Ctrl combinations", () => {
    expect(parseKeySequence("<C-a>")).toEqual(["<C-a>"]);
    expect(parseKeySequence("<C-w>")).toEqual(["<C-w>"]);
    expect(parseKeySequence("<C-z>")).toEqual(["<C-z>"]);
  });

  it("parses mixed sequences", () => {
    expect(parseKeySequence("<C-w>j")).toEqual(["<C-w>", "j"]);
    expect(parseKeySequence("g<C-a>")).toEqual(["g", "<C-a>"]);
    expect(parseKeySequence("\\<CR>")).toEqual(["\\", "<CR>"]);
  });

  it("parses symbols correctly", () => {
    expect(parseKeySequence("\\")).toEqual(["\\"]);
    expect(parseKeySequence("/")).toEqual(["/"]);
    expect(parseKeySequence(".")).toEqual(["."]);
    expect(parseKeySequence(",")).toEqual([","]);
    expect(parseKeySequence(";")).toEqual([";"]);
    expect(parseKeySequence("!")).toEqual(["!"]);
    expect(parseKeySequence("@")).toEqual(["@"]);
    expect(parseKeySequence("#")).toEqual(["#"]);
  });

  // --- Validation errors ---

  it("throws on empty string", () => {
    expect(() => parseKeySequence("")).toThrow("must not be empty");
  });

  it("throws on space character", () => {
    expect(() => parseKeySequence(" ")).toThrow("Invalid key character");
    expect(() => parseKeySequence("a b")).toThrow("Invalid key character");
  });

  it("throws on control characters", () => {
    expect(() => parseKeySequence("\t")).toThrow("Invalid key character");
    expect(() => parseKeySequence("\n")).toThrow("Invalid key character");
  });

  it("throws on emoji", () => {
    expect(() => parseKeySequence("🎉")).toThrow("Invalid key character");
  });

  it("throws on unclosed angle bracket", () => {
    expect(() => parseKeySequence("<C-a")).toThrow("Unclosed '<'");
  });

  it("throws on unknown special key", () => {
    expect(() => parseKeySequence("<C-1>")).toThrow("Unknown special key");
    expect(() => parseKeySequence("<Foo>")).toThrow("Unknown special key");
    expect(() => parseKeySequence("<C-A>")).toThrow("Unknown special key");
  });
});

// =====================
// normalizeKey
// =====================

describe("normalizeKey", () => {
  it("normalizes regular keys unchanged", () => {
    expect(normalizeKey("a")).toBe("a");
    expect(normalizeKey("Z")).toBe("Z");
    expect(normalizeKey("1")).toBe("1");
  });

  it("normalizes Ctrl+key to <C-x> format", () => {
    expect(normalizeKey("a", true)).toBe("<C-a>");
    expect(normalizeKey("w", true)).toBe("<C-w>");
    expect(normalizeKey("z", true)).toBe("<C-z>");
  });

  it("does not normalize Ctrl with non-lowercase", () => {
    expect(normalizeKey("A", true)).toBe("A");
    expect(normalizeKey("1", true)).toBe("1");
  });

  it("normalizes special key names", () => {
    expect(normalizeKey("Escape")).toBe("<Esc>");
    expect(normalizeKey("Enter")).toBe("<CR>");
    expect(normalizeKey("Tab")).toBe("<Tab>");
    expect(normalizeKey("Backspace")).toBe("<BS>");
    expect(normalizeKey("Delete")).toBe("<Del>");
    expect(normalizeKey(" ")).toBe("<Space>");
  });
});

// =====================
// KeybindMap
// =====================

describe("KeybindMap", () => {
  // --- Basic registration and resolution ---

  it("creates an empty keybind map", () => {
    const map = createKeybindMap();
    expect(map.isPending()).toBe(false);
    expect(map.hasKeybinds("normal")).toBe(false);
  });

  it("registers and resolves a single-key keybind", () => {
    const map = createKeybindMap();
    const execute = () => [];
    map.addKeybind("normal", "Y", { execute });

    expect(map.hasKeybinds("normal")).toBe(true);
    const result = map.resolve("Y", "normal");
    expect(result.status).toBe("matched");
    if (result.status === "matched") {
      expect(result.definition).toEqual({ execute });
    }
  });

  it("returns none for unregistered keys", () => {
    const map = createKeybindMap();
    map.addKeybind("normal", "Y", { execute: () => [] });

    const result = map.resolve("Z", "normal");
    expect(result.status).toBe("none");
    if (result.status === "none") {
      expect(result.fallbackKey).toBe("Z");
    }
  });

  it("resolves keybinds only for the registered mode", () => {
    const map = createKeybindMap();
    map.addKeybind("normal", "Y", { execute: () => [] });

    const result = map.resolve("Y", "insert");
    expect(result.status).toBe("none");
  });

  // --- Multi-key sequences ---

  it("resolves a two-key sequence", () => {
    const map = createKeybindMap();
    const execute = () => [];
    map.addKeybind("normal", "\\i", { execute });

    // First key: pending
    const r1 = map.resolve("\\", "normal");
    expect(r1.status).toBe("pending");
    expect(map.isPending()).toBe(true);

    // Second key: matched
    const r2 = map.resolve("i", "normal");
    expect(r2.status).toBe("matched");
    expect(map.isPending()).toBe(false);
  });

  it("resolves a three-key sequence", () => {
    const map = createKeybindMap();
    const execute = () => [];
    map.addKeybind("normal", "\\ga", { execute });

    expect(map.resolve("\\", "normal").status).toBe("pending");
    expect(map.resolve("g", "normal").status).toBe("pending");
    expect(map.resolve("a", "normal").status).toBe("matched");
  });

  it("falls through on non-matching second key", () => {
    const map = createKeybindMap();
    map.addKeybind("normal", "\\i", { execute: () => [] });

    // First key: pending
    const r1 = map.resolve("\\", "normal");
    expect(r1.status).toBe("pending");

    // Second key that doesn't match: fall through
    const r2 = map.resolve("x", "normal");
    expect(r2.status).toBe("none");
    if (r2.status === "none") {
      expect(r2.fallbackKey).toBe("x");
    }
    expect(map.isPending()).toBe(false);
  });

  it("disambiguates between overlapping prefixes", () => {
    const map = createKeybindMap();
    const executeI = () => [{ type: "noop" as const }];
    const executeF = () => [{ type: "noop" as const }];
    map.addKeybind("normal", "\\i", { execute: executeI });
    map.addKeybind("normal", "\\f", { execute: executeF });

    // First key: pending (shared prefix)
    expect(map.resolve("\\", "normal").status).toBe("pending");

    // "i" matches first binding
    const r = map.resolve("i", "normal");
    expect(r.status).toBe("matched");
    if (r.status === "matched") {
      expect(r.definition).toEqual({ execute: executeI });
    }
  });

  // --- Cancel and Escape ---

  it("cancels pending state", () => {
    const map = createKeybindMap();
    map.addKeybind("normal", "\\i", { execute: () => [] });

    map.resolve("\\", "normal"); // pending
    expect(map.isPending()).toBe(true);

    map.cancel();
    expect(map.isPending()).toBe(false);
  });

  // --- Special keys ---

  it("resolves Ctrl key combinations", () => {
    const map = createKeybindMap();
    const execute = () => [];
    map.addKeybind("normal", "<C-s>", { execute });

    const result = map.resolve("s", "normal", true);
    expect(result.status).toBe("matched");
  });

  it("resolves special key notations via normalizeKey", () => {
    const map = createKeybindMap();
    const execute = () => [];
    map.addKeybind("insert", "<Esc>", { execute });

    const result = map.resolve("Escape", "insert");
    expect(result.status).toBe("matched");
  });

  // --- Remap definitions ---

  it("registers and resolves remap-style keybinds", () => {
    const map = createKeybindMap();
    map.addKeybind("normal", "Y", { keys: "y$" });

    const result = map.resolve("Y", "normal");
    expect(result.status).toBe("matched");
    if (result.status === "matched") {
      expect("keys" in result.definition).toBe(true);
    }
  });

  // --- Validation on addKeybind ---

  it("throws on invalid key sequence in addKeybind", () => {
    const map = createKeybindMap();
    expect(() => map.addKeybind("normal", "" as string, { execute: () => [] })).toThrow();
  });

  // --- Multiple modes ---

  it("supports different keybinds per mode", () => {
    const map = createKeybindMap();
    const normalExec = () => [{ type: "noop" as const }];
    const insertExec = () => [{ type: "noop" as const }];
    map.addKeybind("normal", "\\i", { execute: normalExec });
    map.addKeybind("insert", "\\i", { execute: insertExec });

    map.resolve("\\", "normal");
    const r1 = map.resolve("i", "normal");
    expect(r1.status).toBe("matched");
    if (r1.status === "matched") {
      expect(r1.definition).toEqual({ execute: normalExec });
    }

    map.resolve("\\", "insert");
    const r2 = map.resolve("i", "insert");
    expect(r2.status).toBe("matched");
    if (r2.status === "matched") {
      expect(r2.definition).toEqual({ execute: insertExec });
    }
  });

  // --- Overwrite existing keybind ---

  it("overwrites an existing keybind for the same key", () => {
    const map = createKeybindMap();
    const first = () => [{ type: "noop" as const }];
    const second = () => [{ type: "status-message" as const, message: "overwritten" }];
    map.addKeybind("normal", "Y", { execute: first });
    map.addKeybind("normal", "Y", { execute: second });

    const result = map.resolve("Y", "normal");
    expect(result.status).toBe("matched");
    if (result.status === "matched") {
      expect(result.definition).toEqual({ execute: second });
    }
  });
});
