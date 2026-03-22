# @vimee/shiki-editor

## 0.2.0

### Minor Changes

- [`c66f1bc`](https://github.com/vimeejs/vimee/commit/c66f1bc5757614a95206bcea099a9d66e4797c61) Thanks [@konojunya](https://github.com/konojunya)! - Add paragraph navigation ({/}), auto-indent for o/O/Enter, insert-mode Ctrl-W word deletion, E492 error for unknown ex commands, and fix cursor behavior in command-line mode. Add CSS variables for mode indicator and error colors. Fix shiki highlighter type to use generics instead of HighlighterCore.

## 0.1.3

### Patch Changes

- [`f81439c`](https://github.com/vimeejs/vimee/commit/f81439ceaa7b025c90d56300cde25ff5ea2ecbd3) Thanks [@konojunya](https://github.com/konojunya)! - Fix editor auto-scroll by adding `height: 100%` to `.sv-container`. Without this, the code area expanded to fit all content and `overflow: auto` never triggered, breaking auto-scroll on cursor movement (G, gg, search), H/M/L viewport motions, and Ctrl-F/B/U/D page scrolling.

## 0.1.2

### Patch Changes

- Fix peerDependencies using workspace:\* which caused install failures for npm consumers

## 0.1.1

### Patch Changes

- [`0528e08`](https://github.com/vimeejs/vimee/commit/0528e08fe68721abe80ca57640e4402dc44320a5) Thanks [@konojunya](https://github.com/konojunya)! - ### Bug Fixes

  - fix: update repo URLs to vimeejs/vimee and add missing metadata

- Updated dependencies [[`0528e08`](https://github.com/vimeejs/vimee/commit/0528e08fe68721abe80ca57640e4402dc44320a5)]:
  - @vimee/core@0.1.1
  - @vimee/react@0.1.1

## 1.0.0

### Patch Changes

- Updated dependencies []:
  - @vimee/core@0.1.0
  - @vimee/react@1.0.0
