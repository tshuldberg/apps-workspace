import path from "node:path";

import { runEmailTriageJob } from "./jobs/email-triage.js";
import { loadApprovalPolicy, loadJobSpec, loadRuntimeConfig } from "./runtime/loaders.js";

interface CliOptions {
  jobFile: string;
  dryRun: boolean;
  approveWrites: boolean;
}

function parseArgs(argv: string[]): { command: string | undefined; options: CliOptions } {
  const command = argv[0];
  const options: CliOptions = {
    jobFile: "jobs/01_email_triage.yaml",
    dryRun: false,
    approveWrites: false,
  };

  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--job-file") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("Missing value for --job-file");
      }
      options.jobFile = value;
      index += 1;
      continue;
    }

    if (token === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (token === "--approve-writes") {
      options.approveWrites = true;
    }
  }

  return { command, options };
}

function printHelp(): void {
  console.log(`Automation Hub CLI\n\nUsage:\n  npm run job:email-triage -- [--job-file jobs/01_email_triage.yaml] [--dry-run] [--approve-writes]\n`);
}

async function main(): Promise<void> {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command !== "run-email-triage") {
    throw new Error(`Unsupported command: ${command}`);
  }

  const repoRoot = process.cwd();
  const { config: runtimeConfig, sourcePath } = await loadRuntimeConfig(repoRoot);
  const jobSpec = await loadJobSpec(repoRoot, options.jobFile);
  const policy = await loadApprovalPolicy(repoRoot, runtimeConfig.paths.policy_file);

  const dryRun = options.dryRun || jobSpec.status === "dry_run";
  const run = await runEmailTriageJob(runtimeConfig, jobSpec, policy, {
    repoRoot,
    dryRun,
    approveWrites: options.approveWrites,
  });

  const outputLines = Object.entries(run.outputPaths)
    .map(([key, value]) => `  - ${key}: ${path.relative(repoRoot, value)}`)
    .join("\n");

  console.log(`Run complete: ${run.runId}`);
  console.log(`Runtime config: ${path.relative(repoRoot, sourcePath)}`);
  console.log(`Threads scanned: ${run.result.scanned_threads}`);
  console.log(`Relevant threads: ${run.result.relevant_threads}`);
  console.log(`Proposed tasks: ${run.result.proposed_tasks.length}`);
  console.log(`\nOutputs:\n${outputLines}`);
}

main().catch((error: unknown) => {
  console.error("Automation Hub CLI failed.");
  if (error instanceof Error) {
    console.error(error.stack ?? error.message);
  } else {
    console.error(String(error));
  }
  process.exitCode = 1;
});
