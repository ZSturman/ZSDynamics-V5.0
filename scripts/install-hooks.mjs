#!/usr/bin/env node
import { chmodSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const repoRoot = process.cwd();
const hooksPath = ".githooks";
const prePushPath = path.join(repoRoot, hooksPath, "pre-push");

if (!existsSync(prePushPath)) {
  console.error(`Missing hook file: ${prePushPath}`);
  process.exit(1);
}

try {
  chmodSync(prePushPath, 0o755);
  execSync(`git config core.hooksPath ${hooksPath}`, { stdio: "inherit" });
  console.log(`Configured git hooks path to ${hooksPath}`);
} catch (error) {
  console.error("Failed to install git hooks:", error);
  process.exit(1);
}
