---
"@vimee/plugin-codemirror": minor
"@vimee/plugin-monaco": minor
---

Add incremental search highlighting and fix visual-block selection for CodeMirror and Monaco plugins. Search matches are highlighted while typing `/query` or `?query` and cleared on confirmation. Visual-block mode now creates per-line selection ranges for proper rectangular selection. CodeMirror keydown handling uses capture phase to prevent editor default behavior.
