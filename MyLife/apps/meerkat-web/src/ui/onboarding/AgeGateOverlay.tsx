// AgeGateOverlay: web twin of the mobile neutral first-launch age gate (legal
// readiness 2026-07-18). Mounts BEFORE OnboardingOverlay; App.tsx renders
// onboarding only after this gate passes, so the two never co-present.
// Neutral entry (no threshold hint before an answer), durable underage lock,
// and the birth date is never persisted.

import { useRef, useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { Modal } from '../shell/Modal';
import { Button } from '../shell/Button';
import { TextField } from '../shell/Field';
import { HonestNotice } from '../shell/HonestNotice';
import {
  configuredMinimumAge,
  isAgeGateLocked,
  submitAgeGateBirthDate,
} from '../../lib/age-gate';

const ENTRY_ERROR_COPY: Record<'invalid_date' | 'in_future' | 'implausible', string> = {
  invalid_date: 'That date does not exist. Check the month and day.',
  in_future: 'That date is in the future. Enter your real birth date.',
  implausible: 'That date is not plausible. Check the year.',
};

export function AgeGateOverlay({ onPassed }: { onPassed: () => void }): React.ReactElement {
  const m = useMeerkat();
  const [locked, setLocked] = useState(() => isAgeGateLocked(m.db));
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');
  const [error, setError] = useState<string | null>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  const submit = (): void => {
    const result = submitAgeGateBirthDate(m.db, {
      year: Number.parseInt(year, 10),
      month: Number.parseInt(month, 10),
      day: Number.parseInt(day, 10),
    });
    if (result.ok) {
      onPassed();
      return;
    }
    if (result.reason === 'underage') {
      setLocked(true);
      return;
    }
    setError(ENTRY_ERROR_COPY[result.reason]);
  };

  if (locked) {
    return (
      <Modal title="Meerkat is not available for you yet" onClose={() => undefined} locked>
        <HonestNotice>
          You do not meet the minimum age requirement ({configuredMinimumAge()}+) to use Meerkat.
          This browser stays locked; your birth date was not saved.
        </HonestNotice>
      </Modal>
    );
  }

  const complete = month.length > 0 && day.length > 0 && year.length === 4;

  return (
    <Modal title="When were you born?" onClose={() => undefined} locked>
      <p className="mk-muted">
        We ask once to confirm you can use Meerkat. Your birth date is checked in this browser and
        never stored or sent anywhere.
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <TextField
          label="Month"
          placeholder="MM"
          inputMode="numeric"
          value={month}
          onChange={(e) => {
            setError(null);
            const next = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
            setMonth(next);
            if (next.length === 2) dayRef.current?.focus();
          }}
        />
        <TextField
          ref={dayRef}
          label="Day"
          placeholder="DD"
          inputMode="numeric"
          value={day}
          onChange={(e) => {
            setError(null);
            const next = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
            setDay(next);
            if (next.length === 2) yearRef.current?.focus();
          }}
        />
        <TextField
          ref={yearRef}
          label="Year"
          placeholder="YYYY"
          inputMode="numeric"
          value={year}
          onChange={(e) => {
            setError(null);
            const next = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
            setYear(next);
            if (next.length === 4) yearRef.current?.blur();
          }}
        />
      </div>
      {error ? <HonestNotice>{error}</HonestNotice> : null}
      <Button onClick={submit} disabled={!complete}>Continue</Button>
    </Modal>
  );
}
