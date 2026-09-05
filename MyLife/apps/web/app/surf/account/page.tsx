import { ModuleWebFallback } from '@/components/module-web-fallback';

export default function SurfAccountFallbackPage() {
  return (
    <ModuleWebFallback
      moduleName="MySurf"
      summary="Account settings from the standalone MySurf app have not been fully ported into the hub web shell yet."
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
