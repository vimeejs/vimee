# CLAUDE.md

## Project

vimee — headless Vim engine for the web. TypeScript monorepo (Bun workspaces).

## Packages

- `@vimee/core` — Vim engine (pure functions, no DOM)
- `@vimee/react` — React useVim hook
- `@vimee/plugin-textarea` — Textarea binding
- `@vimee/plugin-monaco` — Monaco Editor binding
- `@vimee/shiki-editor` — Shiki code editor component
- `@vimee/testkit` — Test utilities for Vim operations

## Commands

- `bun run test` — Run all tests (vitest)
- `bun run lint` — Lint (oxlint)
- `bun run fmt` — Format (oxfmt)
- `bun run typecheck` — Type check all packages (tsgo)
- `bun run build` — Build all packages (tsup)

## Commit Convention

`<type>(<scope>): <description>`

- Types: `feat`, `fix`, `test`, `chore`, `ci`, `docs`
- Scope: package name (`core`, `react`, `plugin-textarea`, `plugin-monaco`, `shiki-editor`, `testkit`) or omit for root
- Examples: `feat(core): add mark jumping`, `chore: update deps`

## Before Committing

1. `bun run test` — tests must pass
2. `bun run lint` — no lint errors
3. `bun run fmt` — code formatted

## Testing

- Use `@vimee/testkit` for Vim operation tests. See [packages/testkit/README.md](./packages/testkit/README.md)
- vitest with globals enabled. Tests live in `src/__tests__/`

## Architecture

- See [README.md](./README.md) for architecture overview
- See [packages/core/README.md](./packages/core/README.md) for core API reference

## Git

- Rebase, no merge commits
- Use changesets for releases: `/changeset` or `bun run changeset:gen`

## Documentation

After making code changes, run `/update-docs` to check and update related documentation.
