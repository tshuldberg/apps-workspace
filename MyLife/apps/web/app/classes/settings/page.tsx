import { loadClassesFoundation } from '../data';
import {
  ClassesChecklist,
  ClassesSection,
  ClassesSettingsSummary,
} from '../ui';
import { ClassesSettingsForm } from './SettingsForm';

export default function ClassesSettingsPage() {
  const { settings, stats, checklist } = loadClassesFoundation();

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <ClassesSettingsSummary settings={settings} stats={stats} />

      <ClassesSettingsForm initial={settings} />

      <ClassesSection title="Checklist Snapshot">
        <ClassesChecklist items={checklist} />
      </ClassesSection>
    </div>
  );
}
