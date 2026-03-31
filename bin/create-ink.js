#!/usr/bin/env node

import { resolve, basename } from "node:path";
import { mkdir, writeFile, readFile, chmod, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES = join(__dirname, "..", "templates");

const INITIAL_VERSION = "0.0.1";

// ─── Helpers ────────────────────────────────────────────────────────
async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function copyTemplate(templateName, destPath, replacements = {}) {
  let content = await readFile(join(TEMPLATES, templateName), "utf-8");
  for (const [key, value] of Object.entries(replacements)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }
  await writeFile(destPath, content);
}

function printUsage() {
  console.log(`
  create-ink — Scaffold an AI-native project

  Usage:
    npx create-ink <project-name>    Create a new project
    npx create-ink init              Initialize in current directory
    npx create-ink --help            Show this help

  What it sets up:
    • ink.config.json — single config file (includes version)
    • CLAUDE.md + AGENTS.md — universal agent instructions
    • .ink/ — CLI + per-version history files
    • .husky/ — commit-msg, pre-push, post-commit hooks
  `);
}

// ─── Scaffold ───────────────────────────────────────────────────────
async function scaffold(projectDir, projectName) {
  const isInit = await exists(projectDir);

  if (!isInit) {
    await mkdir(projectDir, { recursive: true });
  }

  console.log(`\n  🖊  create-ink — scaffolding ${projectName}\n`);

  // ink.config.json (single config — includes version)
  const configPath = join(projectDir, "ink.config.json");
  let existingVersion = INITIAL_VERSION;
  // If package.json exists, inherit its version
  const pkgPath = join(projectDir, "package.json");
  if (await exists(pkgPath)) {
    try {
      const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
      if (pkg.version) existingVersion = pkg.version;
    } catch {}
  }
  const config = {
    name: projectName,
    version: existingVersion,
  };
  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n");
  console.log("  ✓ ink.config.json");

  // .ink/ directory
  const inkDir = join(projectDir, ".ink");
  await mkdir(inkDir, { recursive: true });

  // .ink/cli.js
  await copyTemplate("hooks/cli.js", join(inkDir, "cli.js"));
  console.log("  ✓ .ink/cli.js");

  // .ink/history/<version>.md
  const historyDir = join(inkDir, "history");
  await mkdir(historyDir, { recursive: true });
  await copyTemplate(
    "history/initial.md",
    join(historyDir, `${existingVersion}.md`),
    {
      version: existingVersion,
      date: new Date().toISOString().split("T")[0],
    }
  );
  console.log(`  ✓ .ink/history/${existingVersion}.md`);

  // CLAUDE.md + AGENTS.md (both point to same instructions)
  await copyTemplate(
    "agent-instructions/AGENTS.md",
    join(projectDir, "CLAUDE.md"),
    { projectName }
  );
  console.log("  ✓ CLAUDE.md");

  await copyTemplate(
    "agent-instructions/AGENTS.md",
    join(projectDir, "AGENTS.md"),
    { projectName }
  );
  console.log("  ✓ AGENTS.md");

  // .husky/ hooks
  const huskyDir = join(projectDir, ".husky");
  await mkdir(huskyDir, { recursive: true });
  await copyTemplate("hooks/commit-msg", join(huskyDir, "commit-msg"));
  await chmod(join(huskyDir, "commit-msg"), 0o755);
  console.log("  ✓ .husky/commit-msg");

  await copyTemplate("hooks/pre-push", join(huskyDir, "pre-push"));
  await chmod(join(huskyDir, "pre-push"), 0o755);
  console.log("  ✓ .husky/pre-push");

  await copyTemplate("hooks/post-commit", join(huskyDir, "post-commit"));
  await chmod(join(huskyDir, "post-commit"), 0o755);
  console.log("  ✓ .husky/post-commit");

  // Package.json — create or merge
  let pkg = {};
  if (await exists(pkgPath)) {
    pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
  }
  pkg.name = pkg.name || projectName;
  pkg.version = pkg.version || existingVersion;
  pkg.type = pkg.type || "module";
  pkg.scripts = pkg.scripts || {};
  pkg.scripts["ink"] = "node .ink/cli.js";
  pkg.scripts["prepare"] = "husky";
  pkg.devDependencies = pkg.devDependencies || {};
  pkg.devDependencies["husky"] = "^9.0.0";
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log("  ✓ package.json");

  // .gitignore
  const gitignorePath = join(projectDir, ".gitignore");
  let gitignore = "";
  if (await exists(gitignorePath)) {
    gitignore = await readFile(gitignorePath, "utf-8");
  }
  if (!gitignore.includes("node_modules")) {
    gitignore += "\nnode_modules/\n";
    await writeFile(gitignorePath, gitignore.trimStart());
  }
  console.log("  ✓ .gitignore");

  // Initialize git if needed
  const gitDir = join(projectDir, ".git");
  if (!(await exists(gitDir))) {
    execSync("git init", { cwd: projectDir, stdio: "pipe" });
    console.log("  ✓ git init");
  }

  // Install dependencies
  console.log("\n  📦 Installing dependencies...\n");
  try {
    execSync("npm install", { cwd: projectDir, stdio: "inherit" });
  } catch {
    console.log(
      "  ⚠ npm install failed — run it manually after cd into the project"
    );
  }

  // Initialize husky
  try {
    execSync("npx husky", { cwd: projectDir, stdio: "pipe" });
    console.log("  ✓ husky initialized");
  } catch {
    console.log("  ⚠ husky init failed — run `npx husky` manually");
  }

  console.log(`
  🖊  Done! Your AI-native project is ready.

  Next steps:
    ${isInit ? "" : `cd ${projectName}`}
    git add -A && git commit -m "chore: initialize ink scaffold"

  Workflow for AI agents (and humans):
    1. Make code changes
    2. Run: node .ink/cli.js bump fix     (or feat)
    3. Fill in .ink/history/<version>.md
    4. Commit: git commit -m "fix: description"

  The hooks enforce conventional commits and validate
  history files exist for fix/feat commits.
  `);
}

// ─── Main ───────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h") || args.length === 0) {
  printUsage();
  process.exit(0);
}

const arg = args[0];

if (arg === "init") {
  const projectDir = process.cwd();
  const projectName = basename(projectDir);
  await scaffold(projectDir, projectName);
} else {
  const projectName = arg;
  const projectDir = resolve(process.cwd(), projectName);
  await scaffold(projectDir, projectName);
}
