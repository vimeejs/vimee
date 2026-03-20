// Main hook
export { useVim } from "./useVim";

// Types
export type { UseVimOptions, UseVimReturn } from "./useVim";

// Re-export commonly used types from core for convenience
export type {
  CursorPosition,
  VimMode,
  VimAction,
  VimContext,
} from "@vimee/core";
