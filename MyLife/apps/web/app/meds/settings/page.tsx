'use client';

import type { ReactNode, RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  doSetModuleSetting,
  doUpdateCaregiverRules,
  fetchSettingsPageData,
} from '../actions';
import {
  MEDS_FORM_WIDTH,
  MedsChip,
  MedsErrorState,
  MedsLoadingState,
  MedsMetricCard,
  MedsPageLead,
  MedsPageWrap,
  MedsPanel,
  MedsSectionTitle,
  MedsSymbol,
  formatClinicalDate,
  useMedsLoader,
} from '../ui';

type SettingsPageData = Awaited<ReturnType<typeof fetchSettingsPageData>>;
type SettingsDraft = SettingsPageData['settings'];

const SETTING_KEYS = {
  glucoseUnit: 'glucose.unit',
  weightUnit: 'weight.unit',
  medicationReminders: 'notifications.medication_reminders',
  caregiverAlerts: 'notifications.caregiver_alerts',
  biometricLock: 'security.biometric_lock',
  dataRetention: 'data.retention_policy',
  cgmIntegration: 'integrations.cgm_sync',
  exportFormat: 'data.default_export_format',
  researchMode: 'general.research_mode',
} satisfies Record<keyof SettingsDraft, string>;

const SECTION_CONFIG = [
  { key: 'general', label: 'General', icon: 'tune' },
  { key: 'notifications', label: 'Notifications', icon: 'notifications_active' },
  { key: 'security', label: 'Security', icon: 'shield_lock' },
  { key: 'data', label: 'Data', icon: 'database' },
  { key: 'integrations', label: 'Integrations', icon: 'device_hub' },
  { key: 'about', label: 'About', icon: 'info' },
] as const;

type SectionKey = (typeof SECTION_CONFIG)[number]['key'];

function SettingRow({
  label,
  description,
  control,
}: {
  label: string;
  description: string;
  control: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        alignItems: 'center',
        flexWrap: 'wrap',
        padding: 18,
        borderRadius: 22,
        background: 'rgba(31,31,37,0.76)',
      }}
    >
      <div className="meds-stack" style={{ maxWidth: 520 }}>
        <strong style={{ fontSize: 15 }}>{label}</strong>
        <span style={{ color: 'rgba(214,195,181,0.68)', fontSize: 13 }}>{description}</span>
      </div>
      <div style={{ minWidth: 180 }}>{control}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="meds-row" style={{ justifyContent: 'flex-end', cursor: disabled ? 'not-allowed' : 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 12 }}>{checked ? 'On' : 'Off'}</span>
    </label>
  );
}

export default function SettingsPage() {
  const { data, loading, error, setData } = useMedsLoader(fetchSettingsPageData, []);
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [alertMethod, setAlertMethod] = useState<SettingsPageData['alertConfig']['alertMethod']>('both');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const generalRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const securityRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<HTMLDivElement>(null);
  const integrationsRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);

  const refs: Record<SectionKey, RefObject<HTMLDivElement | null>> = {
    general: generalRef,
    notifications: notificationsRef,
    security: securityRef,
    data: dataRef,
    integrations: integrationsRef,
    about: aboutRef,
  };

  useEffect(() => {
    if (data) {
      setDraft(data.settings);
      setAlertMethod(data.alertConfig.alertMethod);
    }
  }, [data]);

  async function refresh() {
    const next = await fetchSettingsPageData();
    setData(next);
    setDraft(next.settings);
    setAlertMethod(next.alertConfig.alertMethod);
    return next;
  }

  async function saveSetting<Key extends keyof SettingsDraft>(field: Key, value: SettingsDraft[Key]) {
    if (!draft) {
      return;
    }

    setDraft((current) => (current ? { ...current, [field]: value } : current));
    setBusyKey(String(field));
    setNotice(null);
    try {
      const serialized = String(value);
      await doSetModuleSetting(SETTING_KEYS[field], serialized);
      await refresh();
      setNotice('Settings updated.');
    } catch (saveError) {
      setNotice(saveError instanceof Error ? saveError.message : 'Unable to save settings.');
      await refresh();
    } finally {
      setBusyKey(null);
    }
  }

  async function saveAlertMethod(nextMethod: SettingsPageData['alertConfig']['alertMethod']) {
    if (!data) {
      return;
    }

    setAlertMethod(nextMethod);
    setBusyKey('alertMethod');
    setNotice(null);
    try {
      await doUpdateCaregiverRules({
        ...data.alertConfig,
        alertMethod: nextMethod,
      });
      await refresh();
      setNotice('Caregiver routing updated.');
    } catch (saveError) {
      setNotice(saveError instanceof Error ? saveError.message : 'Unable to save caregiver routing.');
      await refresh();
    } finally {
      setBusyKey(null);
    }
  }

  function jumpTo(section: SectionKey) {
    refs[section].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (loading) {
    return <MedsLoadingState label="Loading module settings…" />;
  }

  if (error || !data || !draft) {
    return <MedsErrorState message={error ?? 'Unable to load module settings.'} />;
  }

  return (
    <MedsPageWrap>
      <div style={{ display: 'grid', gap: 24 }}>
        <MedsPageLead
          eyebrow="Phase 8 / P8-D"
          title="Module settings"
          description="A dedicated operational settings surface for units, notification posture, data handling, security, and integrations. Every control writes through the meds module actions."
          actions={
            <>
              <MedsChip tone={busyKey ? 'warning' : 'cyan'}>
                {busyKey ? `Saving ${busyKey}...` : 'Local settings'}
              </MedsChip>
              <span style={{ color: 'rgba(214,195,181,0.66)', fontSize: 13 }}>
                Synced {formatClinicalDate(data.generatedAt)}
              </span>
            </>
          }
        />

        <div className="meds-grid-4">
          <MedsMetricCard label="Caregivers" value={data.caregivers.length} note="Linked support contacts" icon="family_restroom" tone="gold" />
          <MedsMetricCard label="Alert rules" value={data.alertConfig.rules.filter((item) => item.enabled).length} note={alertMethod.toUpperCase()} icon="notification_important" tone="cyan" />
          <MedsMetricCard label="Export format" value={draft.exportFormat.toUpperCase()} note={`${draft.dataRetention.replace(/_/g, ' ')} retention`} icon="assignment" tone="warning" />
          <MedsMetricCard label="CGM sync" value={draft.cgmIntegration ? 'Enabled' : 'Paused'} note={`Glucose unit ${draft.glucoseUnit}`} icon="device_hub" tone="success" />
        </div>

        {notice ? (
          <MedsPanel tone="muted">
            <div className="meds-row" style={{ justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(214,195,181,0.78)', fontSize: 14 }}>{notice}</span>
              <button type="button" className="meds-action-secondary" onClick={() => setNotice(null)}>
                Dismiss
              </button>
            </div>
          </MedsPanel>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: '240px minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
          <MedsPanel tone="muted" style={{ position: 'sticky', top: 108 }}>
            <MedsSectionTitle label="Sections" title="Jump to" />
            <div className="meds-list">
              {SECTION_CONFIG.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  className="meds-action-secondary"
                  style={{ justifyContent: 'flex-start' }}
                  onClick={() => jumpTo(section.key)}
                >
                  <MedsSymbol name={section.icon} size={18} />
                  {section.label}
                </button>
              ))}
            </div>
          </MedsPanel>

          <div style={{ maxWidth: MEDS_FORM_WIDTH, display: 'grid', gap: 18 }}>
            <div ref={generalRef}>
              <MedsPanel tone="accent">
                <MedsSectionTitle label="General" title="Units and defaults" />
                <div className="meds-list">
                  <SettingRow
                    label="Blood glucose units"
                    description="Set the default unit used across glucose, CGM, and exported summaries."
                    control={
                      <select
                        className="meds-select"
                        value={draft.glucoseUnit}
                        disabled={busyKey === 'glucoseUnit'}
                        onChange={(event) => saveSetting('glucoseUnit', event.target.value)}
                      >
                        <option value="mg/dL">mg/dL</option>
                        <option value="mmol/L">mmol/L</option>
                      </select>
                    }
                  />
                  <SettingRow
                    label="Weight measurement"
                    description="Controls how weight-related measurements are labeled in vitals views and doctor exports."
                    control={
                      <select
                        className="meds-select"
                        value={draft.weightUnit}
                        disabled={busyKey === 'weightUnit'}
                        onChange={(event) => saveSetting('weightUnit', event.target.value)}
                      >
                        <option value="kg">kg</option>
                        <option value="lb">lb</option>
                      </select>
                    }
                  />
                  <SettingRow
                    label="Research mode"
                    description="Unlock research-oriented copy and denser analytics framing inside the clinical dashboard."
                    control={
                      <Toggle
                        checked={draft.researchMode}
                        disabled={busyKey === 'researchMode'}
                        onChange={(value) => saveSetting('researchMode', value)}
                      />
                    }
                  />
                </div>
              </MedsPanel>
            </div>

            <div ref={notificationsRef}>
              <MedsPanel>
                <MedsSectionTitle label="Notifications" title="Escalation and reminders" />
                <div className="meds-list">
                  <SettingRow
                    label="Medication reminders"
                    description="Show routine dose reminders inside the web and mobile shells."
                    control={
                      <Toggle
                        checked={draft.medicationReminders}
                        disabled={busyKey === 'medicationReminders'}
                        onChange={(value) => saveSetting('medicationReminders', value)}
                      />
                    }
                  />
                  <SettingRow
                    label="Caregiver alerts"
                    description="Enable caregiver escalation when rules fire from blood pressure, glucose, or missed-dose workflows."
                    control={
                      <Toggle
                        checked={draft.caregiverAlerts}
                        disabled={busyKey === 'caregiverAlerts'}
                        onChange={(value) => saveSetting('caregiverAlerts', value)}
                      />
                    }
                  />
                  <SettingRow
                    label="Default caregiver delivery"
                    description="Choose whether caregiver alerts default to SMS, email, or both channels."
                    control={
                      <select
                        className="meds-select"
                        value={alertMethod}
                        disabled={busyKey === 'alertMethod'}
                        onChange={(event) =>
                          saveAlertMethod(event.target.value as SettingsPageData['alertConfig']['alertMethod'])
                        }
                      >
                        <option value="both">SMS and email</option>
                        <option value="sms">SMS only</option>
                        <option value="email">Email only</option>
                      </select>
                    }
                  />
                </div>
              </MedsPanel>
            </div>

            <div ref={securityRef}>
              <MedsPanel>
                <MedsSectionTitle label="Security" title="Access control" />
                <div className="meds-list">
                  <SettingRow
                    label="Biometric lock"
                    description="Require a biometric unlock before opening sensitive clinical history and caregiver details."
                    control={
                      <Toggle
                        checked={draft.biometricLock}
                        disabled={busyKey === 'biometricLock'}
                        onChange={(value) => saveSetting('biometricLock', value)}
                      />
                    }
                  />
                </div>
              </MedsPanel>
            </div>

            <div ref={dataRef}>
              <MedsPanel tone="muted">
                <MedsSectionTitle label="Data" title="Retention and exports" />
                <div className="meds-list">
                  <SettingRow
                    label="Retention policy"
                    description="Defines the default retention period used when building reports or pruning old module data."
                    control={
                      <select
                        className="meds-select"
                        value={draft.dataRetention}
                        disabled={busyKey === 'dataRetention'}
                        onChange={(event) => saveSetting('dataRetention', event.target.value)}
                      >
                        <option value="1_year">1 year</option>
                        <option value="3_years">3 years</option>
                        <option value="7_years">7 years</option>
                        <option value="forever">Forever</option>
                      </select>
                    }
                  />
                  <SettingRow
                    label="Default export format"
                    description="Prefill the report workflow with the format used most often by you or your clinical team."
                    control={
                      <select
                        className="meds-select"
                        value={draft.exportFormat}
                        disabled={busyKey === 'exportFormat'}
                        onChange={(event) => saveSetting('exportFormat', event.target.value)}
                      >
                        <option value="pdf">PDF</option>
                        <option value="csv">CSV</option>
                        <option value="json">JSON</option>
                      </select>
                    }
                  />
                </div>
              </MedsPanel>
            </div>

            <div ref={integrationsRef}>
              <MedsPanel tone="accent">
                <MedsSectionTitle label="Integrations" title="Connected systems" />
                <div className="meds-list">
                  <SettingRow
                    label="CGM sync"
                    description="Allow the module to surface sensor sync status, recent readings, and CGM-powered glucose summaries."
                    control={
                      <Toggle
                        checked={draft.cgmIntegration}
                        disabled={busyKey === 'cgmIntegration'}
                        onChange={(value) => saveSetting('cgmIntegration', value)}
                      />
                    }
                  />
                </div>
              </MedsPanel>
            </div>

            <div ref={aboutRef}>
              <MedsPanel>
                <MedsSectionTitle label="About" title="Module snapshot" />
                <div className="meds-list">
                  <div className="meds-row" style={{ justifyContent: 'space-between' }}>
                    <span>Last sync</span>
                    <strong>{formatClinicalDate(data.generatedAt)}</strong>
                  </div>
                  <div className="meds-row" style={{ justifyContent: 'space-between' }}>
                    <span>Linked caregivers</span>
                    <strong>{data.caregivers.length}</strong>
                  </div>
                  <div className="meds-row" style={{ justifyContent: 'space-between' }}>
                    <span>Enabled caregiver rules</span>
                    <strong>{data.alertConfig.rules.filter((item) => item.enabled).length}</strong>
                  </div>
                  <div className="meds-row" style={{ justifyContent: 'space-between' }}>
                    <span>Clinical routes using these settings</span>
                    <strong>Dashboard, CGM, Export</strong>
                  </div>
                </div>
              </MedsPanel>
            </div>
          </div>
        </div>
      </div>
    </MedsPageWrap>
  );
}
