'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import type {
  AssignmentView,
  ClassesSettings,
  GradeScale,
  ScheduleDensity,
  WeekStartsOn,
} from '@mylife/classes';
import { SettingsRow } from '../../../components/classes/SettingsRow';
import { saveClassesSettingsTyped } from './actions';
import { createTermAction } from '../actions';

const REMINDER_OPTIONS = [
  { label: '1h', value: 60 },
  { label: '1d', value: 1440 },
  { label: '3d', value: 4320 },
  { label: '1w', value: 10080 },
] as const;

type Status =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'error'; message: string };

const isDefaultsEverywhere = (settings: ClassesSettings): boolean => {
  return (
    !settings.activeTermLabel &&
    !settings.campusLabel &&
    settings.weekStartsOn === 'monday' &&
    settings.scheduleDensity === 'comfortable' &&
    settings.gradeScale === 'percent' &&
    settings.defaultStudyMinutes === 45 &&
    settings.focusBreakMinutes === 10 &&
    settings.assignmentView === 'upcoming' &&
    settings.assignmentReminderOffsets.length === 0 &&
    settings.showWeekends === false &&
    settings.requireBiometricLock === false &&
    settings.privacyConsentAcknowledgedAt === ''
  );
};

export function ClassesSettingsForm({ initial }: { initial: ClassesSettings }) {
  const [draft, setDraft] = useState<ClassesSettings>(initial);
  const [committed, setCommitted] = useState<ClassesSettings>(initial);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [pending, startTransition] = useTransition();
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const persist = (next: ClassesSettings) => {
    const previous = committed;
    setDraft(next);
    setCommitted(next);
    setStatus({ kind: 'saving' });
    startTransition(async () => {
      try {
        const result = await saveClassesSettingsTyped(next);
        if (!result.ok) {
          setDraft(previous);
          setCommitted(previous);
          setStatus({ kind: 'error', message: result.error });
          return;
        }
        setStatus({ kind: 'saved' });
      } catch (error) {
        setDraft(previous);
        setCommitted(previous);
        setStatus({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Failed to save settings.',
        });
      }
    });
  };

  const update = <K extends keyof ClassesSettings>(key: K, value: ClassesSettings[K]) => {
    persist({ ...draft, [key]: value });
  };

  const showFirstRunHint = isDefaultsEverywhere(initial);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {showFirstRunHint ? (
        <div style={firstRunStyle}>
          Defaults are sensible. Tweak only what matters to you.
        </div>
      ) : null}

      <StatusBanner status={status} pending={pending} />

      <SettingsGroup
        title="Schedule"
        description="How weeks render across the planner, and the term label that anchors everything."
      >
        <SettingsRow
          variant="child"
          label="Current term"
          description="Shown across schedule, assignments, and grades."
        >
          <input
            type="text"
            value={draft.activeTermLabel}
            placeholder="Fall 2026"
            onChange={(event) => setDraft({ ...draft, activeTermLabel: event.target.value })}
            onBlur={(event) => {
              if (event.target.value !== committed.activeTermLabel) {
                update('activeTermLabel', event.target.value);
              }
            }}
            style={textInputStyle}
          />
        </SettingsRow>
        <SettingsRow
          variant="child"
          label="Campus"
          description="Optional label for the school or campus."
        >
          <input
            type="text"
            value={draft.campusLabel}
            placeholder="North Hall"
            onChange={(event) => setDraft({ ...draft, campusLabel: event.target.value })}
            onBlur={(event) => {
              if (event.target.value !== committed.campusLabel) {
                update('campusLabel', event.target.value);
              }
            }}
            style={textInputStyle}
          />
        </SettingsRow>
        <SettingsRow
          variant="segmented"
          label="Week starts on"
          options={[
            { label: 'Monday', value: 'monday' as WeekStartsOn },
            { label: 'Sunday', value: 'sunday' as WeekStartsOn },
          ]}
          value={draft.weekStartsOn}
          onChange={(value) => update('weekStartsOn', value)}
        />
        <SettingsRow
          variant="toggle"
          label="Show weekends"
          description="Include Saturday and Sunday in the planner."
          value={draft.showWeekends}
          onChange={(value) => update('showWeekends', value)}
        />
        <SettingsRow
          variant="segmented"
          label="Schedule density"
          options={[
            { label: 'Comfortable', value: 'comfortable' as ScheduleDensity },
            { label: 'Compact', value: 'compact' as ScheduleDensity },
          ]}
          value={draft.scheduleDensity}
          onChange={(value) => update('scheduleDensity', value)}
        />
      </SettingsGroup>

      <CreateTermSection />

      <SettingsGroup
        title="Grading"
        description="How grades surface across class detail, scenarios, and term GPA."
      >
        <SettingsRow
          variant="segmented"
          label="Grade scale"
          options={[
            { label: 'Percent', value: 'percent' as GradeScale },
            { label: 'Letter', value: 'letter' as GradeScale },
            { label: '4.0 GPA', value: 'gpa_4' as GradeScale },
          ]}
          value={draft.gradeScale}
          onChange={(value) => update('gradeScale', value)}
        />
      </SettingsGroup>

      <SettingsGroup
        title="Study"
        description="Defaults for focus blocks and breaks across study sessions."
      >
        <SettingsRow
          variant="stepper"
          label="Default focus block"
          description="Length of one study block before a break."
          value={draft.defaultStudyMinutes}
          min={15}
          max={240}
          step={5}
          unit="min"
          onChange={(value) => update('defaultStudyMinutes', value)}
        />
        <SettingsRow
          variant="stepper"
          label="Break length"
          description="Recovery time between focus blocks."
          value={draft.focusBreakMinutes}
          min={0}
          max={60}
          step={1}
          unit="min"
          onChange={(value) => update('focusBreakMinutes', value)}
        />
      </SettingsGroup>

      <SettingsGroup
        title="Reminders"
        description="When MyClasses surfaces upcoming assignment due dates."
      >
        <SettingsRow
          variant="segmented"
          label="Default queue"
          options={[
            { label: 'Upcoming', value: 'upcoming' as AssignmentView },
            { label: 'Today', value: 'today' as AssignmentView },
            { label: 'By class', value: 'class' as AssignmentView },
          ]}
          value={draft.assignmentView}
          onChange={(value) => update('assignmentView', value)}
        />
        <SettingsRow<number>
          variant="chips"
          label="Reminder offsets"
          description="Pick one or more lead times for assignment reminders."
          options={REMINDER_OPTIONS.map((option) => ({ label: option.label, value: option.value }))}
          values={draft.assignmentReminderOffsets}
          onChange={(values) => update('assignmentReminderOffsets', values.sort((a, b) => a - b))}
        />
      </SettingsGroup>

      <SettingsGroup
        title="Privacy"
        description="MyClasses is local-first. Your school, parents, or teachers never see this data."
      >
        <SettingsRow
          variant="toggle"
          label="Require biometric lock"
          description="Biometric lock applies on iOS / Android. Web uses your device's OS lock."
          value={draft.requireBiometricLock}
          onChange={(value) => update('requireBiometricLock', value)}
        />
        <div style={privacyCardStyle}>
          <div style={privacyTitleStyle}>Local-first by design</div>
          <div style={privacyBodyStyle}>
            MyClasses data stays on this device. No analytics, no telemetry, no cloud sync
            (unless you enable backup explicitly).
          </div>
          <button
            type="button"
            onClick={() => {
              if (!draft.privacyConsentAcknowledgedAt) {
                update('privacyConsentAcknowledgedAt', new Date().toISOString());
              }
              setPrivacyOpen(true);
            }}
            style={learnMoreButtonStyle}
          >
            Learn more
          </button>
        </div>
      </SettingsGroup>

      <BackupRestoreSection />

      {privacyOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={modalBackdropStyle}
          onClick={() => setPrivacyOpen(false)}
        >
          <div style={modalCardStyle} onClick={(event) => event.stopPropagation()}>
            <h2 style={modalTitleStyle}>How MyClasses handles your data</h2>
            <p style={modalParagraphStyle}>
              What we store: semesters, classes, teachers, assignments, grades, study
              sessions, lifelong learning entries, degree progress, and applications. All of
              this is kept in a local SQLite database on your device.
            </p>
            <p style={modalParagraphStyle}>
              What we do not do: no analytics, no telemetry, no third-party trackers, and no
              cloud sync without explicit opt-in. There is no MyClasses server collecting
              your academic life.
            </p>
            <p style={modalParagraphStyle}>
              Sharing: any export of your data is initiated by you. Nothing leaves your
              device automatically. You decide when and where to share.
            </p>
            <p style={modalParagraphStyle}>
              Deletion: disabling the module hides MyClasses routes but preserves your data.
              Uninstalling MyLife removes the local database entirely.
            </p>
            <button
              type="button"
              onClick={() => setPrivacyOpen(false)}
              style={modalCloseButtonStyle}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CreateTermSection() {
  const [mode, setMode] = useState<'idle' | 'custom'>('idle');

  return (
    <SettingsGroup
      title="Terms"
      description="A class lives inside a term. Create one to start adding classes and lessons. Adult or hobby lessons can use an evergreen term that never expires."
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={termHelpStyle}>
          Not in school? Use the evergreen term so weekly lessons are not blocked
          by academic semester scaffolding.
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <form action={createTermAction}>
            <input type="hidden" name="evergreen" value="true" />
            <button type="submit" style={primaryButtonStyle}>
              Create evergreen term
            </button>
          </form>
          {mode === 'idle' ? (
            <button
              type="button"
              onClick={() => setMode('custom')}
              style={secondaryButtonStyle}
            >
              Create custom term
            </button>
          ) : null}
        </div>

        {mode === 'custom' ? (
          <form action={createTermAction} style={customTermFormStyle}>
            <div style={{ display: 'grid', gap: 6 }}>
              <label htmlFor="term-name" style={termFieldLabelStyle}>
                Term name
              </label>
              <input
                id="term-name"
                name="name"
                type="text"
                required
                placeholder="Fall 2026"
                style={termTextInputStyle}
              />
            </div>
            <div style={termDateRowStyle}>
              <div style={{ display: 'grid', gap: 6 }}>
                <label htmlFor="term-start" style={termFieldLabelStyle}>
                  Start date
                </label>
                <input
                  id="term-start"
                  name="start_date"
                  type="date"
                  style={termTextInputStyle}
                />
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <label htmlFor="term-end" style={termFieldLabelStyle}>
                  End date
                </label>
                <input
                  id="term-end"
                  name="end_date"
                  type="date"
                  style={termTextInputStyle}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <label htmlFor="term-institution" style={termFieldLabelStyle}>
                Institution (optional)
              </label>
              <input
                id="term-institution"
                name="institution"
                type="text"
                placeholder="North Hall"
                style={termTextInputStyle}
              />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button type="submit" style={primaryButtonStyle}>
                Save term
              </button>
              <button
                type="button"
                onClick={() => setMode('idle')}
                style={secondaryButtonStyle}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </SettingsGroup>
  );
}

function StatusBanner({ status, pending }: { status: Status; pending: boolean }) {
  if (status.kind === 'idle' && !pending) return null;
  let label = '';
  let tone: 'info' | 'success' | 'error' = 'info';
  if (pending || status.kind === 'saving') {
    label = 'Saving…';
    tone = 'info';
  } else if (status.kind === 'saved') {
    label = 'Saved.';
    tone = 'success';
  } else if (status.kind === 'error') {
    label = `Could not save: ${status.message}`;
    tone = 'error';
  }
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        ...statusBannerStyle,
        background:
          tone === 'success'
            ? 'rgba(48,209,88,0.14)'
            : tone === 'error'
              ? 'rgba(255,180,171,0.14)'
              : 'rgba(59,130,246,0.14)',
        borderColor:
          tone === 'success'
            ? 'rgba(48,209,88,0.4)'
            : tone === 'error'
              ? 'rgba(255,180,171,0.4)'
              : 'rgba(59,130,246,0.4)',
        color:
          tone === 'success' ? '#30D158' : tone === 'error' ? '#FFB4AB' : 'var(--accent-classes)',
      }}
    >
      {label}
    </div>
  );
}

type BackupStatus =
  | { kind: 'idle' }
  | { kind: 'busy'; label: string }
  | { kind: 'ok'; label: string }
  | { kind: 'error'; message: string };

function BackupRestoreSection() {
  const [status, setStatus] = useState<BackupStatus>({ kind: 'idle' });
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [previewSummary, setPreviewSummary] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const downloadJSON = () => {
    setStatus({ kind: 'busy', label: 'Preparing JSON…' });
    try {
      window.location.href = '/classes/export';
      setStatus({ kind: 'ok', label: 'Download started.' });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Export failed.',
      });
    }
  };

  const downloadCsv = (kind: 'grades' | 'assignments') => {
    setStatus({ kind: 'busy', label: `Preparing ${kind} CSV…` });
    try {
      window.location.href = `/classes/export/${kind}-csv`;
      setStatus({ kind: 'ok', label: 'Download started.' });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Export failed.',
      });
    }
  };

  const handlePreview = async (file: File) => {
    setPendingFile(file);
    setPreviewSummary(null);
    setStatus({ kind: 'busy', label: 'Reading import…' });
    try {
      const text = await file.text();
      const res = await fetch('/classes/import/preview', {
        method: 'POST',
        body: text,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? 'Preview failed.');
      }
      const plan = data.plan as {
        to_create: { table: string; count: number }[];
        to_update: { table: string; count: number }[];
        to_skip: { table: string; count: number; reason: string }[];
        warnings: string[];
      };
      const totalCreate = plan.to_create.reduce((s, p) => s + p.count, 0);
      const totalUpdate = plan.to_update.reduce((s, p) => s + p.count, 0);
      const totalSkip = plan.to_skip.reduce((s, p) => s + p.count, 0);
      const warn = plan.warnings.length > 0 ? ` Warnings: ${plan.warnings.length}.` : '';
      setPreviewSummary(
        `Will create ${totalCreate}, update ${totalUpdate}, skip ${totalSkip}.${warn}`,
      );
      setStatus({ kind: 'ok', label: 'Preview ready.' });
    } catch (error) {
      setPendingFile(null);
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Preview failed.',
      });
    }
  };

  const handleApply = async () => {
    if (!pendingFile) return;
    setStatus({ kind: 'busy', label: 'Importing…' });
    try {
      const text = await pendingFile.text();
      const res = await fetch(`/classes/import?mode=${importMode}`, {
        method: 'POST',
        body: text,
      });
      const data = await res.json();
      if (!res.ok) {
        const errs = Array.isArray(data.errors) ? data.errors.join('; ') : data.error;
        throw new Error(errs ?? 'Import failed.');
      }
      setStatus({ kind: 'ok', label: 'Import applied. Refresh to see changes.' });
      setPendingFile(null);
      setPreviewSummary(null);
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Import failed.',
      });
    }
  };

  return (
    <SettingsGroup
      title="Backup & restore"
      description="Export your MyClasses data locally, or restore from a previous export. Nothing leaves your device automatically."
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button type="button" onClick={downloadJSON} style={primaryButtonStyle}>
            Export full backup (JSON)
          </button>
          <button type="button" onClick={() => downloadCsv('grades')} style={secondaryButtonStyle}>
            Export grades (CSV)
          </button>
          <button
            type="button"
            onClick={() => downloadCsv('assignments')}
            style={secondaryButtonStyle}
          >
            Export assignments (CSV)
          </button>
        </div>

        <div style={importCardStyle}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            Restore from backup
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: '17px' }}>
            Choose merge to upsert into existing data. Replace clears local data first.
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={radioLabelStyle}>
              <input
                type="radio"
                name="myclasses-import-mode"
                value="merge"
                checked={importMode === 'merge'}
                onChange={() => setImportMode('merge')}
              />
              Merge
            </label>
            <label style={radioLabelStyle}>
              <input
                type="radio"
                name="myclasses-import-mode"
                value="replace"
                checked={importMode === 'replace'}
                onChange={() => setImportMode('replace')}
              />
              Replace
            </label>
          </div>

          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handlePreview(file);
            }}
            style={{ fontSize: 13, color: 'var(--text-secondary)' }}
          />

          {previewSummary ? (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{previewSummary}</div>
          ) : null}

          {pendingFile ? (
            <button
              type="button"
              onClick={() => void handleApply()}
              style={{
                ...primaryButtonStyle,
                background:
                  importMode === 'replace'
                    ? '#FFB4AB'
                    : 'var(--accent-classes, #3B82F6)',
              }}
            >
              Apply import ({importMode})
            </button>
          ) : null}
        </div>

        {status.kind !== 'idle' ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              ...statusBannerStyle,
              background:
                status.kind === 'ok'
                  ? 'rgba(48,209,88,0.14)'
                  : status.kind === 'error'
                    ? 'rgba(255,180,171,0.14)'
                    : 'rgba(59,130,246,0.14)',
              borderColor:
                status.kind === 'ok'
                  ? 'rgba(48,209,88,0.4)'
                  : status.kind === 'error'
                    ? 'rgba(255,180,171,0.4)'
                    : 'rgba(59,130,246,0.4)',
              color:
                status.kind === 'ok'
                  ? '#30D158'
                  : status.kind === 'error'
                    ? '#FFB4AB'
                    : 'var(--accent-classes)',
            }}
          >
            {status.kind === 'busy'
              ? status.label
              : status.kind === 'ok'
                ? status.label
                : `Error: ${status.message}`}
          </div>
        ) : null}
      </div>
    </SettingsGroup>
  );
}

const primaryButtonStyle: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 12,
  border: 'none',
  background: 'var(--accent-classes, #3B82F6)',
  color: 'var(--background)',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryButtonStyle: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--surface-elevated)',
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const importCardStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 14,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--surface-elevated)',
};

const radioLabelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 13,
  color: 'var(--text)',
  cursor: 'pointer',
};

const termHelpStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: '19px',
  color: 'var(--text-secondary)',
};

const customTermFormStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 14,
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--surface-elevated)',
};

const termDateRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: 12,
};

const termFieldLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
};

const termTextInputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 14,
};

function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section style={groupStyle}>
      <div style={{ display: 'grid', gap: 6, marginBottom: 8 }}>
        <h2 style={groupTitleStyle}>{title}</h2>
        <div style={groupDescStyle}>{description}</div>
      </div>
      <div style={{ display: 'grid' }}>{children}</div>
    </section>
  );
}

const firstRunStyle: CSSProperties = {
  padding: '14px 16px',
  borderRadius: 14,
  border: '1px dashed var(--accent-classes-border, rgba(59,130,246,0.28))',
  background: 'var(--accent-classes-dim, rgba(59,130,246,0.12))',
  color: 'var(--text-secondary)',
  fontSize: 14,
  lineHeight: '20px',
};

const statusBannerStyle: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  fontSize: 13,
  fontWeight: 600,
};

const groupStyle: CSSProperties = {
  padding: 20,
  borderRadius: 20,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
};

const groupTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 700,
  color: 'var(--text)',
};

const groupDescStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: '19px',
  color: 'var(--text-secondary)',
};

const textInputStyle: CSSProperties = {
  width: 220,
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--surface-elevated)',
  color: 'var(--text)',
  fontSize: 14,
};

const privacyCardStyle: CSSProperties = {
  padding: 16,
  borderRadius: 14,
  border: '1px solid var(--accent-classes-border, rgba(59,130,246,0.28))',
  background: 'var(--accent-classes-dim, rgba(59,130,246,0.10))',
  display: 'grid',
  gap: 6,
};

const privacyTitleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--text)',
};

const privacyBodyStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: '19px',
  color: 'var(--text-secondary)',
};

const learnMoreButtonStyle: CSSProperties = {
  alignSelf: 'flex-start',
  marginTop: 8,
  padding: '6px 0',
  background: 'transparent',
  border: 'none',
  color: 'var(--accent-classes, #3B82F6)',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};

const modalBackdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: 24,
};

const modalCardStyle: CSSProperties = {
  width: '100%',
  maxWidth: 560,
  maxHeight: '85vh',
  overflowY: 'auto',
  padding: 24,
  borderRadius: 20,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  display: 'grid',
  gap: 14,
};

const modalTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 700,
  color: 'var(--text)',
};

const modalParagraphStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: '21px',
  color: 'var(--text-secondary)',
};

const modalCloseButtonStyle: CSSProperties = {
  marginTop: 8,
  padding: '12px 16px',
  borderRadius: 999,
  border: 'none',
  background: 'var(--accent-classes, #3B82F6)',
  color: 'var(--background)',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
};
