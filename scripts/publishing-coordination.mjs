/** Supervise a publisher under the shared SSH authority before any effects. */
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

export function coordinationCommand({ mode, env = process.env, argv = process.argv, now = new Date() }) {
  const client = env.PUBLISH_COORDINATOR_CLIENT;
  const config = env.PUBLISH_COORDINATOR_CONFIG;
  if (!client && !config) return null;
  if (!client || !config) throw new Error("Publishing coordination requires both client and configuration paths.");
  const python = env.PUBLISH_COORDINATOR_PYTHON || "python3";
  if (env.PUBLISH_COORDINATOR_CONTEXT) {
    return { python, args: [client, "verify", "--config", config], verify: true };
  }
  const key = mode === "check-only" ? `check:${randomUUID()}` : `daily:${now.toISOString().slice(0, 10)}`;
  return {
    python,
    args: [client, "run", "--config", config, "--workflow", "portfolio", "--job-key", key, "--", ...argv],
    verify: false,
  };
}

/** null means this is the verified child; an integer is the supervised exit. */
export async function enterPublishingCoordination(options) {
  const command = coordinationCommand(options);
  if (!command) return null;
  if (command.verify) {
    const result = spawnSync(command.python, command.args, { env: process.env, encoding: "utf8", timeout: 30_000 });
    if (result.error || result.status !== 0) throw new Error("Publishing authority could not verify this run; publishing blocked.");
    let context;
    try { context = JSON.parse(process.env.PUBLISH_COORDINATOR_CONTEXT); } catch { throw new Error("Invalid publishing context."); }
    if (context.workflow !== "portfolio") throw new Error("Publishing context belongs to another workflow.");
    return null;
  }
  return await new Promise((resolve, reject) => {
    const child = spawn(command.python, command.args, { env: process.env, stdio: "inherit" });
    const stop = (signal) => child.kill(signal);
    const terminate = () => stop("SIGTERM");
    const interrupt = () => stop("SIGINT");
    process.on("SIGTERM", terminate);
    process.on("SIGINT", interrupt);
    const cleanup = () => {
      process.off("SIGTERM", terminate);
      process.off("SIGINT", interrupt);
    };
    child.once("error", (error) => { cleanup(); reject(error); });
    child.once("exit", (code, signal) => { cleanup(); resolve(code ?? (signal === "SIGINT" ? 130 : 143)); });
  });
}
