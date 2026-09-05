import { renderMeerkatRoleGrants } from '../roles';

try {
  const ownerRole = (process.env.MEERKAT_POSTGRES_OWNER_ROLE ?? '').trim();
  if (!ownerRole) throw new Error('MEERKAT_POSTGRES_OWNER_ROLE is required');
  process.stdout.write(`${renderMeerkatRoleGrants(ownerRole)}\n`);
} catch (error) {
  process.stdout.write(`${JSON.stringify({
    event: 'fatal',
    reason: 'role_grants_failed',
    detail: error instanceof Error ? error.message : String(error),
  })}\n`);
  process.exitCode = 1;
}
