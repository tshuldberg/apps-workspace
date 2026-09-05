import React, { useCallback } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Text, colors, navigation, surfaceTiers } from '@mylife/ui';
import type { ModuleId } from '@mylife/module-registry';

type EnabledModule = { id: string; name: string; icon: string };

let registryLoadError: Error | null = null;
let useEnabledModules: () => EnabledModule[];
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const hooks = require('@mylife/module-registry/hooks');
  useEnabledModules = hooks.useEnabledModules;
} catch (err) {
  registryLoadError = err instanceof Error ? err : new Error(String(err));
  useEnabledModules = () => [];
}

type ModulesResult =
  | { ok: true; modules: EnabledModule[] }
  | { ok: false; error: Error };

/**
 * Invokes the registry hook unconditionally so hook call-order stays stable.
 * If the registry module itself failed to load (caught at require-time above),
 * surfaces that error via the result. Runtime errors thrown by the hook are
 * expected to propagate to an ErrorBoundary rather than be swallowed here,
 * since swallowing them would require wrapping the hook call in try/catch
 * which violates rules-of-hooks. A retryKey forces re-evaluation when the
 * user taps Retry.
 */
function useSafeEnabledModules(retryKey: number): ModulesResult {
  // retryKey bumps re-run the registry read when the user taps Retry.
  void retryKey;
  const modules = useEnabledModules();
  if (registryLoadError) {
    return { ok: false, error: registryLoadError };
  }
  return { ok: true, modules };
}

export interface HamburgerMenuProps {
  visible: boolean;
  onClose: () => void;
  /** Currently active module ID for highlighting */
  currentModuleId: ModuleId;
}

/**
 * Slide-out menu overlay listing enabled modules, hub link, and settings.
 * Triggered from the ModuleHeader hamburger icon.
 */
export function HamburgerMenu({
  visible,
  onClose,
  currentModuleId,
}: HamburgerMenuProps) {
  const router = useRouter();
  const [retryKey, setRetryKey] = React.useState(0);
  const modulesResult = useSafeEnabledModules(retryKey);
  const modules = modulesResult.ok ? modulesResult.modules : [];
  const error = modulesResult.ok ? null : modulesResult.error;

  const navigateTo = useCallback(
    (route: string) => {
      onClose();
      router.push(route as never);
    },
    [onClose, router],
  );

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.drawer} onPress={(e) => e.stopPropagation()}>
          <BlurView
            tint="dark"
            intensity={90}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <Text color={colors.text} style={styles.headerTitle}>
                Navigation
              </Text>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Close menu"
                accessibilityRole="button"
              >
                <Text color={colors.textSecondary} style={styles.closeIcon}>
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            {/* Hub link */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigateTo('/(hub)')}
              accessibilityRole="link"
            >
              <Text style={styles.menuIcon}>🏠</Text>
              <Text color={colors.text} style={styles.menuLabel}>
                Home
              </Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Module list */}
            <ScrollView
              style={styles.moduleList}
              showsVerticalScrollIndicator={false}
            >
              {error ? (
                <View style={styles.errorContainer}>
                  <Text color={colors.danger} style={styles.errorTitle}>
                    Couldn't load modules
                  </Text>
                  <Text color={colors.textTertiary} style={styles.errorBody}>
                    {error.message || 'Module registry unavailable.'}
                  </Text>
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => setRetryKey((k) => k + 1)}
                    accessibilityRole="button"
                    accessibilityLabel="Retry loading modules"
                  >
                    <Text color={colors.text} style={styles.retryLabel}>
                      Retry
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : modules.length === 0 ? (
                <Text color={colors.textTertiary} style={styles.emptyText}>
                  No modules enabled. Open the hub to enable modules.
                </Text>
              ) : (
                modules.map((mod: EnabledModule) => {
                  const isActive = mod.id === currentModuleId;
                  const accent =
                    colors.modules[mod.id as keyof typeof colors.modules] ??
                    colors.accent;
                  return (
                    <TouchableOpacity
                      key={mod.id}
                      style={[
                        styles.menuItem,
                        isActive && {
                          backgroundColor: 'rgba(255,255,255,0.06)',
                        },
                      ]}
                      onPress={() => navigateTo(`/(${mod.id})`)}
                      accessibilityRole="link"
                      accessibilityState={{ selected: isActive }}
                    >
                      <Text style={styles.menuIcon}>{mod.icon}</Text>
                      <Text
                        color={isActive ? accent : colors.text}
                        style={[
                          styles.menuLabel,
                          isActive && { fontWeight: '700' },
                        ]}
                      >
                        {mod.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.divider} />

            {/* Settings link */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigateTo('/(hub)/settings')}
              accessibilityRole="link"
            >
              <Text style={styles.menuIcon}>⚙️</Text>
              <Text color={colors.textSecondary} style={styles.menuLabel}>
                Settings
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}


const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  drawer: {
    maxHeight: '80%',
    borderTopLeftRadius: navigation.tabBarBorderRadius,
    borderTopRightRadius: navigation.tabBarBorderRadius,
    overflow: 'hidden',
    backgroundColor: surfaceTiers.low,
  },
  content: {
    paddingTop: 20,
    paddingBottom: 32,
    paddingHorizontal: navigation.headerPaddingHorizontal,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeIcon: {
    fontSize: 18,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  moduleList: {
    maxHeight: 400,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  menuIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 14,
    paddingVertical: 16,
    textAlign: 'center',
  },
  errorContainer: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 8,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorBody: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});
