---
name: update-docs
description: Use when code changes have been made and documentation may need updating. Checks all READMEs and CLAUDE.md against changes since the last release tag.
user_invocable: true
---

# Update Docs

Check and update project documentation to reflect code changes since the last release.

## Workflow

### 1. Identify changed files since last release

Find the last release tag and list all changed files:

```bash
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)
git diff --name-only "$LAST_TAG"..HEAD
```

### 2. Determine affected packages

From the changed files, identify which packages were modified:

- `packages/core/` → `@vimee/core`
- `packages/react/` → `@vimee/react`
- `packages/plugin-textarea/` → `@vimee/plugin-textarea`
- `packages/shiki-editor/` → `@vimee/shiki-editor`
- `packages/testkit/` → `@vimee/testkit`

### 3. Check each document for staleness

For each affected package, read its README and compare against changes:

| Document | Check for |
|---|---|
| `README.md` (root) | Package table, monorepo structure, feature list, quick start examples |
| `packages/*/README.md` | API changes, new exports, removed exports, usage examples |
| `CLAUDE.md` | Package list, commands, conventions |

Also check:
- Were new packages added? → Update root README package table and monorepo structure
- Were scripts changed in root `package.json`? → Update CLAUDE.md commands section
- Were new exports added to a package `index.ts`? → Update that package's README

### 4. Apply updates

For each document that needs changes:
1. Read the current document
2. Identify the specific section(s) that are stale
3. Update only the stale sections — do not rewrite unaffected content
4. Preserve formatting, style, and tone of the existing document

### 5. Report

Summarize what was updated:

```
Documents checked:
- README.md — updated (added @vimee/testkit to package table)
- packages/core/README.md — no changes needed
- CLAUDE.md — no changes needed

Documents not checked (no related code changes):
- packages/react/README.md
```

If nothing needs updating, say so: "All documentation is up to date."

### 6. Commit if changes were made

Commit with: `docs: update documentation for recent changes`

## Important Notes

- Only update documentation that is **actually stale** relative to code changes. Do not rewrite or "improve" unrelated sections.
- If a package README does not exist yet, create one following the pattern of `packages/core/README.md`.
- If unsure whether a change warrants a doc update, mention it in the report and let the user decide.
