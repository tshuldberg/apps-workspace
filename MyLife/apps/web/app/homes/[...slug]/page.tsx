import { ModuleWebFallback } from '@/components/module-web-fallback';

export default function HomesFallback() {
  return (
    <ModuleWebFallback
      moduleName="MyHomes"
      title="Real Estate"
      routePath="/homes"
      summary="Real estate, reimagined. Manage your properties, maintenance, costs, and more."
      accentColor="var(--accent-homes)"
      primaryHref="/homes"
      primaryLabel="Go to Dashboard"
      links={[
        { href: '/homes/properties', label: 'Properties' },
        { href: '/homes/maintenance', label: 'Maintenance' },
        { href: '/homes/costs', label: 'Costs' },
      ]}
    />
  );
}
