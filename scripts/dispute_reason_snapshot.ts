import { stdin as input, stdout as output } from "node:process";
import { buildDefaultIntake } from "../src/features/dispute-letters/defaults";
import { generateAccountRuleCatalog, generateDisputeReasons, generateNonAccountReasons } from "../src/features/dispute-letters/reasonEngine";

const readStdin = async () => {
  let buffer = "";
  for await (const chunk of input) {
    buffer += chunk;
  }
  return buffer;
};

const main = async () => {
  const payload = await readStdin();
  const report = JSON.parse(payload);
  const intake = buildDefaultIntake(report);
  const accountRuleCatalog = generateAccountRuleCatalog(report);
  const nonAccountReasons = generateNonAccountReasons(report, intake);
  const reasons = generateDisputeReasons(report, intake, accountRuleCatalog, nonAccountReasons);
  output.write(JSON.stringify({ intake, accountRuleCatalog, nonAccountReasons, reasons }));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
