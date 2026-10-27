import test from "node:test";
import assert from "node:assert/strict";
import { coordinationCommand } from "../scripts/publishing-coordination.mjs";

const env = { PUBLISH_COORDINATOR_CLIENT: "/a directory/coordinator.py", PUBLISH_COORDINATOR_CONFIG: "/private/mac.json" };
test("both hosts use the same UTC day identity and preserve literal argument paths", () => {
  const command = coordinationCommand({ mode: "publish", env, argv: ["/node", "/a directory/publisher.mjs", "--mode", "publish"], now: new Date("2026-10-25T14:00:00Z") });
  assert.deepEqual(command.args, [env.PUBLISH_COORDINATOR_CLIENT, "run", "--config", env.PUBLISH_COORDINATOR_CONFIG,
    "--workflow", "portfolio", "--job-key", "daily:2026-10-25", "--", "/node", "/a directory/publisher.mjs", "--mode", "publish"]);
});
test("configured context is verified instead of obtaining another claim", () => {
  const command = coordinationCommand({ mode: "publish", env: { ...env, PUBLISH_COORDINATOR_CONTEXT: "opaque" } });
  assert.equal(command.verify, true);
  assert.deepEqual(command.args, [env.PUBLISH_COORDINATOR_CLIENT, "verify", "--config", env.PUBLISH_COORDINATOR_CONFIG]);
});
test("incomplete coordination fails closed; an unconfigured installation retains its original behavior", () => {
  assert.throws(() => coordinationCommand({ env: { PUBLISH_COORDINATOR_CONFIG: "missing-client" } }));
  assert.equal(coordinationCommand({ env: {} }), null);
});
test("check-only requests have separate identities without consuming the daily publication", () => {
  const first = coordinationCommand({ mode: "check-only", env });
  const second = coordinationCommand({ mode: "check-only", env });
  assert.match(first.args[7], /^check:/);
  assert.notEqual(first.args[7], second.args[7]);
});
