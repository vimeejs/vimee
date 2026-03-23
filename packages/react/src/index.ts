// Main hook
export { useVim } from "./useVim";

// Types
export type { UseVimOptions, UseVimReturn } from "./useVim";

// Re-export commonly used types from core for convenience
export type { CursorPosition, VimMode, VimAction, VimContext } from "@vimee/core";

// Re-export keybind types and helpers from core for convenience
export type {
  ValidKeySequence,
  KeybindCallbackDefinition,
  KeybindRemapDefinition,
  KeybindDefinition,
} from "@vimee/core";
export { actions, createKeybindMap } from "@vimee/core";
