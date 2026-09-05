import { useState, useCallback, useRef, type ReactNode } from 'react';
import { getModuleLock, isTimeoutElapsed } from '@mylife/auth';
import { useDatabase } from './DatabaseProvider';
import { ModuleLockScreen } from './ModuleLockScreen';

interface ModuleLockGuardProps {
  moduleId: string;
  moduleName: string;
  moduleIcon: string;
  accentColor: string;
  children: ReactNode;
}

/**
 * Wraps a module layout to gate access behind PIN/biometric auth.
 * If the module has no lock configured, renders children immediately.
 * If locked and auth timeout has elapsed, shows the lock screen.
 */
export function ModuleLockGuard({
  moduleId,
  moduleName,
  moduleIcon,
  accentColor,
  children,
}: ModuleLockGuardProps) {
  const db = useDatabase();
  const lastAuthRef = useRef<number | null>(null);
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    const lock = getModuleLock(db, moduleId);
    if (!lock) return true;
    return !isTimeoutElapsed(lastAuthRef.current, lock.lockTimeoutSeconds);
  });

  const handleUnlock = useCallback(() => {
    lastAuthRef.current = Date.now();
    setUnlocked(true);
  }, []);

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <ModuleLockScreen
      moduleId={moduleId}
      moduleName={moduleName}
      moduleIcon={moduleIcon}
      accentColor={accentColor}
      db={db}
      onUnlock={handleUnlock}
    />
  );
}
