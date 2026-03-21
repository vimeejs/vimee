#!/bin/bash
# Generate a changeset from commits since the latest git tag.
# Automatically detects which packages changed and includes only those.
#
# Usage:
#   bun run changeset:gen [patch|minor|major]
#
# Defaults to "minor" if any "feat:" commits exist, "patch" otherwise.
# Override by passing an argument: bun run changeset:gen major

set -euo pipefail

LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -z "$LATEST_TAG" ]; then
  RANGE=""
  RANGE_DISPLAY="initial commit"
else
  RANGE="${LATEST_TAG}..HEAD"
  RANGE_DISPLAY="$LATEST_TAG"
fi

# Detect which packages have changed
if [ -z "$RANGE" ]; then
  # No tags yet — consider all tracked files as changed
  CHANGED_CORE=$(git ls-files -- packages/core/ | head -1)
  CHANGED_REACT=$(git ls-files -- packages/react/ | head -1)
else
  CHANGED_CORE=$(git diff --name-only "$RANGE" -- packages/core/ 2>/dev/null | head -1)
  CHANGED_REACT=$(git diff --name-only "$RANGE" -- packages/react/ 2>/dev/null | head -1)
fi

if [ -z "$CHANGED_CORE" ] && [ -z "$CHANGED_REACT" ]; then
  echo "No package changes detected since ${RANGE_DISPLAY}."
  exit 0
fi

# Collect commits (skip merge commits)
if [ -z "$RANGE" ]; then
  COMMITS=$(git log --pretty=format:"%s" --no-merges | grep -v "^$" || true)
else
  COMMITS=$(git log "$RANGE" --pretty=format:"%s" --no-merges | grep -v "^$" || true)
fi

if [ -z "$COMMITS" ]; then
  echo "No new commits since ${RANGE_DISPLAY}."
  exit 0
fi

# Determine bump type
if [ -n "${1:-}" ]; then
  BUMP="$1"
elif echo "$COMMITS" | grep -q "^feat"; then
  BUMP="minor"
else
  BUMP="patch"
fi

# Build frontmatter with only changed packages
FRONTMATTER="---"
[ -n "$CHANGED_CORE" ]  && FRONTMATTER="${FRONTMATTER}"$'\n'"\"@vimee/core\": ${BUMP}"
[ -n "$CHANGED_REACT" ] && FRONTMATTER="${FRONTMATTER}"$'\n'"\"@vimee/react\": ${BUMP}"
FRONTMATTER="${FRONTMATTER}"$'\n'"---"

# Build summary grouped by conventional commit type
FEATS=$(echo "$COMMITS" | grep "^feat" | sed 's/^/- /' || true)
FIXES=$(echo "$COMMITS" | grep "^fix" | sed 's/^/- /' || true)
DOCS=$(echo "$COMMITS" | grep "^docs" | sed 's/^/- /' || true)
CHORES=$(echo "$COMMITS" | grep "^chore" | sed 's/^/- /' || true)
TESTS=$(echo "$COMMITS" | grep "^test" | sed 's/^/- /' || true)
OTHER=$(echo "$COMMITS" | grep -v "^feat\|^fix\|^docs\|^chore\|^test" | sed 's/^/- /' || true)

BODY=""
[ -n "$FEATS" ]  && BODY="${BODY}"$'\n'"### Features"$'\n\n'"${FEATS}"$'\n'
[ -n "$FIXES" ]  && BODY="${BODY}"$'\n'"### Bug Fixes"$'\n\n'"${FIXES}"$'\n'
[ -n "$TESTS" ]  && BODY="${BODY}"$'\n'"### Tests"$'\n\n'"${TESTS}"$'\n'
[ -n "$DOCS" ]   && BODY="${BODY}"$'\n'"### Documentation"$'\n\n'"${DOCS}"$'\n'
[ -n "$CHORES" ] && BODY="${BODY}"$'\n'"### Chores"$'\n\n'"${CHORES}"$'\n'
[ -n "$OTHER" ]  && BODY="${BODY}"$'\n'"### Other"$'\n\n'"${OTHER}"$'\n'

# Generate unique filename
RANDOM_NAME=$(date +%s | shasum | head -c 16)
CHANGESET_FILE=".changeset/${RANDOM_NAME}.md"

printf '%s\n%s' "$FRONTMATTER" "$BODY" > "$CHANGESET_FILE"

echo "Created ${CHANGESET_FILE} (${BUMP})"
echo ""
echo "Changed packages:"
[ -n "$CHANGED_CORE" ]  && echo "  - @vimee/core"
[ -n "$CHANGED_REACT" ] && echo "  - @vimee/react"
echo ""
cat "$CHANGESET_FILE"
