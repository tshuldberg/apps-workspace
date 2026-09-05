import { ModuleWebFallback } from '@/components/module-web-fallback';

export default function SurfFavoritesFallbackPage() {
  return (
    <ModuleWebFallback
      moduleName="MySurf"
      summary="Favorite spot management is still being migrated into the hub web experience."
      accentColor="var(--accent-surf, #3B82F6)"
      primaryHref="/surf"
      primaryLabel="Open Surf Dashboard"
      links={[
        { href: '/surf/regions', label: 'Browse Zones' },
        { href: '/surf/feed', label: 'Open Feed' },
      ]}
    />
  );
}
