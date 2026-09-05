'use client';

import { useState, useEffect, type ReactNode, useCallback } from 'react';
import { isModuleLockedAction, verifyModuleLockPinAction } from '../app/actions';

interface ModuleLockGateProps {
  moduleId: string;
  moduleName: string;
  moduleIcon: string;
  accentColor: string;
  children: ReactNode;
}

export function ModuleLockGate({
  moduleId,
  moduleName,
  moduleIcon,
  accentColor,
  children,
}: ModuleLockGateProps) {
  const [state, setState] = useState<'loading' | 'locked' | 'unlocked'>('loading');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lockedOut, setLockedOut] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    isModuleLockedAction(moduleId).then((locked) => {
      setState(locked ? 'locked' : 'unlocked');
    });
  }, [moduleId]);

  // Countdown timer for lockout
  useEffect(() => {
    if (!lockedOut || remainingSeconds <= 0) return;
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setLockedOut(false);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockedOut, remainingSeconds]);

  const handleSubmit = useCallback(async () => {
    if (pin.length < 4) return;
    setError(null);
    const result = await verifyModuleLockPinAction(moduleId, pin);
    if (result.ok) {
      setState('unlocked');
      return;
    }
    if (result.locked) {
      setLockedOut(true);
      setRemainingSeconds(result.remainingSeconds ?? 60);
    }
    setError(result.error ?? 'Verification failed.');
    setPin('');
  }, [moduleId, pin]);

  if (state === 'loading') {
    return (
      <div style={styles.container}>
        <p style={styles.loadingText}>Loading...</p>
      </div>
    );
  }

  if (state === 'unlocked') {
    return <>{children}</>;
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={styles.container}>
      <div style={styles.lockCard}>
        <span style={styles.icon}>{moduleIcon}</span>
        <h2 style={styles.title}>{moduleName} is Locked</h2>

        {lockedOut ? (
          <div style={styles.lockoutBox}>
            <p style={styles.errorText}>Too many attempts</p>
            <p style={styles.countdown}>{formatTime(remainingSeconds)}</p>
            <p style={styles.subText}>Try again later</p>
          </div>
        ) : (
          <>
            <p style={styles.subText}>Enter your PIN to continue</p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSubmit();
              }}
              style={{ ...styles.pinInput, borderColor: error ? 'var(--danger, #FF453A)' : accentColor }}
              placeholder="PIN"
              autoFocus
            />
            {error && <p style={styles.errorText}>{error}</p>}
            <button
              onClick={() => void handleSubmit()}
              disabled={pin.length < 4}
              style={{ ...styles.button, backgroundColor: accentColor, opacity: pin.length < 4 ? 0.5 : 1 }}
            >
              Unlock
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
  } as React.CSSProperties,
  lockCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '16px',
    padding: '48px 32px',
    backgroundColor: 'var(--surface, #12121A)',
    borderRadius: '16px',
    border: '1px solid var(--border, rgba(255,255,255,0.06))',
    maxWidth: '360px',
    width: '100%',
  } as React.CSSProperties,
  icon: { fontSize: '64px' } as React.CSSProperties,
  title: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--text, #F0F0F5)',
    margin: 0,
  } as React.CSSProperties,
  subText: {
    fontSize: '14px',
    color: 'var(--text-secondary, rgba(240,240,245,0.65))',
    margin: 0,
  } as React.CSSProperties,
  pinInput: {
    width: '160px',
    padding: '12px 16px',
    fontSize: '24px',
    fontFamily: 'monospace',
    letterSpacing: '8px',
    textAlign: 'center' as const,
    backgroundColor: 'var(--surface-elevated, #1A1A24)',
    border: '2px solid var(--border, rgba(255,255,255,0.06))',
    borderRadius: '12px',
    color: 'var(--text, #F0F0F5)',
    outline: 'none',
  } as React.CSSProperties,
  button: {
    padding: '10px 32px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#0A0A0F',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  } as React.CSSProperties,
  errorText: {
    fontSize: '13px',
    color: 'var(--danger, #FF453A)',
    margin: 0,
  } as React.CSSProperties,
  lockoutBox: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties,
  countdown: {
    fontSize: '48px',
    fontWeight: 700,
    color: 'var(--danger, #FF453A)',
    margin: 0,
  } as React.CSSProperties,
  loadingText: {
    color: 'var(--text-secondary, rgba(240,240,245,0.65))',
  } as React.CSSProperties,
} as const;
