---
name: changeset
description: Create a changeset for package releases. Analyzes commits since the last release, determines affected packages and bump type, and generates a changeset file.
user_invocable: true
---

# Changeset Skill

Create a changeset by analyzing commits since the last release tag.

## Workflow

### 1. Identify the last release tag for each package

List all release tags sorted by version:

```bash
git tag --list '@vimee/*' --sort=-version:refname
```

From this output, extract the **latest** (highest version) tag for each package name. Tags follow the format `@vimee/<name>@<version>`. For each unique package name, take the first (highest) tag.

### 2. Determine affected packages per-package

For **each** package, use its latest tag from step 1 to compare against HEAD. Only check `src/` directories to focus on source changes:

```bash
# For each package, substitute <LATEST_TAG> with the actual latest tag found in step 1.
# Example: if the latest tag for core is @vimee/core@0.3.0, run:
#   git log '@vimee/core@0.3.0..HEAD' --oneline -- packages/core/src
git log '<LATEST_TAG>..HEAD' --oneline -- packages/<name>/src
```

Do this for every package that has at least one release tag. If a package has no release tag yet, skip it or ask the user.

Only include packages that have actual source changes (ignore CI-only or docs-only changes outside `packages/*/src`).

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

Present the plan before creating the changeset, showing per-package comparisons:

```
<package> (since <its-latest-tag>):
- <commit list for that package>

Changeset:
- @vimee/<pkg>: <bump>
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
