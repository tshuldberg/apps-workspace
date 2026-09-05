import { Redirect } from 'expo-router';

/**
 * Root index route. Every module route group (e.g. `(books)`, `(hub)`, `(mood)`)
 * contains its own `index.tsx`, and route groups are silent in the URL, so
 * without an explicit root file every module competes to serve `/`. Expo
 * Router's `initialRouteName` only controls navigation-by-name within a
 * Stack and does not disambiguate URL resolution, so the winner has been
 * observed to be `(books)/index.tsx` (alphabetically first). This file
 * pins `/` to the hub dashboard so cold launches always land on the Hub.
 */
export default function Index() {
  return <Redirect href="/(hub)" />;
}
