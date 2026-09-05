import { useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  Switch,
  TextInput,
} from 'react-native';
import { Card, Text, Button, colors, spacing, borderRadius } from '@mylife/ui';
import {
  LOCKABLE_MODULE_IDS,
  getAllModuleLocks,
  enableModuleLock,
  disableModuleLock,
  verifyPin,
  getModuleLock,
} from '@mylife/auth';
import type { ModuleLockRow } from '@mylife/auth';
import {
  MODULE_METADATA,
  isUserVisibleModule,
  type ModuleId,
} from '@mylife/module-registry';
import { useDatabase } from '../../components/DatabaseProvider';

type SetupState =
  | { step: 'idle' }
  | { step: 'enter'; moduleId: string }
  | { step: 'confirm'; moduleId: string; pin: string }
  | { step: 'verify-disable'; moduleId: string };

export default function ModuleLocksScreen() {
  const db = useDatabase();
  const [locks, setLocks] = useState<ModuleLockRow[]>([]);
  const [setup, setSetup] = useState<SetupState>({ step: 'idle' });
  const [pinInput, setPinInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refreshLocks = useCallback(() => {
    setLocks(getAllModuleLocks(db));
  }, [db]);

  useEffect(() => {
    refreshLocks();
  }, [refreshLocks]);

  const isLocked = (moduleId: string) => locks.some((l) => l.moduleId === moduleId);

  const handleToggle = (moduleId: string, enable: boolean) => {
    if (enable) {
      setSetup({ step: 'enter', moduleId });
      setPinInput('');
      setError(null);
    } else {
      setSetup({ step: 'verify-disable', moduleId });
      setPinInput('');
      setError(null);
    }
  };

  const handlePinSubmit = async () => {
    if (pinInput.length < 4 || pinInput.length > 6) {
      setError('PIN must be 4-6 digits.');
      return;
    }

    if (setup.step === 'enter') {
      setSetup({ step: 'confirm', moduleId: setup.moduleId, pin: pinInput });
      setPinInput('');
      setError(null);
    } else if (setup.step === 'confirm') {
      if (pinInput !== setup.pin) {
        setError('PINs do not match. Try again.');
        setPinInput('');
        return;
      }
      await enableModuleLock(db, setup.moduleId, pinInput);
      refreshLocks();
      setSetup({ step: 'idle' });
      setPinInput('');
      setError(null);
    } else if (setup.step === 'verify-disable') {
      const lock = getModuleLock(db, setup.moduleId);
      if (!lock) return;
      const valid = await verifyPin(pinInput, lock.salt, lock.pinHash);
      if (!valid) {
        setError('Incorrect PIN.');
        setPinInput('');
        return;
      }
      disableModuleLock(db, setup.moduleId);
      refreshLocks();
      setSetup({ step: 'idle' });
      setPinInput('');
      setError(null);
    }
  };

  const handleCancel = () => {
    setSetup({ step: 'idle' });
    setPinInput('');
    setError(null);
  };

  const getSetupLabel = (): string => {
    if (setup.step === 'enter') return 'Enter a PIN';
    if (setup.step === 'confirm') return 'Confirm your PIN';
    if (setup.step === 'verify-disable') return 'Enter PIN to remove lock';
    return '';
  };

  const activeModuleId = setup.step !== 'idle' ? setup.moduleId : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <Text variant="caption" color={colors.textSecondary}>
          Protect sensitive modules with a PIN lock. When enabled, you must enter your PIN
          before viewing the module's content.
        </Text>
      </Card>

      {LOCKABLE_MODULE_IDS
        .filter((moduleId) => isUserVisibleModule(moduleId as ModuleId))
        .map((moduleId) => {
        const meta = MODULE_METADATA[moduleId];
        const locked = isLocked(moduleId);
        const isActive = activeModuleId === moduleId;

        return (
          <Card key={moduleId} style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={styles.moduleInfo}>
                <Text style={styles.icon}>{meta.icon}</Text>
                <Text variant="body" color={colors.text}>{meta.name}</Text>
              </View>
              <Switch
                value={locked}
                onValueChange={(val) => handleToggle(moduleId, val)}
                trackColor={{ false: colors.glassBorder, true: colors.modules[moduleId] }}
                thumbColor={colors.text}
                disabled={setup.step !== 'idle' && !isActive}
              />
            </View>

            {isActive && (
              <View style={styles.pinSetup}>
                <Text variant="label" color={colors.textSecondary}>
                  {getSetupLabel()}
                </Text>
                <TextInput
                  style={styles.pinInput}
                  value={pinInput}
                  onChangeText={(t) => setPinInput(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  maxLength={6}
                  secureTextEntry
                  placeholder="4-6 digit PIN"
                  placeholderTextColor={colors.textTertiary}
                  autoFocus
                />
                {error && (
                  <Text variant="caption" color={colors.danger}>{error}</Text>
                )}
                <View style={styles.pinActions}>
                  <Button variant="ghost" label="Cancel" onPress={handleCancel} />
                  <Button
                    variant="primary"
                    label={setup.step === 'verify-disable' ? 'Remove Lock' : 'Continue'}
                    onPress={() => void handlePinSubmit()}
                    disabled={pinInput.length < 4}
                  />
                </View>
              </View>
            )}
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl },
  card: { gap: spacing.sm },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  moduleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  icon: { fontSize: 24 },
  pinSetup: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pinInput: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 18,
    fontFamily: 'Inter',
    letterSpacing: 8,
    textAlign: 'center',
  },
  pinActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
});
