/**
 * useShikiTokens.ts
 *
 * A custom hook that uses a Shiki Highlighter instance
 * to convert content into a sequence of tokens.
 *
 * Uses codeToTokens() to obtain tokens for each line (with color and style information).
 * Also retrieves the theme's background color here.
 */

import { useMemo } from "react";
import type { HighlighterGeneric, ThemedToken } from "shiki/types";

/** Token sequence and theme colors */
export interface ShikiTokenResult {
  /** Token sequence for each line */
  tokenLines: ThemedToken[][];
  /** Theme background color */
  bgColor: string;
  /** Theme foreground color (default text color) */
  fgColor: string;
}

/**
 * Tokenize content using Shiki.
 *
 * @param highlighter - Shiki Highlighter instance
 * @param content - Content to tokenize
 * @param lang - Programming language
 * @param theme - Color theme
 * @param extraOptions - Additional options passed to codeToTokens
 */
export function useShikiTokens<L extends string, T extends string>(
  highlighter: HighlighterGeneric<L, T>,
  content: string,
  lang: L,
  theme: T,
  extraOptions?: Record<string, unknown>,
): ShikiTokenResult {
  return useMemo(() => {
    try {
      const result = highlighter.codeToTokens(content, {
        lang,
        theme,
        ...extraOptions,
      });

      const bgColor = result.bg ?? "#1e1e1e";
      const fgColor = result.fg ?? "#d4d4d4";

      return {
        tokenLines: result.tokens,
        bgColor,
        fgColor,
      };
    } catch {
      // Fallback: if tokenization fails, display as plain text
      const lines = content.split("\n");
      const tokenLines: ThemedToken[][] = lines.map((line) => [
        {
          content: line,
          offset: 0,
        } as ThemedToken,
      ]);

      return {
        tokenLines,
        bgColor: "#1e1e1e",
        fgColor: "#d4d4d4",
      };
    }
  }, [highlighter, content, lang, theme, extraOptions]);
}
