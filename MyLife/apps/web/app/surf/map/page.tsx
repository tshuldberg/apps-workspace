import { ModuleWebFallback } from '@/components/module-web-fallback';

export default function SurfMapFallbackPage() {
  return (
    <ModuleWebFallback
      moduleName="MySurf"
      summary="The interactive swell map remains standalone-only while the hub web beta focuses on dashboard, zones, and feed coverage."
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
