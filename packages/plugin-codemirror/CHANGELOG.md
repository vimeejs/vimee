# @vimee/plugin-codemirror

## 0.2.0

### Minor Changes

- [#47](https://github.com/vimeejs/vimee/pull/47) [`06b0e24`](https://github.com/vimeejs/vimee/commit/06b0e244cef5f4da54f592a28d4067d8a96ca831) Thanks [@konojunya](https://github.com/konojunya)! - Add incremental search highlighting and fix visual-block selection for CodeMirror and Monaco plugins. Search matches are highlighted while typing `/query` or `?query` and cleared on confirmation. Visual-block mode now creates per-line selection ranges for proper rectangular selection. CodeMirror keydown handling uses capture phase to prevent editor default behavior.
