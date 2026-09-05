import { useMemo } from 'react';
import { Redirect } from 'expo-router';
import { openDatabaseSync } from 'expo-sqlite';

// Entry gate. This route renders above the (root) DatabaseProvider tree, so it
// opens its own short-lived handle on the shared dowork.db file to read the
// onboarding flag before the provider tree (and its hub_settings table) exist.
// PRAGMA journal_mode=WAL matches DatabaseProvider so both handles agree on
// journaling mode for the same file. The catch below covers two distinct
// cases that both resolve to "not onboarded": (1) the expected case on a
// fresh install, where hub_settings has not been created yet by
// DatabaseProvider's migration run, and (2) a genuine read error (e.g. a
// corrupt or locked db file). Either way the safe fallback is to route into
// onboarding rather than block the app; onboarding.tsx writes
// `workouts.onboarding_complete` and offers Skip, so the user is never
// trapped and returning users go straight to the tabs.
function isOnboardingComplete(): boolean {
  try {
    const db = openDatabaseSync('dowork.db');
    db.runSync('PRAGMA journal_mode=WAL;');
    const rows = db.getAllSync(
      'SELECT value FROM hub_settings WHERE key = ? LIMIT 1',
      ['workouts.onboarding_complete'],
    ) as Array<{ value: string }>;
    return rows[0]?.value === 'true';
  } catch {
    // hub_settings not created yet (fresh install) or a real read error -
    // both fall back to "not onboarded", which is always the safe direction.
    return false;
  }
}

export default function Index() {
  const onboarded = useMemo(() => isOnboardingComplete(), []);
  return <Redirect href={onboarded ? '/(root)/(tabs)' : '/(root)/onboarding'} />;
}
