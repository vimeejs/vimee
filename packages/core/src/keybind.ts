/**
 * keybind.ts
 *
 * Custom keybinding system for vimee.
 *
 * Provides:
 * - Key sequence parsing and validation
 * - Trie-based keybinding resolution
 * - KeybindMap class for managing custom keybindings
 */

import type { VimMode, VimAction, VimContext, BufferReader } from "./types";

// =====================
// Types
// =====================

/**
 * Type-level validation for key sequences.
 * Rejects empty strings, strings containing spaces, tabs, or newlines.
 */
export type ValidKeySequence<T extends string> = T extends ""
  ? never
  : T extends `${string} ${string}`
    ? never
    : T extends `${string}\t${string}`
      ? never
      : T extends `${string}\n${string}`
        ? never
        : T;

/**
 * Callback-style keybind definition.
 * The execute function receives a readonly context and buffer,
 * and returns an array of VimActions for the engine to process.
 */
export interface KeybindCallbackDefinition {
  execute: (ctx: Readonly<VimContext>, buffer: BufferReader) => VimAction[];
}

/**
 * Remap-style keybind definition.
 * Maps one key sequence to another (e.g., Y -> y$).
 */
export interface KeybindRemapDefinition {
  keys: string;
}

/** A keybind definition is either a callback or a remap. */
export type KeybindDefinition = KeybindCallbackDefinition | KeybindRemapDefinition;

/** Result of keybind resolution */
export type KeybindResolveResult =
  | { status: "matched"; definition: KeybindDefinition }
  | { status: "pending"; display: string }
  | { status: "none"; fallbackKey: string };

// =====================
// Trie
// =====================

interface TrieNode {
  children: Map<string, TrieNode>;
  /** Keybind definition at this node (present if this is a terminal node) */
  definition?: KeybindDefinition;
}

function createTrieNode(): TrieNode {
  return { children: new Map() };
}

// =====================
// Key sequence parsing & validation
// =====================

/** Set of recognized special key notations */
const SPECIAL_KEYS = new Set(["<Esc>", "<CR>", "<Tab>", "<BS>", "<Del>", "<Space>"]);

/**
 * Validate a single printable character.
 * Only ASCII printable characters (0x21-0x7E) are allowed.
 * Space (0x20) is excluded; use <Space> notation instead.
 */
function validateChar(ch: string): void {
  if ([...ch].length !== 1) {
    throw new Error(`Invalid key character: "${ch}" (must be a single character)`);
  }
  const code = ch.codePointAt(0)!;
  if (code < 0x21 || code > 0x7e) {
    throw new Error(
      `Invalid key character: "${ch}" (code 0x${code.toString(16)}). Only ASCII printable characters (0x21-0x7E) are allowed.`,
    );
  }
}

/**
 * Validate a special key token (e.g., <C-a>, <Esc>).
 */
function validateSpecialKey(token: string): void {
  if (/^<C-[a-z]>$/.test(token)) return;
  if (SPECIAL_KEYS.has(token)) return;
  throw new Error(
    `Unknown special key: "${token}". Valid: <C-a>..<C-z>, ${[...SPECIAL_KEYS].join(", ")}`,
  );
}

/**
 * Parse a raw key sequence string into an array of key tokens.
 *
 * Examples:
 * - "\\i"    → ["\\", "i"]
 * - "<C-w>j" → ["<C-w>", "j"]
 * - "gd"     → ["g", "d"]
 *
 * @throws Error on invalid characters, unclosed brackets, or unknown special keys
 */
export function parseKeySequence(raw: string): string[] {
  if (raw.length === 0) {
    throw new Error("Key sequence must not be empty");
  }

  const tokens: string[] = [];
  let i = 0;

  while (i < raw.length) {
    if (raw[i] === "<") {
      const close = raw.indexOf(">", i);
      if (close === -1) {
        throw new Error(`Unclosed '<' at position ${i} in key sequence "${raw}"`);
      }
      const token = raw.slice(i, close + 1);
      validateSpecialKey(token);
      tokens.push(token);
      i = close + 1;
    } else {
      validateChar(raw[i]);
      tokens.push(raw[i]);
      i += 1;
    }
  }

  if (tokens.length === 0) {
    throw new Error("Key sequence must not be empty");
  }

  return tokens;
}

/**
 * Normalize a raw keyboard event key to match our token format.
 * Handles Ctrl combinations and special key names.
 */
export function normalizeKey(key: string, ctrlKey: boolean = false): string {
  if (ctrlKey && /^[a-z]$/.test(key)) {
    return `<C-${key}>`;
  }
  switch (key) {
    case "Escape":
      return "<Esc>";
    case "Enter":
      return "<CR>";
    case "Tab":
      return "<Tab>";
    case "Backspace":
      return "<BS>";
    case "Delete":
      return "<Del>";
    case " ":
      return "<Space>";
    default:
      return key;
  }
}

// =====================
// KeybindMap
// =====================

/**
 * Manages custom keybindings using a per-mode Trie.
 *
 * This is a mutable object (like TextBuffer) that holds:
 * - The keybind Trie for each mode
 * - The pending key buffer during multi-key sequence resolution
 */
export class KeybindMap {
  /** Per-mode Trie roots */
  private tries: Map<VimMode, TrieNode> = new Map();
  /** Buffered keys during multi-key sequence resolution */
  private pendingKeys: string[] = [];

  /**
   * Register a custom keybinding.
   *
   * @param mode - The Vim mode this keybind applies to
   * @param keys - Key sequence string (validated and parsed)
   * @param definition - Callback or remap definition
   * @throws Error if the key sequence is invalid
   */
  addKeybind<T extends string>(
    mode: VimMode,
    keys: ValidKeySequence<T>,
    definition: KeybindDefinition,
  ): void {
    const tokens = parseKeySequence(keys);

    if (!this.tries.has(mode)) {
      this.tries.set(mode, createTrieNode());
    }
    const root = this.tries.get(mode)!;

    let node = root;
    for (const token of tokens) {
      if (!node.children.has(token)) {
        node.children.set(token, createTrieNode());
      }
      node = node.children.get(token)!;
    }
    node.definition = definition;
  }

  /**
   * Resolve a key input against registered keybindings.
   *
   * @param key - The raw key from KeyboardEvent.key
   * @param mode - The current Vim mode
   * @param ctrlKey - Whether Ctrl is pressed
   * @returns Resolution result: matched, pending, or none
   */
  resolve(key: string, mode: VimMode, ctrlKey: boolean = false): KeybindResolveResult {
    const normalized = normalizeKey(key, ctrlKey);
    const keys = [...this.pendingKeys, normalized];

    const root = this.tries.get(mode);
    if (!root) {
      this.pendingKeys = [];
      return { status: "none", fallbackKey: key };
    }

    // Walk the Trie with accumulated keys
    let node: TrieNode | undefined = root;
    for (const k of keys) {
      node = node?.children.get(k);
      if (!node) break;
    }

    if (node?.definition) {
      // Full match found
      this.pendingKeys = [];
      return { status: "matched", definition: node.definition };
    }

    if (node && node.children.size > 0) {
      // Partial match — more keys expected
      this.pendingKeys = keys;
      return { status: "pending", display: keys.join("") };
    }

    // No match — discard pending, let the current key fall through
    this.pendingKeys = [];
    return { status: "none", fallbackKey: key };
  }

  /** Whether there are buffered pending keys */
  isPending(): boolean {
    return this.pendingKeys.length > 0;
  }

  /** Cancel pending key sequence and reset buffer */
  cancel(): void {
    this.pendingKeys = [];
  }

  /** Check if any keybinds are registered for a given mode */
  hasKeybinds(mode: VimMode): boolean {
    const root = this.tries.get(mode);
    return root !== undefined && root.children.size > 0;
  }

  /**
   * Clear all bindings and re-register from an array.
   * Preserves pendingKeys state so multi-key sequences survive rebuilds.
   * Used by React hooks to sync declarative props to the map.
   */
  replaceAll(entries: Array<{ mode: VimMode; keys: string; definition: KeybindDefinition }>): void {
    this.tries.clear();
    // pendingKeys is NOT cleared — preserves mid-sequence state across rebuilds
    for (const entry of entries) {
      const tokens = parseKeySequence(entry.keys);
      if (!this.tries.has(entry.mode)) {
        this.tries.set(entry.mode, createTrieNode());
      }
      const root = this.tries.get(entry.mode)!;
      let node = root;
      for (const token of tokens) {
        if (!node.children.has(token)) {
          node.children.set(token, createTrieNode());
        }
        node = node.children.get(token)!;
      }
      node.definition = entry.definition;
    }
  }
}

/**
 * Create a new empty KeybindMap.
 */
export function createKeybindMap(): KeybindMap {
  return new KeybindMap();
}
