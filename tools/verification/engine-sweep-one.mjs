// Sweep worker: result.json -> mapped report -> reasons -> dump {reasons, issueTypes}
import { readFileSync, writeFileSync } from "node:fs";
import { generateDisputeReasons } from "./engine.bundle.mjs";
import { mapWorkerResultToCreditReport } from "~/credit clarify - gain equity/3 Bureau Extractor/server/resultMapper.mjs";

const [resultPath, sessionId, outPath] = process.argv.slice(2);
const raw = JSON.parse(readFileSync(resultPath, "utf8"));
const workerResult = raw.result ?? raw;
const session = { id: sessionId, fileName: "report.pdf" };
try {
  const report = mapWorkerResultToCreditReport({ session, workerResult });
  const reasons = generateDisputeReasons(report);
  const counts = {};
  for (const r of reasons) counts[r.issueType] = (counts[r.issueType] ?? 0) + 1;
  writeFileSync(outPath, JSON.stringify({ ok: true, sessionId, reasonCount: reasons.length, issueTypes: counts, reasons }));
  console.log(`OK ${sessionId} reasons=${reasons.length}`);
} catch (err) {
  writeFileSync(outPath, JSON.stringify({ ok: false, sessionId, error: String(err && err.stack ? err.stack : err).slice(0, 500) }));
  console.log(`ERR ${sessionId} ${String(err).slice(0, 120)}`);
}
