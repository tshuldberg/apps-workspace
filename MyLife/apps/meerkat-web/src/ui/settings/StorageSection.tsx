// StorageSection (slice 5): real, DB-derived local-device counts. Every figure
// is a count of rows present on THIS device (communities, channels, messages,
// sealed file blobs). No fabricated remote or peer numbers.
//
// Plan 38 C.7: a device-wide storage budget meter. The budget caps how much cache
// Meerkat keeps; only fetch_cache (not your own or kept items) is removed to stay
// under it. Every number comes from the real node store.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { NodeStore, PinClass } from '@mylife/sync';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { useView } from '../navigation/useView';
import { Button } from '../shell/Button';
import { formatBytes } from '../format';
import { deviceStorageMeter, setStorageBudget, type DeviceStorageMeter } from '../../lib/library-store';
import {
  STORAGE_BUDGET_PRESETS,
  STORAGE_BUDGET_EXCEEDED_ERROR,
  PIN_CLASS_LABEL,
  type LibraryPinStore,
} from '../../lib/library-storage-core';

export function StorageSection(): React.ReactElement {
  const m = useMeerkat();
  const { dispatch } = useView();
  // Recompute on every render; the stats are cheap DB reads and the surrounding
  // Modal re-renders on the provider revision after any write.
  const stats = m.storageStats();
  const db = m.db;
  const store = m.nodeStore as unknown as NodeStore & LibraryPinStore;

  const [meter, setMeter] = useState<DeviceStorageMeter | null>(null);
  const [meterError, setMeterError] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const refreshMeter = useCallback(() => {
    // The store walk can reject; without the catch the rejection is unhandled.
    // A failure renders honest copy (mirrors the mobile settings meter) instead
    // of silently omitting the usage line.
    void deviceStorageMeter(db, store)
      .then((m2) => { setMeter(m2); setMeterError(false); })
      .catch(() => { setMeter(null); setMeterError(true); });
  }, [db, store]);
  useEffect(() => { refreshMeter(); }, [refreshMeter, stats.localBytes]);

  // Synchronous single-flight: two fast clicks land before any re-render and
  // would run two evictions at once.
  const budgetBusyRef = useRef(false);
  const onPickBudget = (bytes: number | null): void => {
    if (budgetBusyRef.current) return;
    budgetBusyRef.current = true;
    setBudgetError(null);
    void setStorageBudget(db, store, bytes).then((plan) => {
      if (plan.impossible) setBudgetError(STORAGE_BUDGET_EXCEEDED_ERROR);
    }).catch(() => {
      setBudgetError('The budget change could not be applied. Try again.');
    }).finally(() => {
      budgetBusyRef.current = false;
      refreshMeter();
    });
  };

  return (
    <section className="mk-settings-section">
      <h3 className="mk-settings-section-title">Local file storage</h3>
      <div className="mk-stat-grid">
        <Stat label="Communities" value={String(stats.communities)} />
        <Stat label="Channels" value={String(stats.channels)} />
        <Stat label="Messages" value={String(stats.messages)} />
        <Stat label="Files" value={String(stats.localFiles)} />
        <Stat label="Stored" value={formatBytes(stats.localBytes)} />
      </div>
      <div className="mk-muted mk-settings-note">
        These are local-device counts: rows and encrypted file bytes present in this browser right now.
        They are not a community-wide total.
      </div>
      <Button
        variant="ghost"
        small
        onClick={() => {
          dispatch({ type: 'OPEN_DOWNLOADS' });
          dispatch({ type: 'CLOSE_OVERLAY' });
        }}
      >
        Open Downloads
      </Button>
      <Button
        variant="ghost"
        small
        onClick={() => dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'storage' } })}
      >
        Open Storage & Backup
      </Button>
      <div className="mk-muted mk-settings-note">
        Add a destination you control and Meerkat keeps an encrypted copy there. Nothing is backed up until a
        destination verifies a copy.
      </div>

      <h4 className="mk-settings-section-title" style={{ marginTop: 16 }}>Storage budget</h4>
      <div className="mk-lib-collections">
        {STORAGE_BUDGET_PRESETS.map((preset) => {
          const selected = (meter?.budgetBytes ?? null) === preset.bytes;
          return (
            <button
              key={preset.label}
              type="button"
              className={`mk-lib-collection-chip ${selected ? 'is-active' : ''}`}
              onClick={() => onPickBudget(preset.bytes)}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      {budgetError ? <div className="mk-box is-error" role="alert">{budgetError}</div> : null}
      {meter ? (
        <div className="mk-muted mk-settings-note">
          Using {formatBytes(meter.storedBytes)}
          {meter.budgetBytes !== null ? ` of ${formatBytes(meter.budgetBytes)}` : ' (no cap)'}.
          {(Object.keys(meter.breakdown) as PinClass[])
            .filter((cls) => meter.breakdown[cls].count > 0)
            .map((cls) => ` ${PIN_CLASS_LABEL[cls]}: ${meter.breakdown[cls].count} · ${formatBytes(meter.breakdown[cls].bytes)}.`)
            .join('')}
        </div>
      ) : meterError ? (
        <div className="mk-muted mk-settings-note">
          Storage usage could not be read. Reopen Settings to try again.
        </div>
      ) : null}
      <div className="mk-muted mk-settings-note">
        Your own items and anything you Keep on this device are never removed to fit the budget. If they
        alone are larger than the budget, Meerkat says so and removes nothing further.
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="mk-stat">
      <div className="mk-stat-value">{value}</div>
      <div className="mk-stat-label">{label}</div>
    </div>
  );
}
