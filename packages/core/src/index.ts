// Types
export type {
  CursorPosition,
  VimMode,
  CommandPhase,
  Operator,
  CharCommand,
  VimContext,
  VimAction,
  UndoEntry,
} from "./types";

export type { KeystrokeResult } from "./key-utils";
export type { MotionRange, MotionResult } from "./motions";

// Buffer
export { TextBuffer } from "./buffer";

// Vim state machine
export { processKeystroke, createInitialContext, parseCursorPosition } from "./vim-state";

// Key utilities
export {
  isCountKey,
  isOperator,
  isCharCommand,
  getEffectiveCount,
  isCountExplicit,
  modeChange,
  getModeStatusMessage,
  accumulateCount,
  resetContext,
} from "./key-utils";

// Motions
export { resolveMotion } from "./motion-resolver";

// Operators
export { executeOperatorOnRange, executeLineOperator } from "./operators";

// Search
export { searchInBuffer } from "./search";

// Text objects
export { resolveTextObject } from "./text-objects";
