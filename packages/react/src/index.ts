// Main hook
export { useVim } from "./useVim";

// Types
export type { UseVimOptions, UseVimReturn, KeybindEntry, CommandEntry } from "./useVim";

// Re-export commonly used types from core for convenience
export type { CursorPosition, VimMode, VimAction, VimContext } from "@vimee/core";

// Re-export keybind types from core
export type {
  ValidKeySequence,
  KeybindCallbackDefinition,
  KeybindRemapDefinition,
  KeybindDefinition,
} from "@vimee/core";

// Re-export command types from core
export type { CommandDefinition } from "@vimee/core";

// Re-export helpers from core
export { actions, createKeybindMap, createCommandMap } from "@vimee/core";
