'use client';

export default function DiningSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          MyDining preferences
        </p>
      </div>

      <div
        className="rounded-xl border p-8 text-center"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--glass)' }}
      >
        <p className="text-4xl mb-3">{'\u2699\uFE0F'}</p>
        <p className="font-medium mb-1">Settings</p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Theme, EXIF stripping, calendar sync, and more coming soon.
        </p>
      </div>
    </div>
  );
}
