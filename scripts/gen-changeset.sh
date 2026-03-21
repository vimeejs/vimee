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

# Detect which packages have changed (dynamically scan packages/*)
CHANGED_NAMES=""
for pkg_dir in packages/*/; do
  pkg_name=$(node -e "console.log(require('./${pkg_dir}package.json').name)" 2>/dev/null || continue)
  if [ -z "$RANGE" ]; then
    changed=$(git ls-files -- "$pkg_dir" | head -1)
  else
    changed=$(git diff --name-only "$RANGE" -- "$pkg_dir" 2>/dev/null | head -1)
  fi
  if [ -n "$changed" ]; then
    if [ -n "$CHANGED_NAMES" ]; then
      CHANGED_NAMES="${CHANGED_NAMES}"$'\n'"${pkg_name}"
    else
      CHANGED_NAMES="${pkg_name}"
    fi
  fi
done

if [ -z "$CHANGED_NAMES" ]; then
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
while IFS= read -r pkg_name; do
  FRONTMATTER="${FRONTMATTER}"$'\n'"\"${pkg_name}\": ${BUMP}"
done <<< "$CHANGED_NAMES"
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
while IFS= read -r pkg_name; do
  echo "  - ${pkg_name}"
done <<< "$CHANGED_NAMES"
echo ""
cat "$CHANGESET_FILE"
