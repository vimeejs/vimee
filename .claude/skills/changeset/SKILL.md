---
name: changeset
description: Create a changeset for package releases. Analyzes commits since the last release, determines affected packages and bump type, and generates a changeset file.
user_invocable: true
---

# Changeset Skill

Create a changeset by analyzing commits since the last release tag.

## Workflow

### 1. Identify the last release tag and gather commits

```bash
git describe --tags --abbrev=0
```

Then collect all commits since that tag:

```bash
git log <last-tag>..HEAD --oneline
```

### 2. Determine affected packages

For each commit, check which `packages/*` directories were touched:

```bash
git diff --name-only <last-tag>..HEAD -- packages/core
git diff --name-only <last-tag>..HEAD -- packages/react
git diff --name-only <last-tag>..HEAD -- packages/shiki-editor
git diff --name-only <last-tag>..HEAD -- packages/plugin-textarea
```

Only include packages that have actual source changes (ignore CI-only or docs-only changes outside `packages/`).

### 3. Determine bump type for each package

Analyze the commit messages for each affected package:

| Commit prefix | Bump type |
|---|---|
| `fix:` | patch |
| `feat:` | minor |
| `BREAKING CHANGE` or `!:` in message | major |
| `chore:`, `ci:`, `docs:`, `refactor:`, `test:` | No bump needed (skip unless they contain functional changes) |

Choose the **highest** bump type found across all commits for each package.

If the bump type is ambiguous or could be interpreted as either minor or major, **ask the user** before proceeding.

### 4. Confirm with user

Present the plan before creating the changeset:

```
Commits since <tag>:
- <commit list>

Changeset:
- @vimee/shiki-editor: patch
- @vimee/core: minor
  ...

Summary: <one-line description>
```

Ask: "Does this look right?" — adjust if the user wants to change the bump type or summary.

### 5. Create the changeset file

Write to `.changeset/<descriptive-name>.md`:

```markdown
---
"@vimee/shiki-editor": patch
"@vimee/core": minor
---

<summary describing what changed and why>
```

### 6. Commit the changeset

Commit with message: `chore: add changeset for <brief description>`

## Important Notes

- **Do NOT run `changeset version` or `changeset publish`** — the release.yaml GitHub Action handles versioning and publishing automatically when changesets are merged to main.
- `updateInternalDependencies` is set to `"patch"` in `.changeset/config.json`, so dependents get bumped automatically.
- If there are no package changes since the last tag (only CI/docs changes), inform the user that no changeset is needed.
