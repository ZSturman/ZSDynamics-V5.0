import assert from "node:assert/strict";
import test from "node:test";

import { verifyAnalytics } from "../scripts/analytics-verify.mjs";

test("verification prints aggregates only and survives unavailable reports", async () => {
  const seen = [];
  const client = {
    async runReport(request) {
      seen.push(request);
      if (JSON.stringify(request).includes("qa_run")) throw new Error("custom dimension not registered");
      return [{ rows: [{ dimensionValues: [{ value: "page_view" }], metricValues: [{ value: "3" }] }] }];
    },
    async runRealtimeReport(request) {
      assert.equal(request.dateRanges, undefined);
      return [{ rows: [] }];
    },
  };
  const lines = [];
  await verifyAnalytics({ client, propertyId: "1", days: 3, qaRun: "release-1", log: (line) => lines.push(line) });
  const output = lines.join("\n");
  assert.match(output, /page_view \| ?.*=> 3|page_view => 3/);
  assert.match(output, /QA run release-1 .*unavailable/);
  assert.match(output, /\(no rows\)/);
  for (const request of seen) {
    for (const dimension of request.dimensions || []) assert.doesNotMatch(dimension.name, /ip|clientId|userId/i);
  }
});
