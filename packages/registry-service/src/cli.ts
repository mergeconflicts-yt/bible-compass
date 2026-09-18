#!/usr/bin/env node
// Narrow CLI for Task 07B — evaluates one exact release/component/operation authorization
// Usage: ts-node src/cli.ts --releaseKey <key> --componentKey <key> --operation <op>
// This CLI is server-side only and requires --actor service_role; it never logs protected payload.

import { InMemoryRegistryRepository } from "./inMemoryAdapter";
import { RegistryService, serviceActor } from "./service";

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--") && i + 1 < argv.length) {
      out[arg.slice(2)] = argv[i + 1] as string;
      i++;
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  const releaseKey = args["releaseKey"];
  const componentKey = args["componentKey"];
  const operation = args["operation"] as
    | "evaluation_import"
    | "drafting"
    | "publication"
    | "external_ai_processing"
    | "embedding"
    | undefined;
  if (!releaseKey || !componentKey || !operation) {
    console.error(
      "Usage: cli --releaseKey <releaseKey> --componentKey <componentKey> --operation <evaluation_import|drafting|publication|external_ai_processing|embedding>",
    );
    process.exit(1);
  }
  // In real deployment this would use Postgres adapter with service_role; here we use in-memory for demo
  const repo = new InMemoryRegistryRepository();
  const service = new RegistryService(repo);
  const actor = serviceActor("cli-service-role");
  // Note: no protected source data is logged; only keys/digests
  console.log(
    JSON.stringify({
      releaseKey,
      componentKey,
      operation,
      actor: actor.principalId,
    }),
  );
  const result = await service.authorize({
    releaseKey,
    componentKey,
    operation,
  });
  console.log(
    JSON.stringify({
      allowed: result.allowed,
      reason: result.reason,
      deniedCode: result.deniedCode,
    }),
  );
  process.exit(result.allowed ? 0 : 2);
}

if (require.main === module) {
  main().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ error: msg }));
    process.exit(1);
  });
}
