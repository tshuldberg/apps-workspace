#!/usr/bin/env node

import process from 'node:process';

interface PlanningRule {
  id: string;
  keywords: string[];
  files: string[];
  risks: string[];
  testCommands: string[];
}

const RULES: PlanningRule[] = [
  {
    id: 'mode-entitlements',
    keywords: ['entitlement', 'mode', 'hosted', 'self-host', 'self host', 'license'],
    files: [
      'packages/entitlements/src/',
      'apps/web/lib/entitlements.ts',
      'apps/mobile/lib/entitlements.ts',
      'packages/db/src/hub-schema.ts',
      'packages/db/src/hub-queries.ts',
    ],
    risks: [
      'Invalid signature verification can unlock paid paths incorrectly.',
      'Mode fallback bugs can strand users in unusable states.',
    ],
    testCommands: [
      'pnpm --filter @mylife/entitlements test',
      'pnpm --filter @mylife/db test',
      'pnpm --filter @mylife/web typecheck',
      'pnpm --filter @mylife/mobile typecheck',
    ],
  },
  {
    id: 'billing-webhooks',
    keywords: ['billing', 'stripe', 'revenuecat', 'webhook', 'sku', 'purchase'],
    files: [
      'packages/billing-config/src/index.ts',
      'apps/web/lib/billing/entitlement-issuer.ts',
      'apps/web/app/api/webhooks/billing/route.ts',
      'apps/web/app/api/entitlements/issue/route.ts',
      'apps/web/app/api/entitlements/sync/route.ts',
    ],
    risks: [
      'Webhook idempotency gaps can double-apply events.',
      'SKU mapping drift can issue wrong entitlement states.',
    ],
    testCommands: [
      'pnpm --filter @mylife/web typecheck',
      'pnpm --filter @mylife/billing-config typecheck',
    ],
  },
  {
    id: 'self-host-connectivity',
    keywords: ['self-host', 'self host', 'server url', 'docker', 'compose', 'connection test'],
    files: [
      'apps/web/lib/server-endpoint.ts',
      'apps/mobile/lib/server-endpoint.ts',
      'apps/web/app/settings/self-host/page.tsx',
      'apps/mobile/app/(hub)/self-host.tsx',
      'deploy/self-host/docker-compose.yml',
      'docs/self-host/README.md',
    ],
    risks: [
      'Bad URL validation can break hosted and self-host routing.',
      'Missing TLS guidance can cause insecure internet-facing deployments.',
    ],
    testCommands: [
      'pnpm --filter @mylife/web typecheck',
      'pnpm --filter @mylife/mobile typecheck',
      'docker compose -f deploy/self-host/docker-compose.yml --env-file deploy/self-host/.env.example config',
    ],
  },
  {
    id: 'sharing-social',
    keywords: ['friend', 'invite', 'share', 'rating', 'review', 'visibility'],
    files: [
      'docs/self-host/api-contract.yaml',
      'deploy/self-host/api/src/server.js',
      'modules/books/src/',
      'apps/web/app/books/',
      'apps/mobile/app/(books)/',
    ],
    risks: [
      'Visibility permission bugs can leak private data.',
      'Friendship state machine bugs can create stale/inconsistent share access.',
    ],
    testCommands: [
      'pnpm --filter @mylife/web typecheck',
      'pnpm --filter @mylife/mobile typecheck',
      'pnpm --filter @mylife/books run --if-present test',
    ],
  },
  {
    id: 'ui-only',
    keywords: ['ui', 'screen', 'layout', 'button', 'copy', 'settings page'],
    files: [
      'apps/web/app/',
      'apps/mobile/app/',
      'packages/ui/src/',
    ],
    risks: [
      'Unintended behavior changes if server actions are modified alongside UI.',
      'Visual regressions across web/mobile if parity checks are skipped.',
    ],
    testCommands: [
      'pnpm --filter @mylife/web typecheck',
      'pnpm --filter @mylife/mobile typecheck',
    ],
  },
];

function readRequestFromArgs(): string {
  const argInput = process.argv.slice(2).join(' ').trim();
  return argInput;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function matchRules(request: string): PlanningRule[] {
  const normalized = request.toLowerCase();
  return RULES.filter((rule) =>
    rule.keywords.some((keyword) => normalized.includes(keyword)),
  );
}

function classifyRiskLevel(request: string): 'low' | 'medium' | 'high' {
  const normalized = request.toLowerCase();

  if (
    normalized.includes('migration')
    || normalized.includes('billing')
    || normalized.includes('webhook')
    || normalized.includes('entitlement')
    || normalized.includes('auth')
  ) {
    return 'high';
  }

  if (
    normalized.includes('self-host')
    || normalized.includes('self host')
    || normalized.includes('sharing')
    || normalized.includes('sync')
  ) {
    return 'medium';
  }

  return 'low';
}

function printPlan(request: string): void {
  const matched = matchRules(request);

  const fileTargets = unique([
    ...matched.flatMap((rule) => rule.files),
    'docs/dual-model-implementation-tickets.md',
  ]);

  const riskNotes = unique([
    ...matched.flatMap((rule) => rule.risks),
    'Confirm backward compatibility for local-only users.',
  ]);

  const testCommands = unique([
    ...matched.flatMap((rule) => rule.testCommands),
    'pnpm --filter @mylife/web typecheck',
  ]);

  const riskLevel = classifyRiskLevel(request);

  console.log('# Implementation Plan');
  console.log('');
  console.log(`Request: ${request}`);
  console.log('');
  console.log(`Risk level: ${riskLevel.toUpperCase()}`);
  console.log('');
  console.log('## File targets');
  fileTargets.forEach((target) => {
    console.log(`- ${target}`);
  });
  console.log('');
  console.log('## Risk notes');
  riskNotes.forEach((risk) => {
    console.log(`- ${risk}`);
  });
  console.log('');
  console.log('## Suggested test commands');
  testCommands.forEach((command) => {
    console.log(`- ${command}`);
  });
}

function main(): void {
  const request = readRequestFromArgs();

  if (!request) {
    console.error('Usage: pnpm dlx tsx scripts/dev/plan-from-request.ts "<request>"');
    process.exit(1);
  }

  printPlan(request);
}

main();
