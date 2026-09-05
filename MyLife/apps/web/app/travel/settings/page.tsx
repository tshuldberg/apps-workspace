import { TravelBulletList, TravelPanel } from '../_ui';

export default function TravelSettingsPage() {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <TravelPanel
        eyebrow="Settings"
        title="Control what MyTravel remembers"
        body="Settings will manage default trip type, time zone behavior, cross-module bridges, and export preferences."
      >
        <TravelBulletList
          items={[
            'Default trip type, currency, and time zone strategy so new trips start in the right state',
            'Cross-module bridges (Budget, Friends, Dining, Journal, Meds) stay opt-in and individually toggleable',
            'Per-trip export and full MyTravel backup with clear copy about what stays local vs shared',
          ]}
        />
      </TravelPanel>
    </div>
  );
}
