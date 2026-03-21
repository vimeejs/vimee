/**
 * @vimee/shiki-editor
 *
 * A vim-powered code editor component with Shiki syntax highlighting.
 *
 * @example
 * ```tsx
 * import { Vim } from '@vimee/shiki-editor'
 * import '@vimee/shiki-editor/styles.css'
 * import { createHighlighter } from 'shiki'
 *
 * const highlighter = await createHighlighter({
 *   themes: ['vitesse-dark'],
 *   langs: ['typescript'],
 * })
 *
 * <Vim
 *   content={code}
 *   highlighter={highlighter}
 *   lang="typescript"
 *   theme="vitesse-dark"
 * />
 * ```
 */

// Main component
export { Vim } from "./Vim";
export type { VimProps } from "./Vim";

// Helper exports for custom implementations
export { computeSelectionInfo } from "./Vim";

// Hooks
export { useShikiTokens } from "./hooks/useShikiTokens";
export type { ShikiTokenResult } from "./hooks/useShikiTokens";

// Sub-components (for advanced customization)
export { Cursor } from "./components/Cursor";
export type { CursorProps } from "./components/Cursor";
export { Line } from "./components/Line";
export type { LineProps } from "./components/Line";
export { StatusLine } from "./components/StatusLine";
export type { StatusLineProps } from "./components/StatusLine";

// Re-export types from core for convenience
export type { CursorPosition, VimMode, VimAction, VimContext } from "@vimee/core";
export type { UseVimOptions, UseVimReturn } from "@vimee/react";
