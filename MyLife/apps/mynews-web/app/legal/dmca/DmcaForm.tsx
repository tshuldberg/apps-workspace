'use client';

import { useState } from 'react';
import {
  DMCA_ATTESTATION_VERSION,
  DMCA_COUNTER_JURISDICTION_ATTESTATION_TEXT,
  DMCA_COUNTER_MISTAKE_ATTESTATION_TEXT,
  DMCA_COUNTER_SERVICE_ATTESTATION_TEXT,
  DMCA_TAKEDOWN_ACCURACY_ATTESTATION_TEXT,
  DMCA_TAKEDOWN_GOOD_FAITH_ATTESTATION_TEXT,
  dmcaErrorMessage,
  validateDmcaNotice,
  type DmcaErrorCode,
  type DmcaNoticeKind,
} from '@mylife/mynews/cloud-fetch';

interface SubmissionReceipt {
  status: 'queued';
  referenceId: string;
  resolutionStatus: 'resolved' | 'needs-resolution';
  originalNoticeMatched?: boolean;
}

/** Public, anonymous DMCA intake with distinct statutory forms. */
export function DmcaForm() {
  const [kind, setKind] = useState<DmcaNoticeKind>('takedown');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [workOrMaterial, setWorkOrMaterial] = useState('');
  const [location, setLocation] = useState('');
  const [originalNoticeReference, setOriginalNoticeReference] = useState('');
  const [goodFaith, setGoodFaith] = useState(false);
  const [accuracy, setAccuracy] = useState(false);
  const [mistake, setMistake] = useState(false);
  const [perjury, setPerjury] = useState(false);
  const [jurisdiction, setJurisdiction] = useState(false);
  const [service, setService] = useState(false);
  const [signature, setSignature] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const payload =
      kind === 'takedown'
        ? {
            kind,
            complainantName: name.trim(),
            complainantEmail: email.trim(),
            complainantAddress: address.trim(),
            copyrightedWork: workOrMaterial.trim(),
            infringingUrl: location.trim(),
            goodFaith,
            goodFaithAttestationText: DMCA_TAKEDOWN_GOOD_FAITH_ATTESTATION_TEXT,
            goodFaithAttestationVersion: DMCA_ATTESTATION_VERSION,
            accuracyUnderPenalty: accuracy,
            accuracyAttestationText: DMCA_TAKEDOWN_ACCURACY_ATTESTATION_TEXT,
            accuracyAttestationVersion: DMCA_ATTESTATION_VERSION,
            signature: signature.trim(),
          }
        : {
            kind,
            originalNoticeReference: originalNoticeReference.trim(),
            counterNotifierName: name.trim(),
            counterNotifierAddress: address.trim(),
            counterNotifierPhone: phone.trim(),
            counterNotifierEmail: email.trim(),
            removedMaterial: workOrMaterial.trim(),
            materialLocationBeforeRemoval: location.trim(),
            goodFaithMistakeOrMisidentification: mistake,
            statementUnderPenaltyOfPerjury: perjury,
            mistakeAttestationText: DMCA_COUNTER_MISTAKE_ATTESTATION_TEXT,
            mistakeAttestationVersion: DMCA_ATTESTATION_VERSION,
            consentToFederalJurisdiction: jurisdiction,
            jurisdictionAttestationText: DMCA_COUNTER_JURISDICTION_ATTESTATION_TEXT,
            jurisdictionAttestationVersion: DMCA_ATTESTATION_VERSION,
            acceptanceOfServiceOfProcess: service,
            serviceAttestationText: DMCA_COUNTER_SERVICE_ATTESTATION_TEXT,
            serviceAttestationVersion: DMCA_ATTESTATION_VERSION,
            signature: signature.trim(),
          };

    if (!validateDmcaNotice(payload).ok) {
      setError(dmcaErrorMessage('validation').message);
      return;
    }

    setBusy(true);
    try {
      const response = await fetch('/api/dmca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as
        | { ok: true; data: SubmissionReceipt }
        | { ok: false; error?: string }
        | null;
      if (body?.ok && body.data.status === 'queued' && body.data.referenceId) {
        setReceipt(body.data);
      } else {
        setError(
          dmcaErrorMessage(mapCode(body && !body.ok ? body.error : undefined)).message,
        );
      }
    } catch {
      setError(dmcaErrorMessage('network').message);
    } finally {
      setBusy(false);
    }
  }

  if (receipt) {
    return (
      <div className="card report-card" role="status">
        <h2 className="card-title">Submission queued</h2>
        <p className="card-body">
          Your {kind === 'counter' ? 'counter-notice' : 'takedown notice'} is in the moderation
          queue. Reference ID: <strong className="mono">{receipt.referenceId}</strong>.
        </p>
        {receipt.resolutionStatus === 'needs-resolution' ? (
          <p className="card-body">
            We could not match the submitted URL to a current public record automatically. The
            submission remains queued with status <strong>needs-resolution</strong> for manual
            review.
          </p>
        ) : (
          <p className="card-body">
            The submitted URL matched a public MyNews record and the queue item includes that target.
          </p>
        )}
        {kind === 'counter' && receipt.originalNoticeMatched === false ? (
          <p className="card-body">
            The original notice reference did not match automatically. Your counter-notice remains
            queued for manual linking.
          </p>
        ) : null}
        <p className="card-body">Keep the reference ID and a copy of your submission.</p>
      </div>
    );
  }

  const isCounter = kind === 'counter';
  return (
    <form className="dmca-form" onSubmit={onSubmit}>
      <label className="dmca-field">
        <span>Submission type</span>
        <select value={kind} onChange={(event) => setKind(event.target.value as DmcaNoticeKind)}>
          <option value="takedown">Takedown notice</option>
          <option value="counter">Counter-notice</option>
        </select>
      </label>

      {isCounter ? (
        <label className="dmca-field">
          <span>Original takedown notice reference ID (if known)</span>
          <input
            value={originalNoticeReference}
            onChange={(event) => setOriginalNoticeReference(event.target.value)}
          />
        </label>
      ) : null}

      <label className="dmca-field">
        <span>Your full legal name</span>
        <input value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label className="dmca-field">
        <span>Contact email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <label className="dmca-field">
        <span>{isCounter ? 'Mailing address' : 'Mailing address (optional)'}</span>
        <input
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          required={isCounter}
        />
      </label>
      {isCounter ? (
        <label className="dmca-field">
          <span>Telephone number</span>
          <input value={phone} onChange={(event) => setPhone(event.target.value)} required />
        </label>
      ) : null}
      <label className="dmca-field">
        <span>
          {isCounter
            ? 'Identification of the material that was removed or disabled'
            : 'Identification of the copyrighted work you claim was infringed'}
        </span>
        <textarea
          value={workOrMaterial}
          onChange={(event) => setWorkOrMaterial(event.target.value)}
          required
        />
      </label>
      <label className="dmca-field">
        <span>
          {isCounter
            ? 'Public URL where the material appeared before removal'
            : 'Public URL of the allegedly infringing material'}
        </span>
        <input
          type="url"
          placeholder="https://mynews.app/a/article-slug or /j/handle or /e/handle"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          required
        />
      </label>

      {isCounter ? (
        <>
          <Attestation checked={mistake} onChange={setMistake} text={COUNTER_MISTAKE_TEXT} />
          <Attestation
            checked={perjury}
            onChange={setPerjury}
            text="I make the mistake-or-misidentification statement above under penalty of perjury."
          />
          <Attestation
            checked={jurisdiction}
            onChange={setJurisdiction}
            text={DMCA_COUNTER_JURISDICTION_ATTESTATION_TEXT}
          />
          <Attestation
            checked={service}
            onChange={setService}
            text={DMCA_COUNTER_SERVICE_ATTESTATION_TEXT}
          />
        </>
      ) : (
        <>
          <Attestation
            checked={goodFaith}
            onChange={setGoodFaith}
            text={DMCA_TAKEDOWN_GOOD_FAITH_ATTESTATION_TEXT}
          />
          <Attestation
            checked={accuracy}
            onChange={setAccuracy}
            text={DMCA_TAKEDOWN_ACCURACY_ATTESTATION_TEXT}
          />
        </>
      )}

      <label className="dmca-field">
        <span>Physical or electronic signature (type your full legal name)</span>
        <input
          value={signature}
          onChange={(event) => setSignature(event.target.value)}
          required
        />
      </label>

      {error ? <p className="report-error">{error}</p> : null}
      <button className="report-submit" type="submit" disabled={busy}>
        {busy ? 'Submitting...' : `Submit ${isCounter ? 'counter-notice' : 'takedown notice'}`}
      </button>
    </form>
  );
}

function Attestation({
  checked,
  onChange,
  text,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  text: string;
}) {
  return (
    <label className="dmca-check">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        required
      />
      <span>{text}</span>
    </label>
  );
}

const COUNTER_MISTAKE_TEXT = DMCA_COUNTER_MISTAKE_ATTESTATION_TEXT;

function mapCode(error: string | undefined): DmcaErrorCode {
  switch (error) {
    case 'validation':
    case 'rate-limited':
    case 'network':
    case 'not-configured':
    case 'temporarily-unavailable':
      return error;
    default:
      return 'unknown';
  }
}
