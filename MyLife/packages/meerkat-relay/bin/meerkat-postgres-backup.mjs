#!/usr/bin/env node

import { runLocalTsx } from './run-local-tsx.mjs';

await runLocalTsx('../src/postgres/cli/backup-cli.ts');
