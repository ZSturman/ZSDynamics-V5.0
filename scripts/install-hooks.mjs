#!/usr/bin/env node
import { chmodSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const repoRoot = process.cwd();
const hooksPath = ".githooks";
const hooks = ["pre-push", "post-push"];

for (const hook of hooks) {
  const hookPath = path.join(repoRoot, hooksPath, hook);
  if (!existsSync(hookPath)) {
    console.error(`Missing hook file: ${hookPath}`);
    process.exit(1);
  }
  chmodSync(hookPath, 0o755);
}

try {
  execSync(`git config core.hooksPath ${hooksPath}`, { stdio: "inherit" });
  console.log(`Configured git hooks path to ${hooksPath} (${hooks.join(", ")})`);
} catch (error) {
  console.error("Failed to install git hooks:", error);
  process.exit(1);
}
