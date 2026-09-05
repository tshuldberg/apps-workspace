import { TravelPlaceholderScreen } from './_ui';

export default function TravelSettingsScreen() {
  return (
    <TravelPlaceholderScreen
      eyebrow="Settings"
      title="Control what MyTravel remembers"
      subtitle="Settings will manage default trip type, time zone behavior, cross-module bridges, and export preferences."
      cards={[
        {
          emoji: '\u{2708}\u{FE0F}',
          title: 'Default trip defaults',
          body: 'Pick a default trip type, currency, and time zone strategy so new trips start in the right state.',
        },
        {
          emoji: '\u{1F517}',
          title: 'Cross-module bridges',
          body: 'Budget, Friends, Dining, Journal, and Meds bridges stay opt-in and individually toggleable here.',
        },
        {
          emoji: '\u{1F4E4}',
          title: 'Export and backup',
          body: 'Per-trip export and full MyTravel backup will live here with clear copy about what stays local vs shared.',
        },
      ]}
    />
  );
}
