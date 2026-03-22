# @vimee/core

## 0.2.0

### Minor Changes

- [`c66f1bc`](https://github.com/vimeejs/vimee/commit/c66f1bc5757614a95206bcea099a9d66e4797c61) Thanks [@konojunya](https://github.com/konojunya)! - Add paragraph navigation ({/}), auto-indent for o/O/Enter, insert-mode Ctrl-W word deletion, E492 error for unknown ex commands, and fix cursor behavior in command-line mode. Add CSS variables for mode indicator and error colors. Fix shiki highlighter type to use generics instead of HighlighterCore.

## 0.1.1

### Patch Changes

- [`0528e08`](https://github.com/vimeejs/vimee/commit/0528e08fe68721abe80ca57640e4402dc44320a5) Thanks [@konojunya](https://github.com/konojunya)! - ### Bug Fixes

  - fix: update repo URLs to vimeejs/vimee and add missing metadata

## 0.1.0

### Minor Changes

- ### Features

  - feat: add @vimee/plugin-textarea package
  - feat(shiki-editor): add @vimee/shiki-editor package
  - feat(react): add @vimee/react package with useVim hook
  - feat(core): add all mode handlers and vim-state dispatcher
  - feat(core): add ctrl keys and insert mode
  - feat(core): add operators and char-pending commands
  - feat(core): add search and text objects
  - feat(core): add key utilities, motions, and motion resolver
  - feat(core): add TextBuffer with undo/redo support
  - feat(core): add package scaffold and type definitions

  ### Bug Fixes

  - fix: use correct GitHub workflow badge URL format
  - fix(ci): lower shiki-editor coverage threshold to 20%
  - fix(ci): fix octocov config and add workflow permissions
  - fix(ci): fix typecheck ordering, octocov config format, and type errors
  - fix(ci): fix CI failures with sequential build order and dependency builds

  ### Tests

  - test(react): add useVim hook tests with 46 test cases
  - test(core): add integration tests for all mode handlers

  ### Documentation

  - docs: add shiki-editor quick start to root README
  - docs: add icon to root README
  - docs: remove hardcoded test counts and coverage numbers from READMEs
  - docs: add READMEs for root, @vimee/core, and @vimee/react

  ### Chores

  - chore: setup changesets with auto-gen script
  - chore: setup monorepo infrastructure

  ### Other

  - refactor(shiki-editor): rename VimEditor to Vim
  - ci: add shiki-editor test job and update README
  - ci: add octocov coverage reporting and use GitHub OIDC for npm publish
  - ci: add CI and release workflows
  - Initial commit
