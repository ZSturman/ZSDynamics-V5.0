import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function wrangler(args) {
  const result = spawnSync(
    process.execPath,
    [resolve(root, "node_modules/wrangler/bin/wrangler.js"), ...args],
    { cwd: root, encoding: "utf8" },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
  return result.stdout;
}
const configPath = resolve(root, "wrangler.toml");
let config = readFileSync(configPath, "utf8");
if (config.includes("00000000-0000-0000-0000-000000000000")) {
  const databases = JSON.parse(wrangler(["d1", "list", "--json"]));
  let database = databases.find((d) => d.name === "portfolio-intake");
  if (!database) {
    const output = wrangler(["d1", "create", "portfolio-intake"]);
    const match =
      output.match(/database_id\s*[=:]\s*["']([0-9a-f-]{36})["']/i) ||
      output.match(/"uuid":\s*"([0-9a-f-]{36})"/i);
    if (!match) {
      console.log(output);
      throw new Error(
        "Database created; add its ID to wrangler.toml, then rerun setup:intake.",
      );
    }
    database = { uuid: match[1] };
  }
  config = config.replace(
    "00000000-0000-0000-0000-000000000000",
    database.uuid,
  );
  writeFileSync(configPath, config);
}
console.log(
  wrangler(["d1", "migrations", "apply", "portfolio-intake", "--remote"]),
);
console.log(
  "Intake database is ready. Set Worker secrets, then npm run deploy.",
);
