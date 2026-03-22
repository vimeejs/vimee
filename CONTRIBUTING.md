# Contributing

Thank you for your interest in contributing to vimee!

Please check out our [good first issues](https://github.com/vimeejs/vimee/contribute) or open a [discussion](https://github.com/vimeejs/vimee/issues) if you need guidance.

We welcome and appreciate any form of contributions.

## Getting Started

```bash
# Clone
git clone --recursive https://github.com/vimeejs/vimee.git
cd vimee

# Install
bun install

# Build
bun run build

# Test
bun run test

# Lint
bun run lint

# Format
bun run fmt

# Type check
bun run typecheck
```

## Project Structure

```
packages/
  core/              # @vimee/core — headless vim engine
  react/             # @vimee/react — React useVim hook
  plugin-textarea/   # @vimee/plugin-textarea — vim for any textarea
  shiki-editor/      # @vimee/shiki-editor — editor component with Shiki
  testkit/           # @vimee/testkit — test utilities for Vim operations
```

## Writing Tests

Use `@vimee/testkit` for Vim operation tests:

```ts
import { vim } from "@vimee/testkit";

const v = vim("hello\nworld");
v.type("dd");
expect(v.content()).toBe("world");
```

See [packages/testkit/README.md](./packages/testkit/README.md) for the full API.

## Commit Convention

```
<type>(<scope>): <description>
```

- **Types**: `feat`, `fix`, `test`, `chore`, `ci`, `docs`
- **Scope**: package name (`core`, `react`, `plugin-textarea`, `shiki-editor`, `testkit`) or omit for root
- Examples: `feat(core): add mark jumping`, `chore: update deps`

## Before Submitting a PR

1. `bun run test` — all tests must pass
2. `bun run lint` — no lint errors
3. `bun run fmt` — code formatted
4. `bun run typecheck` — no type errors

## AI Usage Policy

When using AI tools (including LLMs like ChatGPT, Claude, Copilot, etc.) to contribute:

- **Please disclose AI usage** to reduce maintainer fatigue
- **You are responsible** for all AI-generated issues or PRs you submit
- **Low-quality or unreviewed AI content will be closed immediately**

We encourage the use of AI tools to assist with development, but all contributions must be thoroughly reviewed and tested by the contributor before submission.

## Code of Conduct

Please read our [Code of Conduct](./.github/CODE_OF_CONDUCT.md) before contributing.
