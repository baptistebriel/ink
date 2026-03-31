# Agent Instructions — ink

This project uses **ink** for structured versioning and AI-agent collaboration.
Every coding agent working on this project MUST follow these rules.

## ⚠️ CRITICAL: Never use --no-verify

**NEVER** use `git commit --no-verify` or `git push --no-verify`.
The git hooks enforce project integrity. Bypassing them breaks the version history.
A pre-push hook will reject pushes containing non-compliant commits.

## Commit Rules

1. **Always use conventional commits**:
   - `fix: description` — bug fix (patch bump: 0.0.1 → 0.0.2)
   - `feat: description` — new feature (minor bump: 0.0.1 → 0.1.0)
   - `chore: description` — maintenance (no version bump)
   - `docs: description` — documentation only
   - `refactor: description` — code refactor (no behavior change)
   - `test: description` — test changes only
   - `perf: description` — performance improvement
   - `style: description` — formatting, whitespace
   - `build: description` — build system changes
   - `ci: description` — CI/CD changes

2. **For fix/feat commits, you MUST bump the version and write a history file**:
   ```bash
   node .ink/cli.js bump fix    # or feat, or breaking
   ```
   This creates `.ink/history/<version>.md`. Fill in at minimum `## What changed`.

3. **The commit will be REJECTED if**:
   - The commit message is not in conventional commit format
   - A fix/feat commit doesn't have a staged `.ink/history/<version>.md`
   - The history file is still a template (no real content added)

## Workflow

```
1. Make code changes
2. Determine type: fix, feat, or chore
3. If fix or feat:
   a. Run: node .ink/cli.js bump fix   (or feat)
   b. Fill in .ink/history/<version>.md — at minimum "## What changed"
   c. Optionally fill in ## Decisions, ## Bugs, ## Context sections
4. Stage everything: git add -A
5. Commit: git commit -m "fix: clear description of the change"
```

## History Files

Each version gets a single markdown file in `.ink/history/`:

```
.ink/history/
  0.0.1.md
  0.0.2.md
  0.1.0.md
```

### Sections in each history file

- **## What changed** (required) — what changed, why, how
- **## Why** — the motivation, what problem this solves
- **## Decisions** (optional) — architecture decisions, trade-offs, alternatives considered
- **## Bugs** (optional) — bugs found, fix attempts including failed ones
- **## Context** (optional) — project state, what's next, blockers

Keep sections that are relevant, delete the rest.

## Commands

```bash
node .ink/cli.js bump fix|feat|breaking   # Bump version, create history file
node .ink/cli.js status                   # Show current version info
node .ink/cli.js log                      # Print version history
node .ink/cli.js current                  # Print current version number
```

## Why This Matters

- Every meaningful change is documented with context
- Any agent (yours or someone else's) can pick up where the last left off
- Failed attempts are recorded so they're not repeated
- The project has a complete, searchable history of decisions
- Handoffs between agents and humans are seamless
