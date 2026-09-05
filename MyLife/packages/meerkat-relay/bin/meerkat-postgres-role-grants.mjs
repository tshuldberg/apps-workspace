#!/usr/bin/env node

import { runLocalTsx } from './run-local-tsx.mjs';

await runLocalTsx('../src/postgres/cli/role-grants-cli.ts');
