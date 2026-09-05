import Link from 'next/link';
import {
  createClassFromScheduleAction,
  createTermAction,
  selectSemesterByIdAction,
} from './actions';
import {
  loadClassesFoundation,
  loadOfficeHoursWidget,
  loadScheduleView,
} from './data';
import {
  ClassesHero,
  ClassesMetricRow,
  ClassesSection,
  pillLinkStyle,
} from './ui';
import { WeeklySchedule } from '@/components/classes/WeeklySchedule';
import { SemesterPicker } from '@/components/classes/SemesterPicker';
import { AddClassDialog } from '@/components/classes/AddClassDialog';
import { OfficeHoursWidget } from '@/components/classes/OfficeHoursWidget';

export default function ClassesSchedulePage() {
  const { settings, stats } = loadClassesFoundation();
  const view = loadScheduleView();
  const officeHours = loadOfficeHoursWidget();

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <ClassesHero
        badge={settings.activeTermLabel.trim() || 'Schedule'}
        title={
          settings.activeTermLabel.trim()
            ? `${settings.activeTermLabel} schedule`
            : 'Your weekly schedule'
        }
        body="Tap a colored block to open the class. Switch semesters to compare terms. Add a class to start filling in your week."
        actionHref="/classes/settings"
        actionLabel="Settings"
      />

      <ClassesMetricRow
        items={[
          {
            label: 'Semester',
            value:
              view.semesters.find((s) => s.id === view.activeSemesterId)?.name ??
              'None',
          },
          { label: 'Classes', value: String(view.blocks.length) },
          {
            label: 'Conflicts',
            value:
              view.conflicts.length === 0
                ? 'None'
                : `${view.conflicts.length} overlap${view.conflicts.length === 1 ? '' : 's'}`,
          },
        ]}
      />

      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <SemesterPicker
          semesters={view.semesters}
          selectedId={view.activeSemesterId}
          onSelect={selectSemesterByIdAction}
        />
        {view.activeSemesterId ? (
          <AddClassDialog
            semesterId={view.activeSemesterId}
            teachers={view.teachers}
            onSubmit={createClassFromScheduleAction}
          />
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <form action={createTermAction}>
              <input type="hidden" name="evergreen" value="true" />
              <button
                type="submit"
                style={{ ...pillLinkStyle(true), cursor: 'pointer' }}
              >
                Create a term
              </button>
            </form>
            <Link href="/classes/settings" style={pillLinkStyle(false)}>
              More term options
            </Link>
          </div>
        )}
      </div>

      <ClassesSection title="Week View">
        {view.activeSemesterId && view.blocks.length > 0 ? (
          <WeeklySchedule
            blocks={view.blocks}
            conflicts={view.conflicts}
            showWeekends={settings.showWeekends}
          />
        ) : (
          <div
            style={{
              borderRadius: 16,
              border: '1px dashed rgba(59,130,246,0.45)',
              background: 'var(--glass)',
              padding: 32,
              display: 'grid',
              gap: 12,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
              {view.activeSemesterId ? 'No classes yet' : 'No term yet'}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              {view.activeSemesterId
                ? 'Use the Add Class button to add your first class.'
                : 'A class lives inside a term. Create one to add your first class or lesson.'}
            </div>
            {view.activeSemesterId ? null : (
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                }}
              >
                <form action={createTermAction}>
                  <input type="hidden" name="evergreen" value="true" />
                  <button
                    type="submit"
                    style={{ ...pillLinkStyle(true), cursor: 'pointer' }}
                  >
                    Create a term
                  </button>
                </form>
                <Link href="/classes/settings" style={pillLinkStyle(false)}>
                  More term options
                </Link>
              </div>
            )}
          </div>
        )}
      </ClassesSection>

      <OfficeHoursWidget items={officeHours} />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link href="/classes/assignments" style={pillLinkStyle(false)}>
          Assignments
        </Link>
        <Link href="/classes/grades" style={pillLinkStyle(false)}>
          Grades
        </Link>
        <Link href="/classes/study" style={pillLinkStyle(false)}>
          Study
        </Link>
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 12,
          color: 'var(--text-tertiary)',
          textAlign: 'center',
        }}
      >
        Reminders: {stats.reminderSummary} · Study rhythm: {stats.dailyFocusLabel}
      </p>
    </div>
  );
}
