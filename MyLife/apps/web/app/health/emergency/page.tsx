'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchEmergencyInfo, doUpdateEmergencyInfo } from '../actions';
import type { BloodType } from '@mylife/health';

const BLOOD_TYPES: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const T = {
  bg: '#131318',
  depth: '#0E0E13',
  low: '#1B1B20',
  mid: '#1F1F25',
  high: '#2A292F',
  highest: '#35343A',
  text: '#E4E1E9',
  textSecondary: '#D6C3B5',
  textDim: 'rgba(228,225,233,0.5)',
  textFaint: 'rgba(228,225,233,0.35)',
  border: 'rgba(255,255,255,0.06)',
  accent: '#EF4444',
  accentLight: '#F87171',
  accentDim: 'rgba(239,68,68,0.15)',
  danger: '#FFB4AB',
  errorContainer: '#93000A',
} as const;

const font = "'Plus Jakarta Sans', -apple-system, system-ui, sans-serif";

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: T.bg,
    color: T.text,
    fontFamily: font,
    padding: '40px 32px 120px',
  },
  container: { maxWidth: 860, margin: '0 auto' },
  backLink: {
    color: T.textDim,
    textDecoration: 'none',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    display: 'inline-block',
    marginBottom: 24,
  },
  titleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 40,
  },
  title: {
    fontSize: 40,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: T.text,
    margin: 0,
  },
  subtitle: {
    fontSize: 14,
    color: T.textSecondary,
    marginTop: 8,
  },
  actionBar: { display: 'flex', gap: 12 },
  btnOutline: {
    background: 'transparent',
    border: `1px solid ${T.border}`,
    color: T.text,
    borderRadius: 9999,
    padding: '10px 20px',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    cursor: 'pointer',
  },

  /* ICE Card (printable) */
  iceCard: {
    background: T.low,
    borderRadius: 24,
    padding: 40,
    border: `2px solid ${T.accent}`,
    marginBottom: 32,
    position: 'relative',
    overflow: 'hidden',
  },
  iceRibbon: {
    position: 'absolute',
    top: 24,
    right: -40,
    background: T.accent,
    color: '#fff',
    padding: '4px 60px',
    fontSize: 10,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.3em',
    transform: 'rotate(45deg)',
  },
  iceLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.25em',
    color: T.accent,
    marginBottom: 8,
  },
  iceName: {
    fontSize: 40,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    color: T.text,
    marginBottom: 8,
  },
  iceMeta: {
    fontSize: 14,
    color: T.textSecondary,
    marginBottom: 32,
  },
  iceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 24,
    marginBottom: 32,
  },
  iceField: {},
  iceFieldLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    color: T.textDim,
    marginBottom: 8,
  },
  iceFieldValue: {
    fontSize: 16,
    color: T.text,
    fontWeight: 600,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
  iceBloodBadge: {
    display: 'inline-block',
    padding: '8px 20px',
    borderRadius: 9999,
    background: T.accent,
    color: '#fff',
    fontSize: 24,
    fontWeight: 800,
  },

  qrBox: {
    width: 160,
    height: 160,
    background: T.high,
    border: `1px solid ${T.border}`,
    borderRadius: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto',
  },
  qrGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(8, 1fr)',
    gap: 2,
    width: 120,
    height: 120,
  },
  qrPixel: { background: T.text, borderRadius: 1 },
  qrPixelOff: { background: 'transparent' },

  /* Edit form */
  formCard: {
    background: T.low,
    borderRadius: 16,
    padding: 32,
    border: `1px solid ${T.border}`,
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    color: T.accent,
    marginBottom: 20,
  },
  fieldGroup: { marginBottom: 20 },
  label: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    color: T.textDim,
    marginBottom: 8,
    display: 'block',
  },
  input: {
    width: '100%',
    background: T.depth,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: '12px 14px',
    fontSize: 13,
    color: T.text,
    fontFamily: font,
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    background: T.depth,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: '12px 14px',
    fontSize: 13,
    color: T.text,
    fontFamily: font,
    resize: 'vertical',
    minHeight: 72,
    boxSizing: 'border-box',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
  },
  chipRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  chip: {
    padding: '8px 16px',
    borderRadius: 9999,
    border: `1px solid ${T.border}`,
    background: T.depth,
    fontSize: 13,
    fontWeight: 600,
    color: T.textSecondary,
    cursor: 'pointer',
  },
  chipActive: {
    background: T.accent,
    borderColor: T.accent,
    color: '#fff',
  },
  saveBtn: {
    padding: '12px 32px',
    borderRadius: 9999,
    background: T.accent,
    color: '#fff',
    border: 'none',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    cursor: 'pointer',
    marginTop: 8,
  },
  success: {
    color: T.accent,
    fontSize: 12,
    marginLeft: 16,
    fontWeight: 600,
  },
  empty: {
    padding: 48,
    textAlign: 'center',
    color: T.textFaint,
    fontSize: 13,
  },
};

function parseContacts(raw: string): { name: string; phone: string }[] {
  return raw
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, phone] = line.split(':').map((p) => p.trim());
      return { name: name ?? line, phone: phone ?? '' };
    });
}

export default function EmergencyPage() {
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [bloodType, setBloodType] = useState<BloodType | ''>('');
  const [allergies, setAllergies] = useState('');
  const [conditions, setConditions] = useState('');
  const [contacts, setContacts] = useState('');
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [insurancePolicy, setInsurancePolicy] = useState('');
  const [physician, setPhysician] = useState('');
  const [physicianPhone, setPhysicianPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const info = await fetchEmergencyInfo();
      if (info) {
        setFullName(info.full_name ?? '');
        setDob(info.date_of_birth ?? '');
        setBloodType((info.blood_type as BloodType) ?? '');
        setAllergies(info.allergies ?? '');
        setConditions(info.conditions ?? '');
        setContacts(info.emergency_contacts ?? '');
        setInsuranceProvider(info.insurance_provider ?? '');
        setInsurancePolicy(info.insurance_policy_number ?? '');
        setPhysician(info.primary_physician ?? '');
        setPhysicianPhone(info.physician_phone ?? '');
        setNotes(info.notes ?? '');
      }
    } catch (err) {
      console.error('Failed to load emergency info:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    try {
      await doUpdateEmergencyInfo({
        full_name: fullName.trim() || undefined,
        date_of_birth: dob.trim() || undefined,
        blood_type: bloodType || undefined,
        allergies: allergies.trim() || undefined,
        conditions: conditions.trim() || undefined,
        emergency_contacts: contacts.trim() || undefined,
        insurance_provider: insuranceProvider.trim() || undefined,
        insurance_policy_number: insurancePolicy.trim() || undefined,
        primary_physician: physician.trim() || undefined,
        physician_phone: physicianPhone.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save emergency info:', err);
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') window.print();
  };

  if (loading) {
    return (
      <div style={s.page}>
        <div style={s.container}>
          <div style={s.empty}>Loading emergency info...</div>
        </div>
      </div>
    );
  }

  const parsedContacts = parseContacts(contacts);

  // Simple QR placeholder pattern
  const qrPattern = Array.from({ length: 64 }, (_, i) => {
    const row = Math.floor(i / 8);
    const col = i % 8;
    const corner =
      (row < 3 && col < 3) || (row < 3 && col > 4) || (row > 4 && col < 3);
    return corner ? (row === 0 || row === 2 || col === 0 || col === 2) : (i * 7) % 3 === 0;
  });

  return (
    <div style={s.page}>
      <div style={s.container}>
        <Link href="/health" style={s.backLink}>
          ← MyHealth / Emergency
        </Link>

        <div style={s.titleRow}>
          <div>
            <h1 style={s.title}>Emergency Info</h1>
            <p style={s.subtitle}>Critical health information for first responders</p>
          </div>
          <div style={s.actionBar}>
            <button type="button" style={s.btnOutline} onClick={handlePrint}>
              Print Medical ID
            </button>
          </div>
        </div>

        {/* ICE Card Display */}
        <div style={s.iceCard}>
          <div style={s.iceRibbon}>ICE</div>
          <div style={s.iceLabel}>In Case of Emergency</div>
          <div style={s.iceName}>{fullName || 'Name not set'}</div>
          {dob && (
            <div style={s.iceMeta}>
              DOB: {new Date(dob).toLocaleDateString(undefined, { dateStyle: 'long' })}
            </div>
          )}

          <div style={s.iceGrid}>
            <div style={s.iceField}>
              <div style={s.iceFieldLabel}>Blood Type</div>
              <div>
                {bloodType ? (
                  <span style={s.iceBloodBadge}>{bloodType}</span>
                ) : (
                  <span style={{ ...s.iceFieldValue, color: T.textDim }}>Not set</span>
                )}
              </div>
            </div>
            <div style={s.iceField}>
              <div style={s.iceFieldLabel}>Allergies</div>
              <div style={s.iceFieldValue}>{allergies || '—'}</div>
            </div>
            <div style={s.iceField}>
              <div style={s.iceFieldLabel}>Conditions</div>
              <div style={s.iceFieldValue}>{conditions || '—'}</div>
            </div>
            <div style={s.iceField}>
              <div style={s.iceFieldLabel}>Insurance</div>
              <div style={s.iceFieldValue}>
                {insuranceProvider || '—'}
                {insurancePolicy && (
                  <>
                    <br />
                    <span style={{ fontSize: 12, color: T.textDim }}>#{insurancePolicy}</span>
                  </>
                )}
              </div>
            </div>
            <div style={s.iceField}>
              <div style={s.iceFieldLabel}>Primary Physician</div>
              <div style={s.iceFieldValue}>
                {physician || '—'}
                {physicianPhone && (
                  <>
                    <br />
                    <a
                      href={`tel:${physicianPhone.replace(/\s/g, '')}`}
                      style={{ color: T.accent, textDecoration: 'none', fontSize: 13 }}
                    >
                      {physicianPhone}
                    </a>
                  </>
                )}
              </div>
            </div>
            <div style={s.iceField}>
              <div style={s.iceFieldLabel}>Emergency Contacts</div>
              <div style={s.iceFieldValue}>
                {parsedContacts.length === 0
                  ? '—'
                  : parsedContacts.map((c, i) => (
                      <div key={i}>
                        <span>{c.name}</span>
                        {c.phone && (
                          <>
                            {' · '}
                            <a
                              href={`tel:${c.phone.replace(/\s/g, '')}`}
                              style={{ color: T.accent, textDecoration: 'none' }}
                            >
                              {c.phone}
                            </a>
                          </>
                        )}
                      </div>
                    ))}
              </div>
            </div>
          </div>

          {notes && (
            <div style={s.iceField}>
              <div style={s.iceFieldLabel}>Notes</div>
              <div style={s.iceFieldValue}>{notes}</div>
            </div>
          )}

          {/* QR Code placeholder */}
          <div style={{ ...s.qrBox, marginTop: 32 }}>
            <div style={s.qrGrid}>
              {qrPattern.map((on, i) => (
                <div key={i} style={on ? s.qrPixel : s.qrPixelOff} />
              ))}
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div style={s.formCard}>
          <div style={s.sectionLabel}>Edit Information</div>

          <div style={s.row}>
            <div style={s.fieldGroup}>
              <label style={s.label}>Full Name</label>
              <input
                style={s.input}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Date of Birth</label>
              <input
                style={s.input}
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
            </div>
          </div>

          <div style={s.fieldGroup}>
            <label style={s.label}>Blood Type</label>
            <div style={s.chipRow}>
              {BLOOD_TYPES.map((bt) => (
                <button
                  key={bt}
                  type="button"
                  style={{
                    ...s.chip,
                    ...(bloodType === bt ? s.chipActive : {}),
                  }}
                  onClick={() => setBloodType(bt)}
                >
                  {bt}
                </button>
              ))}
            </div>
          </div>

          <div style={s.fieldGroup}>
            <label style={s.label}>Allergies</label>
            <textarea
              style={s.textarea}
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder="Drug and food allergies..."
            />
          </div>

          <div style={s.fieldGroup}>
            <label style={s.label}>Medical Conditions</label>
            <textarea
              style={s.textarea}
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              placeholder="Chronic conditions, diagnoses..."
            />
          </div>

          <div style={s.fieldGroup}>
            <label style={s.label}>Emergency Contacts</label>
            <textarea
              style={s.textarea}
              value={contacts}
              onChange={(e) => setContacts(e.target.value)}
              placeholder="Name: Phone (one per line)"
            />
          </div>

          <div style={s.row}>
            <div style={s.fieldGroup}>
              <label style={s.label}>Insurance Provider</label>
              <input
                style={s.input}
                value={insuranceProvider}
                onChange={(e) => setInsuranceProvider(e.target.value)}
              />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Policy Number</label>
              <input
                style={s.input}
                value={insurancePolicy}
                onChange={(e) => setInsurancePolicy(e.target.value)}
              />
            </div>
          </div>

          <div style={s.row}>
            <div style={s.fieldGroup}>
              <label style={s.label}>Primary Physician</label>
              <input
                style={s.input}
                value={physician}
                onChange={(e) => setPhysician(e.target.value)}
              />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Physician Phone</label>
              <input
                style={s.input}
                value={physicianPhone}
                onChange={(e) => setPhysicianPhone(e.target.value)}
              />
            </div>
          </div>

          <div style={s.fieldGroup}>
            <label style={s.label}>Additional Notes</label>
            <textarea
              style={s.textarea}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any other critical info..."
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button type="button" style={s.saveBtn} onClick={handleSave}>
              Save Info
            </button>
            {saved && <span style={s.success}>✓ Saved</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
