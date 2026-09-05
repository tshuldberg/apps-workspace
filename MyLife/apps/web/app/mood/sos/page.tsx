'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  addSosSession, endSosSession, fetchSosSessions,
  addEmergencyContact, fetchEmergencyContacts, removeEmergencyContact,
} from '../actions';
import { getSosFlow, getRandomAffirmation, GROUNDING_SENSES, type SosStep } from '@mylife/mood';

// SOS-specific red accent tokens
const SOS_RED = '#F87171';
const SOS_RED_EMPHASIS = '#EF4444';
const SOS_GLOW = 'rgba(248, 113, 113, 0.1)';
const SOS_GLOW_STRONG = 'rgba(248, 113, 113, 0.15)';

const ACCENT = 'var(--accent-mood)';
const SURFACE_ELEVATED = 'var(--surface-elevated, #2A292F)';
const BORDER = 'var(--border)';
const TEXT_SEC = 'var(--text-secondary)';
const GLASS = 'var(--glass)';

interface Contact { id: string; name: string; phone: string | null; relationship: string | null }
interface Session { id: string; triggerMoodScore: number | null; exitMoodScore: number | null; stepsCompleted: number; totalDurationSeconds: number; startedAt: string }

export default function SosPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [triggerScore, setTriggerScore] = useState(3);
  const [activeFlow, setActiveFlow] = useState<{ sessionId: string; steps: SosStep[]; currentStep: number; startTime: number } | null>(null);
  const [exitScore, setExitScore] = useState(5);
  const [showExitPrompt, setShowExitPrompt] = useState(false);

  const [showAddContact, setShowAddContact] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactRelationship, setContactRelationship] = useState('');

  // Breathing animation state
  const [breathPhase, setBreathPhase] = useState('INHALE');
  const [breathScale, setBreathScale] = useState(0.6);
  const breathTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Grounding state
  const [groundingIndex, setGroundingIndex] = useState(0);
  const [tappedItems, setTappedItems] = useState<number[]>([]);
  const [groundingCompleted, setGroundingCompleted] = useState(false);

  // Affirmation
  const [affirmation, setAffirmation] = useState(() => getRandomAffirmation());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, s] = await Promise.all([fetchEmergencyContacts(), fetchSosSessions(10)]);
      setContacts(c);
      setSessions(s);
    } catch {
      setError('Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Breathing animation cycle
  useEffect(() => {
    if (!activeFlow || activeFlow.steps[activeFlow.currentStep]?.type !== 'breathing') return;
    let cancelled = false;

    const runBreathing = () => {
      if (cancelled) return;
      setBreathPhase('INHALE');
      setBreathScale(1.0);
      breathTimerRef.current = setTimeout(() => {
        if (cancelled) return;
        setBreathPhase('HOLD');
        breathTimerRef.current = setTimeout(() => {
          if (cancelled) return;
          setBreathPhase('EXHALE');
          setBreathScale(0.6);
          breathTimerRef.current = setTimeout(() => {
            if (cancelled) return;
            setBreathPhase('HOLD');
            breathTimerRef.current = setTimeout(() => {
              if (cancelled) return;
              runBreathing();
            }, 4000);
          }, 4000);
        }, 4000);
      }, 4000);
    };

    runBreathing();
    return () => {
      cancelled = true;
      if (breathTimerRef.current) clearTimeout(breathTimerRef.current);
    };
  }, [activeFlow?.currentStep, activeFlow?.sessionId]);

  const startFlow = async () => {
    try {
      const steps = getSosFlow();
      const result = await addSosSession({ triggerMoodScore: triggerScore });
      setActiveFlow({ sessionId: result.id, steps, currentStep: 0, startTime: Date.now() });
    } catch {
      setError('Failed to start SOS flow');
    }
  };

  const nextStep = () => {
    if (!activeFlow) return;
    const next = activeFlow.currentStep + 1;
    if (next >= activeFlow.steps.length) {
      setShowExitPrompt(true);
    } else {
      setActiveFlow({ ...activeFlow, currentStep: next });
      // Reset grounding state for grounding step
      if (activeFlow.steps[next]?.type === 'grounding') {
        setGroundingIndex(0);
        setTappedItems([]);
        setGroundingCompleted(false);
      }
    }
  };

  const stopFlow = async () => {
    if (!activeFlow) return;
    const duration = Math.round((Date.now() - activeFlow.startTime) / 1000);
    try {
      await endSosSession(activeFlow.sessionId, {
        stepsCompleted: activeFlow.currentStep + 1,
        totalDurationSeconds: duration,
        exitMoodScore: null,
      });
    } catch { /* best effort */ }
    setActiveFlow(null);
    setShowExitPrompt(false);
    void load();
  };

  const completeFlow = async () => {
    if (!activeFlow) return;
    const duration = Math.round((Date.now() - activeFlow.startTime) / 1000);
    try {
      await endSosSession(activeFlow.sessionId, {
        stepsCompleted: activeFlow.steps.length,
        totalDurationSeconds: duration,
        exitMoodScore: exitScore,
        groundingCompleted,
      });
    } catch {
      setError('Failed to save session');
    }
    setActiveFlow(null);
    setShowExitPrompt(false);
    void load();
  };

  const handleGroundingTap = (index: number) => {
    setTappedItems((prev) => {
      if (prev.includes(index)) return prev;
      const next = [...prev, index];
      const sense = GROUNDING_SENSES[groundingIndex];
      if (sense && next.length >= sense.count) {
        if (groundingIndex < GROUNDING_SENSES.length - 1) {
          setGroundingIndex((gi) => gi + 1);
          return [];
        } else {
          setGroundingCompleted(true);
        }
      }
      return next;
    });
  };

  const handleAddContact = async () => {
    if (!contactName.trim()) return;
    try {
      await addEmergencyContact({
        name: contactName.trim(),
        phone: contactPhone.trim() || undefined,
        relationship: contactRelationship.trim() || undefined,
      });
      setShowAddContact(false);
      setContactName('');
      setContactPhone('');
      setContactRelationship('');
      void load();
    } catch {
      setError('Failed to add contact');
    }
  };

  const handleDeleteContact = async (id: string) => {
    try {
      await removeEmergencyContact(id);
      void load();
    } catch {
      setError('Failed to delete contact');
    }
  };

  if (loading) {
    return <div style={{ height: 400, borderRadius: 20, background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.5s ease-in-out infinite' }} />;
  }

  // ── Crisis Sidebar (always visible during flow) ───────────────────
  const CrisisSidebar = () => (
    <div style={{
      width: 280, padding: 24, borderRadius: 20, background: SURFACE_ELEVATED,
      border: `1px solid ${BORDER}`, display: 'grid', gap: 16, alignContent: 'start',
      position: 'sticky', top: 24, flexShrink: 0,
    }}>
      {/* Emergency Support Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>{'\u{1F6E1}\uFE0F'}</span>
        <span style={{ fontSize: 14, fontWeight: 700 }}>Emergency Support</span>
      </div>

      {/* 988 Lifeline */}
      <a
        href="tel:988"
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: 14, borderRadius: 12, background: SOS_GLOW, textDecoration: 'none', color: 'inherit',
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>988</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: TEXT_SEC }}>Suicide & Crisis Lifeline</p>
        </div>
        <span style={{ fontSize: 18, color: SOS_RED }}>{'\u{1F4DE}'}</span>
      </a>

      {/* Crisis Text Line */}
      <a
        href="sms:741741?body=HELLO"
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: 12, borderRadius: 12, background: GLASS, border: `1px solid ${BORDER}`,
          textDecoration: 'none', color: 'inherit',
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Crisis Text Line</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: TEXT_SEC }}>Text HOME to 741741</p>
        </div>
        <span style={{
          padding: '4px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.08)',
          fontSize: 12, fontWeight: 700, color: 'var(--text)',
        }}>Text</span>
      </a>

      {/* Trusted Contacts */}
      {contacts.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' as const, color: TEXT_SEC }}>
            TRUSTED CONTACTS
          </p>
          {contacts.slice(0, 3).map((c) => (
            <a
              key={c.id}
              href={c.phone ? `tel:${c.phone}` : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0',
                textDecoration: 'none', color: 'inherit', cursor: c.phone ? 'pointer' : 'default',
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 16, background: 'rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 600,
              }}>
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{c.name}</p>
                {c.relationship && (
                  <p style={{ margin: 0, fontSize: 11, color: TEXT_SEC }}>{c.relationship}</p>
                )}
              </div>
              {c.phone && <span style={{ fontSize: 14, color: SOS_RED }}>{'\u{1F4DE}'}</span>}
            </a>
          ))}
        </div>
      )}

      {/* Daily Affirmation */}
      <div style={{
        padding: 16, borderRadius: 14, background: GLASS, border: `1px solid ${BORDER}`,
      }}>
        <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' as const, color: TEXT_SEC }}>
          DAILY AFFIRMATION
        </p>
        <p style={{ margin: 0, fontSize: 14, fontStyle: 'italic', lineHeight: 1.5, color: 'var(--text)' }}>
          &ldquo;{affirmation}&rdquo;
        </p>
      </div>
    </div>
  );

  // ── Active Flow: Exit Prompt ──────────────────────────────────────
  if (showExitPrompt) {
    return (
      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 32px', gap: 20 }}>
          <span style={{ fontSize: 48 }}>{'\u{1F31F}'}</span>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>How are you feeling now?</h2>
          <input
            type="range" min={1} max={10} value={exitScore}
            onChange={(e) => setExitScore(Number(e.target.value))}
            style={{ width: '60%', maxWidth: 300, accentColor: SOS_RED }}
          />
          <p style={{ margin: 0, fontSize: 32, fontWeight: 800, color: SOS_RED }}>{exitScore} / 10</p>
          <button
            onClick={() => void completeFlow()}
            style={{
              padding: '14px 40px', borderRadius: 999, border: 'none',
              background: SOS_RED_EMPHASIS, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
        <CrisisSidebar />
      </div>
    );
  }

  // ── Active Flow Steps ─────────────────────────────────────────────
  if (activeFlow) {
    const step = activeFlow.steps[activeFlow.currentStep];
    const currentSense = GROUNDING_SENSES[groundingIndex];

    return (
      <div style={{ display: 'flex', gap: 24 }}>
        {/* Main Content */}
        <div style={{ flex: 1, display: 'grid', gap: 24 }}>
          {/* Step Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {activeFlow.steps.map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: i === activeFlow.currentStep ? 12 : 10,
                  height: i === activeFlow.currentStep ? 12 : 10,
                  borderRadius: '50%',
                  background: i <= activeFlow.currentStep ? SOS_RED : 'rgba(255,255,255,0.1)',
                  border: i === activeFlow.currentStep ? `2px solid ${SOS_RED_EMPHASIS}` : 'none',
                }} />
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' as const,
                  color: i === activeFlow.currentStep ? SOS_RED : 'rgba(255,255,255,0.3)',
                }}>
                  {i === activeFlow.currentStep ? 'ACTIVE' : `STEP ${i + 1}`}
                </span>
                {i < activeFlow.steps.length - 1 && (
                  <div style={{
                    width: 24, height: 1,
                    background: i < activeFlow.currentStep ? SOS_RED : 'rgba(255,255,255,0.1)',
                  }} />
                )}
              </div>
            ))}
          </div>

          {/* Step Content */}
          {step?.type === 'breathing' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '20px 0' }}>
              <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, textAlign: 'center' }}>Focus on your breath</h2>
              <p style={{ margin: 0, fontSize: 14, color: TEXT_SEC, textAlign: 'center', maxWidth: 420 }}>
                Follow the circle to regulate your heart rate. Inhale as it grows, exhale as it shrinks.
              </p>

              {/* Large Breathing Circle */}
              <div style={{
                width: 240, height: 240, borderRadius: '50%', background: SOS_RED,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 0 60px ${SOS_GLOW_STRONG}`,
                transform: `scale(${breathScale})`,
                transition: 'transform 4s ease-in-out',
                margin: '20px 0',
              }}>
                <div style={{
                  width: 210, height: 210, borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: 2 }}>
                    {breathPhase}
                  </span>
                </div>
              </div>
            </div>
          )}

          {step?.type === 'grounding' && (
            <div style={{ display: 'grid', gap: 20, padding: '0 20px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>5-4-3-2-1 Grounding</h2>
                <p style={{ margin: '8px 0 0', fontSize: 14, color: TEXT_SEC, lineHeight: 1.5 }}>
                  Focus on your surroundings to quiet your mind and steady your pulse. You are safe.
                </p>
              </div>

              {!groundingCompleted && currentSense && (
                <div style={{
                  padding: 28, borderRadius: 20, background: SURFACE_ELEVATED,
                  border: `1px solid ${BORDER}`, textAlign: 'center', display: 'grid', gap: 14,
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 24, background: SOS_GLOW_STRONG,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
                  }}>
                    <span style={{ fontSize: 24, fontWeight: 700, color: SOS_RED }}>{currentSense.count}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                    Things you {currentSense.sense}
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC }}>
                    {currentSense.prompt}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
                    {Array.from({ length: currentSense.count }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => handleGroundingTap(i)}
                        style={{
                          padding: '8px 18px', borderRadius: 20, border: 'none',
                          background: tappedItems.includes(i) ? SOS_RED : 'rgba(255,255,255,0.08)',
                          color: tappedItems.includes(i) ? '#fff' : TEXT_SEC,
                          fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms',
                        }}
                      >
                        Item {i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Senses overview */}
              <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                {GROUNDING_SENSES.map((sense, i) => {
                  if (i === groundingIndex && !groundingCompleted) return null;
                  const isCompleted = i < groundingIndex || groundingCompleted;
                  const senseIcons: Record<string, string> = { see: '\u{1F441}', touch: '\u{270B}', hear: '\u{1F442}', smell: '\u{1F443}', taste: '\u{1F445}' };
                  return (
                    <div key={sense.sense} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <span style={{ fontSize: 18, fontWeight: 700, color: TEXT_SEC }}>{sense.count}</span>
                      <span style={{ fontSize: 16 }}>{senseIcons[sense.sense] ?? ''}</span>
                      <span style={{
                        fontSize: 8, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' as const,
                        color: isCompleted ? SOS_RED : 'rgba(255,255,255,0.3)',
                      }}>
                        {sense.sense}
                      </span>
                    </div>
                  );
                })}
              </div>

              {groundingCompleted && (
                <div style={{
                  padding: 20, borderRadius: 14, background: GLASS, border: `1px solid ${BORDER}`,
                  textAlign: 'center',
                }}>
                  <p style={{ margin: 0, fontSize: 16, color: 'var(--success)', fontWeight: 600 }}>
                    Great job grounding yourself. You are present and safe.
                  </p>
                </div>
              )}
            </div>
          )}

          {step?.type === 'affirmation' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '32px 0' }}>
              <span style={{ fontSize: 28, color: SOS_RED }}>{'\u{2764}'}</span>
              <p style={{
                margin: 0, fontSize: 22, fontWeight: 600, fontStyle: 'italic', textAlign: 'center',
                maxWidth: 500, lineHeight: 1.5,
              }}>
                &ldquo;{affirmation}&rdquo;
              </p>
              <button
                onClick={() => setAffirmation(getRandomAffirmation())}
                style={{
                  padding: '8px 24px', borderRadius: 20, border: 'none',
                  background: SOS_GLOW, color: SOS_RED, fontSize: 11, fontWeight: 700,
                  letterSpacing: 1, cursor: 'pointer',
                }}
              >
                ANOTHER
              </button>

              {/* Quick Recovery Resources */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, width: '100%', maxWidth: 500, marginTop: 12 }}>
                <Link href="/mood/focus" style={{
                  padding: 18, borderRadius: 16, background: SURFACE_ELEVATED, border: `1px solid ${BORDER}`,
                  textDecoration: 'none', color: 'inherit', display: 'grid', gap: 6,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Panic Relief Soundscape</span>
                  <span style={{ fontSize: 12, color: TEXT_SEC, lineHeight: 1.4 }}>
                    Put on noise and bilateral stimulation to calm the nervous system
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: ACCENT }}>PLAY NOW &gt;</span>
                </Link>
                <Link href="/mood/experiments" style={{
                  padding: 18, borderRadius: 16, background: SURFACE_ELEVATED, border: `1px solid ${BORDER}`,
                  textDecoration: 'none', color: 'inherit', display: 'grid', gap: 6,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Quick Experiments</span>
                  <span style={{ fontSize: 12, color: TEXT_SEC, lineHeight: 1.4 }}>
                    Try the &quot;Container Pause&quot; or &quot;StrengthsBalance&quot; techniques.
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: ACCENT }}>VIEW GUIDE &gt;</span>
                </Link>
              </div>
            </div>
          )}

          {step?.type === 'exit' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '32px 0' }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>How are you feeling now?</h2>
              <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC }}>
                Rate your current state from 1 (struggling) to 10 (at ease)
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => (
                  <button
                    key={val}
                    onClick={() => setExitScore(val)}
                    style={{
                      width: 36, height: 36, borderRadius: 18, border: 'none',
                      background: val === exitScore ? SOS_RED : 'rgba(255,255,255,0.08)',
                      color: val === exitScore ? '#fff' : TEXT_SEC,
                      fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 150ms',
                    }}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Nav Buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={() => void stopFlow()}
              style={{
                padding: '12px 28px', borderRadius: 12,
                border: `1px solid ${BORDER}`, background: 'transparent',
                color: TEXT_SEC, fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}
            >
              Stop Flow
            </button>
            <button
              onClick={nextStep}
              style={{
                padding: '12px 32px', borderRadius: 12, border: 'none',
                background: SOS_RED_EMPHASIS, color: '#fff', fontWeight: 700,
                fontSize: 14, cursor: 'pointer',
              }}
            >
              {activeFlow.currentStep + 1 >= activeFlow.steps.length ? 'Finish' : 'Continue to Next Step'}
            </button>
          </div>

          {/* Disclaimer */}
          <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', maxWidth: 500, marginInline: 'auto' }}>
            This is a wellness tool, not medical advice. In an emergency, call 911.
          </p>
        </div>

        {/* Always-visible Crisis Sidebar */}
        <CrisisSidebar />
      </div>
    );
  }

  // ── Default: Start Screen ─────────────────────────────────────────
  return (
    <div style={{ display: 'flex', gap: 24 }}>
      {/* Main Content */}
      <div style={{ flex: 1, display: 'grid', gap: 24 }}>
        {/* Start SOS Flow Card */}
        <div style={{
          padding: 40, borderRadius: 24, background: SURFACE_ELEVATED,
          border: `1px solid ${BORDER}`, textAlign: 'center',
        }}>
          {/* Step indicator placeholder */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
            <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.5 }}>Dashboard</span>
            <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.5 }}>Breathing</span>
            <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.5 }}>History</span>
            <span style={{
              fontSize: 13, fontWeight: 700, color: SOS_RED,
              borderBottom: `2px solid ${SOS_RED}`, paddingBottom: 4,
            }}>SOS</span>
          </div>

          <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>{'\u{1F499}'}</span>
          <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700 }}>You&apos;re not alone</h2>
          <p style={{ margin: '0 0 24px', color: TEXT_SEC, fontSize: 14, maxWidth: 420, marginInline: 'auto' }}>
            Let&apos;s work through this together. How are you feeling right now?
          </p>
          <input
            type="range" min={1} max={10} value={triggerScore}
            onChange={(e) => setTriggerScore(Number(e.target.value))}
            style={{ width: '60%', maxWidth: 300, accentColor: SOS_RED }}
          />
          <p style={{ margin: '12px 0 24px', fontSize: 28, fontWeight: 800, color: SOS_RED }}>{triggerScore} / 10</p>
          <button
            onClick={() => void startFlow()}
            style={{
              padding: '14px 40px', borderRadius: 999, border: 'none',
              background: SOS_RED_EMPHASIS, color: '#fff', fontWeight: 700,
              fontSize: 15, cursor: 'pointer',
            }}
          >
            Start SOS Flow
          </button>
        </div>

        {error && (
          <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,69,58,0.15)', color: 'var(--danger)', fontSize: 14 }}>{error}</div>
        )}

        {/* Emergency Contacts Management */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' as const, color: TEXT_SEC }}>
              EMERGENCY CONTACTS
            </p>
            <button
              onClick={() => setShowAddContact(true)}
              style={{
                padding: '6px 14px', borderRadius: 8, border: `1px solid ${BORDER}`,
                background: 'transparent', color: TEXT_SEC, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              + Add
            </button>
          </div>

          {showAddContact && (
            <div style={{
              padding: 20, borderRadius: 16, border: `1px solid ${BORDER}`,
              background: SURFACE_ELEVATED, marginBottom: 12, display: 'grid', gap: 10,
            }}>
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Name"
                style={{ padding: 10, borderRadius: 10, border: `1px solid ${BORDER}`, background: 'var(--background)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Phone number"
                style={{ padding: 10, borderRadius: 10, border: `1px solid ${BORDER}`, background: 'var(--background)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
              <input value={contactRelationship} onChange={(e) => setContactRelationship(e.target.value)} placeholder="Relationship (e.g. Therapist)"
                style={{ padding: 10, borderRadius: 10, border: `1px solid ${BORDER}`, background: 'var(--background)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowAddContact(false)} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${BORDER}`, background: 'transparent', color: TEXT_SEC, cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => void handleAddContact()} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: ACCENT, color: '#0A0A0F', fontWeight: 600, cursor: 'pointer' }}>Save</button>
              </div>
            </div>
          )}

          {contacts.length === 0 ? (
            <p style={{ color: TEXT_SEC, fontSize: 14 }}>No emergency contacts added yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {contacts.map((c) => (
                <div key={c.id} style={{
                  padding: 14, borderRadius: 14, border: `1px solid ${BORDER}`, background: GLASS,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 18, background: 'rgba(255,255,255,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 15, fontWeight: 600,
                    }}>
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{c.name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: TEXT_SEC }}>
                        {[c.phone, c.relationship].filter(Boolean).join(' \u00B7 ') || 'No details'}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {c.phone && (
                      <a href={`tel:${c.phone}`} style={{ fontSize: 16, color: SOS_RED, textDecoration: 'none' }}>{'\u{1F4DE}'}</a>
                    )}
                    <button onClick={() => void handleDeleteContact(c.id)} style={{
                      background: 'none', border: 'none', color: TEXT_SEC, cursor: 'pointer', fontSize: 14,
                    }}>{'\u{1F5D1}'}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Past Sessions */}
        {sessions.length > 0 && (
          <div>
            <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' as const, color: TEXT_SEC }}>
              PAST SOS SESSIONS
            </p>
            <div style={{ display: 'grid', gap: 8 }}>
              {sessions.map((s) => (
                <div key={s.id} style={{
                  padding: 14, borderRadius: 14, border: `1px solid ${BORDER}`, background: GLASS,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 14 }}>{s.startedAt.slice(0, 10)}</span>
                  <span style={{ fontSize: 13, color: TEXT_SEC }}>
                    {s.triggerMoodScore ?? '?'} {'\u2192'} {s.exitMoodScore ?? '?'} | {s.stepsCompleted} steps | {Math.floor(s.totalDurationSeconds / 60)}m
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Crisis Sidebar (always visible) */}
      <CrisisSidebar />
    </div>
  );
}
