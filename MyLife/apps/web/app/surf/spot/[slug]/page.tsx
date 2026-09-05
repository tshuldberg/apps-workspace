import { ModuleWebFallback } from '@/components/module-web-fallback';

export default function SurfSpotDetailFallbackPage() {
  return (
    <ModuleWebFallback
      moduleName="MySurf"
      summary="Spot detail on web is still being consolidated from the standalone MySurf app. Use the dashboard, regions, and feed views for the current web beta experience."
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
