'use client';

import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import {
  doExportFoodLog,
  doExportNutritionSummary,
  fetchAllSettings,
  fetchDailyNotesByRange,
} from '../actions';
import { NUTRITION_CHROME, alpha } from '../_lib/design';
import { NutritionButton, NutritionPageHeader, NutritionPanel } from '../_components/NutritionPrimitives';

type ExportFormat = 'csv' | 'json';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function NutritionExportPage() {
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [includeFoodLog, setIncludeFoodLog] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeSettings, setIncludeSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewCount = useMemo(
    () => [includeFoodLog, includeSummary, includeNotes, includeSettings].filter(Boolean).length,
    [includeFoodLog, includeNotes, includeSettings, includeSummary],
  );

  async function handleDownload() {
    setBusy(true);
    setError(null);
    try {
      const [foodLogCsv, summaryCsv, notes, settings] = await Promise.all([
        includeFoodLog ? doExportFoodLog(startDate, endDate) : Promise.resolve(''),
        includeSummary ? doExportNutritionSummary(startDate, endDate) : Promise.resolve(''),
        includeNotes ? fetchDailyNotesByRange(startDate, endDate) : Promise.resolve([]),
        includeSettings ? fetchAllSettings() : Promise.resolve({}),
      ]);

      if (format === 'csv') {
        const sections: string[] = [];
        if (includeFoodLog) sections.push(`# FOOD LOG\n${foodLogCsv}`);
        if (includeSummary) sections.push(`# DAILY SUMMARY\n${summaryCsv}`);
        if (includeNotes) {
          const noteRows = (notes as Array<{ date: string; content: string; tags: string[] | null }>)
            .map((note) => `${note.date},"${note.content.replace(/"/g, '""')}","${(note.tags ?? []).join('|')}"`);
          sections.push(`# NOTES\ndate,content,tags\n${noteRows.join('\n')}`);
        }
        if (includeSettings) {
          const settingRows = Object.entries(settings as Record<string, string>)
            .map(([key, value]) => `${key},"${value.replace(/"/g, '""')}"`);
          sections.push(`# SETTINGS\nkey,value\n${settingRows.join('\n')}`);
        }
        downloadFile(`nutrition-export-${startDate}-to-${endDate}.csv`, sections.join('\n\n'), 'text/csv');
      } else {
        const payload = {
          range: { startDate, endDate },
          exportedAt: new Date().toISOString(),
          sections: {
            foodLogCsv: includeFoodLog ? foodLogCsv : null,
            nutritionSummaryCsv: includeSummary ? summaryCsv : null,
            notes: includeNotes ? notes : [],
            settings: includeSettings ? settings : {},
          },
        };
        downloadFile(
          `nutrition-export-${startDate}-to-${endDate}.json`,
          JSON.stringify(payload, null, 2),
          'application/json',
        );
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to prepare export.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 1040 }}>
      <NutritionPageHeader
        title="Export Data"
        description="Choose a date range, pick the sections you want, and download either a stitched CSV package or a JSON snapshot."
        action={<NutritionButton tone="accent" onClick={() => void handleDownload()} disabled={busy}>{busy ? 'Preparing…' : 'Download Export'}</NutritionButton>}
      />

      <NutritionPanel tone="focus" style={{ padding: 24 }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            <label style={fieldStyle}>
              <span>Start date</span>
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span>End date</span>
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span>Format</span>
              <select value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)} style={inputStyle}>
                <option value="csv">CSV package</option>
                <option value="json">JSON snapshot</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <ToggleCard title="Food log rows" checked={includeFoodLog} onChange={setIncludeFoodLog} />
            <ToggleCard title="Daily summary" checked={includeSummary} onChange={setIncludeSummary} />
            <ToggleCard title="Notes" checked={includeNotes} onChange={setIncludeNotes} />
            <ToggleCard title="Settings" checked={includeSettings} onChange={setIncludeSettings} />
          </div>
        </div>
      </NutritionPanel>

      <NutritionPanel style={{ padding: 22 }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <strong style={{ fontSize: 20 }}>Preview</strong>
          <span style={{ color: NUTRITION_CHROME.textMuted, lineHeight: 1.7 }}>
            {previewCount} section{previewCount === 1 ? '' : 's'} selected for export from {startDate} to {endDate}.
            CSV packages include section headers. JSON exports preserve the raw text payloads and note/settings structure.
          </span>
          {error ? <div style={{ color: NUTRITION_CHROME.danger }}>{error}</div> : null}
        </div>
      </NutritionPanel>
    </div>
  );
}

function ToggleCard({
  title,
  checked,
  onChange,
}: {
  title: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        minHeight: 68,
        padding: '0 18px',
        borderRadius: 20,
        border: 'none',
        cursor: 'pointer',
        background: checked ? alpha(NUTRITION_CHROME.accent, 0.14) : alpha('#FFFFFF', 0.04),
        boxShadow: checked ? `inset 0 0 0 1.5px ${alpha(NUTRITION_CHROME.accent, 0.24)}` : 'none',
        color: checked ? NUTRITION_CHROME.text : NUTRITION_CHROME.textMuted,
      }}
    >
      <span style={{ fontWeight: 700 }}>{title}</span>
      <span style={{ width: 22, height: 22, borderRadius: 999, background: checked ? NUTRITION_CHROME.accent : alpha('#FFFFFF', 0.12) }} />
    </button>
  );
}

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  color: NUTRITION_CHROME.textMuted,
};

const inputStyle: CSSProperties = {
  minHeight: 44,
  padding: '0 14px',
  borderRadius: 14,
  border: `1.5px solid ${alpha('#FFFFFF', 0.08)}`,
  background: alpha('#FFFFFF', 0.04),
  color: NUTRITION_CHROME.text,
};
