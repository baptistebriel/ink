# create-ink 🖊

Scaffold AI-native projects with structured versioning, changelogs, and agent memory.

## The Problem

AI coding agents ship code fast — but without structure, projects lose context between sessions. Agents commit without meaningful messages, skip documentation, use `--no-verify` to bypass hooks, and leave no trace of *why* decisions were made. When you (or another agent) pick up the project later, there's no history to build on.

## What ink Does

**ink** adds a lightweight versioning layer to any project that keeps agents accountable:

- **Conventional commits** enforced via git hooks — every commit has a clear type and description
- **Version bumping** tied to commit type — `fix:` = patch, `feat:` = minor, `breaking` = major
- **A history file per version** — agents document what changed, why, and what they learned
- **CLAUDE.md + AGENTS.md** — instruction files that AI tools read on session start (Claude Code reads `CLAUDE.md`, Cursor/others read `AGENTS.md`)
- **Git hooks that can't be skipped** — `commit-msg` validates on commit, `pre-push` catches `--no-verify` bypasses, `post-commit` auto-pushes

The result: a project any agent or human can pick up and immediately understand.

## Quick Start

```bash
npx create-ink my-project
cd my-project
```

Or add to an existing project:

```bash
cd my-existing-project
npx create-ink init
```

## What It Creates

```
my-project/
  ink.config.json      ← project config (includes version)
  CLAUDE.md            ← agent instructions (Claude Code)
  AGENTS.md            ← agent instructions (Cursor, pi, etc.)
  .ink/
    cli.js             ← version management CLI
    history/
      0.0.1.md         ← first version history
  .husky/
    commit-msg         ← validates commits + history files
    pre-push           ← catches --no-verify bypasses
    post-commit        ← auto-pushes after commit
  package.json
```

Three visible files at root: `ink.config.json`, `CLAUDE.md`, and `AGENTS.md`. Everything else is hidden.

## Workflow

```bash
# 1. Make code changes

# 2. Bump version
node .ink/cli.js bump fix     # 0.0.1 → 0.0.2
node .ink/cli.js bump feat    # 0.0.1 → 0.1.0

# 3. Fill in .ink/history/<version>.md

# 4. Commit
git add -A && git commit -m "fix: resolve auth race condition"
```

The commit is rejected if the message isn't conventional, or if a `fix:`/`feat:` commit is missing its history file.

## History Files

Each version gets one markdown file in `.ink/history/`. One file to read, full picture:

```markdown
# 0.0.2
> 2026-03-29 — fix

## What changed
Fixed auth race condition causing intermittent 401 errors.

## Why
Users reported random login failures after OAuth redirect.

## Decisions
Chose mutex over queue — simpler, sufficient for our concurrency level.

## Bugs
Found edge case with expired refresh tokens during mutex wait.

## Context
Next: rate limiting for the OAuth endpoint.
```

Only `## What changed` is required. The rest is optional — agents include what's relevant and skip the rest. Failed attempts, dead ends, and architectural decisions all get captured so they're not repeated.

## Commands

```bash
node .ink/cli.js bump fix|feat|breaking   # Bump version, create history file
node .ink/cli.js status                   # Show current version
node .ink/cli.js log                      # Print version history
```

## FAQ

**Does this work with non-Node projects?**
Yes. The target project can be any language. You just need Node installed for the hooks and CLI.

**What about chore commits?**
`chore:` commits don't require a version bump or history file.

**Existing project?**
`npx create-ink init` detects the version from your `package.json` and starts from there.

## License

MIT
