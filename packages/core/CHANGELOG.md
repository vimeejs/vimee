# @vimee/core

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
