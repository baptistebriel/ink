#!/usr/bin/env node

/**
 * ink CLI — version bumping and history management for AI-native projects.
 *
 * Usage:
 *   node .ink/cli.js bump fix       Patch bump (0.0.1 → 0.0.2)
 *   node .ink/cli.js bump feat      Minor bump (0.0.1 → 0.1.0)
 *   node .ink/cli.js bump breaking  Major bump (0.0.1 → 1.0.0)
 *   node .ink/cli.js status         Show current version and pending changes
 *   node .ink/cli.js log            Print version history summary
 *   node .ink/cli.js current        Print current version number
 */

import { readFile, writeFile, mkdir, readdir, access, stat } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const CONFIG_FILE = join(ROOT, "ink.config.json");
const INK_DIR = join(ROOT, ".ink");
const HISTORY_DIR = join(INK_DIR, "history");
const BRAIN_FILE = join(ROOT, "BRAIN.md");

// ─── Helpers ────────────────────────────────────────────────────────
async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readConfig() {
  if (await exists(CONFIG_FILE)) {
    return JSON.parse(await readFile(CONFIG_FILE, "utf-8"));
  }
  return { version: "0.0.0" };
}

async function writeConfig(config) {
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n");
}

function bumpVersion(current, type) {
  const parts = current.split(".").map(Number);
  if (parts.length !== 3) {
    throw new Error(`Invalid version format: ${current}`);
  }

  let [major, minor, patch] = parts;

  switch (type) {
    case "fix":
    case "patch":
      patch++;
      break;
    case "feat":
    case "minor":
      minor++;
      patch = 0;
      break;
    case "breaking":
    case "major":
      major++;
      minor = 0;
      patch = 0;
      break;
    default:
      throw new Error(`Unknown bump type: ${type}. Use fix, feat, or breaking.`);
  }

  return `${major}.${minor}.${patch}`;
}

function versionTemplate(version, type) {
  const date = new Date().toISOString().split("T")[0];
  const typeLabel = type === "fix" ? "fix" : type === "feat" ? "feat" : "breaking";
  return `# ${version}

> ${date} — ${typeLabel}

## What changed

<!-- Describe what changed and why -->

## Why

<!-- Explain the motivation — what problem does this solve? -->

<!-- Optional sections — keep what's relevant, delete the rest -->

## Decisions

<!-- Architecture decisions, trade-offs, alternatives considered -->

## Bugs

<!-- Bugs found, reproduction steps, fix attempts (including failed ones) -->

## Context

<!-- Project state snapshot: what's in progress, what's next, blockers -->
`;
}

// ─── Commands ───────────────────────────────────────────────────────
async function cmdBump(type) {
  const config = await readConfig();
  const current = config.version;
  const next = bumpVersion(current, type);

  // Create history file
  await mkdir(HISTORY_DIR, { recursive: true });
  const versionFile = join(HISTORY_DIR, `${next}.md`);
  if (await exists(versionFile)) {
    console.log(`\n  ⚠ .ink/history/${next}.md already exists — version already bumped?\n`);
    process.exit(1);
  }

  await writeFile(versionFile, versionTemplate(next, type));

  // Update config version
  config.version = next;
  await writeConfig(config);

  // Update package.json version if it exists
  const pkgPath = join(ROOT, "package.json");
  if (await exists(pkgPath)) {
    const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
    pkg.version = next;
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  }

  console.log(`
  🖊  Bumped ${current} → ${next} (${type})

  Created: .ink/history/${next}.md

  Next:
    1. Fill in .ink/history/${next}.md (at minimum "## What changed")
    2. git add -A && git commit -m "${type}: your description here"
  `);
}

async function cmdStatus() {
  const config = await readConfig();
  const version = config.version;
  const versionFile = join(HISTORY_DIR, `${version}.md`);
  const hasHistory = await exists(versionFile);
  const hasBrain = await exists(BRAIN_FILE);

  let brainStatus = "✗ missing";
  if (hasBrain) {
    const brainStat = await stat(BRAIN_FILE);
    const ago = timeSince(brainStat.mtime);
    brainStatus = `✓ BRAIN.md (updated ${ago})`;
  }

  console.log(`
  🖊  ink status

  Version:   ${version}
  History:   ${hasHistory ? `✓ .ink/history/${version}.md` : `✗ missing — run: node .ink/cli.js bump <type>`}
  Brain:     ${brainStatus}
  `);
}

function timeSince(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function cmdLog() {
  if (!(await exists(HISTORY_DIR))) {
    console.log("\n  No .ink/history/ folder found.\n");
    return;
  }

  const entries = await readdir(HISTORY_DIR);
  const versions = entries
    .filter((e) => e.endsWith(".md"))
    .map((e) => e.replace(".md", ""))
    .sort((a, b) => {
      const pa = a.split(".").map(Number);
      const pb = b.split(".").map(Number);
      for (let i = 0; i < 3; i++) {
        if (pa[i] !== pb[i]) return pa[i] - pb[i];
      }
      return 0;
    });

  if (versions.length === 0) {
    console.log("\n  No versions in .ink/history/ yet.\n");
    return;
  }

  console.log("\n  🖊  Version history\n");
  for (const v of versions) {
    const filePath = join(HISTORY_DIR, `${v}.md`);
    const content = await readFile(filePath, "utf-8");

    // Extract type from the > date — type line
    const typeLine = content.match(/^> .+ — (.+)$/m);
    const type = typeLine ? typeLine[1] : "?";

    // Extract first real content line (after headings, blockquotes, comments)
    let summary = "";
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (
        trimmed &&
        !trimmed.startsWith("#") &&
        !trimmed.startsWith(">") &&
        !trimmed.startsWith("<!--") &&
        !trimmed.startsWith("-->")
      ) {
        summary = trimmed.slice(0, 72);
        break;
      }
    }

    const icon = type === "fix" ? "🔧" : type === "feat" ? "✨" : type === "breaking" ? "💥" : "📝";
    console.log(`  ${icon} ${v}  ${summary}`);
  }
  console.log();
}

async function cmdCurrent() {
  const config = await readConfig();
  console.log(config.version);
}

async function cmdContext() {
  const config = await readConfig();
  const version = config.version;

  console.log(`\n  🖊  ink context — ${config.name || "project"} v${version}\n`);
  console.log("─".repeat(60));

  // Latest history file
  if (await exists(HISTORY_DIR)) {
    const entries = await readdir(HISTORY_DIR);
    const versions = entries
      .filter((e) => e.endsWith(".md"))
      .map((e) => e.replace(".md", ""))
      .sort((a, b) => {
        const pa = a.split(".").map(Number);
        const pb = b.split(".").map(Number);
        for (let i = 0; i < 3; i++) {
          if (pa[i] !== pb[i]) return pb[i] - pa[i];
        }
        return 0;
      });

    if (versions.length > 0) {
      const latest = versions[0];
      const content = await readFile(join(HISTORY_DIR, `${latest}.md`), "utf-8");
      console.log(`\n  Latest history: .ink/history/${latest}.md\n`);
      for (const line of content.split("\n")) {
        console.log(`  ${line}`);
      }
    }
  }

  console.log("\n" + "─".repeat(60));

  // BRAIN.md
  if (await exists(BRAIN_FILE)) {
    const brain = await readFile(BRAIN_FILE, "utf-8");
    const brainStat = await stat(BRAIN_FILE);
    console.log(`\n  Brain: BRAIN.md (updated ${timeSince(brainStat.mtime)})\n`);
    for (const line of brain.split("\n")) {
      console.log(`  ${line}`);
    }
  } else {
    console.log("\n  Brain: no BRAIN.md found\n");
  }

  console.log("\n" + "─".repeat(60) + "\n");
}

// ─── Main ───────────────────────────────────────────────────────────
const [command, ...args] = process.argv.slice(2);

switch (command) {
  case "bump":
    if (!args[0]) {
      console.log("\n  Usage: node .ink/cli.js bump <fix|feat|breaking>\n");
      process.exit(1);
    }
    await cmdBump(args[0]);
    break;
  case "status":
    await cmdStatus();
    break;
  case "log":
    await cmdLog();
    break;
  case "current":
    await cmdCurrent();
    break;
  case "context":
    await cmdContext();
    break;
  default:
    console.log(`
  🖊  ink — AI-native version management

  Commands:
    bump <fix|feat|breaking>   Bump version and create history file
    status                     Show current version info
    log                        Print version history
    current                    Print current version number
    context                    Full project context (version + history + brain)

  Examples:
    node .ink/cli.js bump fix       Patch bump (bug fix)
    node .ink/cli.js bump feat      Minor bump (new feature)
    node .ink/cli.js bump breaking  Major bump (breaking change)
    node .ink/cli.js context        Get oriented at session start
    `);
}
