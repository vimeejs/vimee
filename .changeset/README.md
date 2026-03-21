# Changesets

This directory is managed by [@changesets/cli](https://github.com/changesets/changesets).

## Quick usage

Generate a changeset automatically from recent commits:

```bash
bun run changeset:gen          # auto-detect patch/minor from commits
bun run changeset:gen major    # force a major bump
bun run changeset:gen minor    # force a minor bump
bun run changeset:gen patch    # force a patch bump
```

Or create one manually:

```bash
bun run changeset
```
