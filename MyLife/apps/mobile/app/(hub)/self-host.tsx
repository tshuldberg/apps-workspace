import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, Text, colors, spacing, borderRadius } from '@mylife/ui';
import { incrementAggregateEventCounter, getPreference, setPreference } from '@mylife/db';
import { useDatabase } from '../../components/DatabaseProvider';
import { getModeConfig, saveModeConfig } from '../../lib/entitlements';
import {
  testSelfHostConnection,
  type SelfHostConnectionResult,
} from '../../lib/server-endpoint';

type SelfHostConnectionMethod = 'port_forward_tls' | 'dynamic_dns' | 'outbound_tunnel';

interface ConnectionMethodGuide {
  id: SelfHostConnectionMethod;
  title: string;
  bestFor: string;
  overview: string;
  urlTemplate: string;
  pros: string[];
  cons: string[];
  steps: string[];
}

const SELF_HOST_CONNECTION_METHOD_KEY = 'self_host.connection_method';

const CONNECTION_METHODS: ConnectionMethodGuide[] = [
  {
    id: 'port_forward_tls',
    title: 'Port Forwarding + TLS',
    bestFor: 'Full control with no tunnel provider dependency.',
    overview: 'Expose your home node directly with router forwarding, DNS, and HTTPS proxy.',
    urlTemplate: 'https://home.example.com',
    pros: [
      'Direct path without intermediary tunnel network.',
      'Strong long-term control over routing and certificates.',
      'Good fit for always-on home servers.',
    ],
    cons: [
      'Requires router/firewall setup skill.',
      'Can fail on CGNAT or blocked inbound ports.',
      'Public exposure requires strict security maintenance.',
    ],
    steps: [
      'Reserve static LAN IP and run MyLife API locally.',
      'Forward router external 443 to reverse-proxy 443.',
      'Point domain DNS to home public IP.',
      'Configure Caddy/NGINX TLS proxy to localhost:8787.',
      'Check /health from outside your LAN.',
      'Save URL below and run Test Connection.',
    ],
  },
  {
    id: 'dynamic_dns',
    title: 'Dynamic DNS + Forwarding',
    bestFor: 'Residential dynamic IP connections.',
    overview: 'Keep hostname synced to changing home IP while preserving direct HTTPS architecture.',
    urlTemplate: 'https://mylife-home.duckdns.org',
    pros: [
      'Works with changing ISP IP addresses.',
      'Retains direct node-to-node design.',
      'Usually low-cost and automated once configured.',
    ],
    cons: [
      'Still needs inbound forwarding and TLS proxy setup.',
      'Dependent on DDNS updater reliability.',
      'Hostnames vary in quality by provider.',
    ],
    steps: [
      'Create DDNS hostname and updater credentials.',
      'Run updater on router or home server.',
      'Forward external 443 to proxy host.',
      'Issue TLS cert for DDNS hostname.',
      'Confirm DNS updates after IP changes.',
      'Use DDNS HTTPS URL below and run Test Connection.',
    ],
  },
  {
    id: 'outbound_tunnel',
    title: 'Outbound Tunnel',
    bestFor: 'Blocked ports / CGNAT / easiest setup.',
    overview: 'Tunnel client creates outbound path from home to a public hostname.',
    urlTemplate: 'https://mylife-node.trycloudflare.com',
    pros: [
      'No inbound router opening required.',
      'Works on restrictive home network topologies.',
      'Fastest setup path for non-network admins.',
    ],
    cons: [
      'Introduces third-party tunnel dependency.',
      'Adds potential latency and another failure domain.',
      'Tunnel client process must stay healthy.',
    ],
    steps: [
      'Install tunnel agent and authenticate account.',
      'Map public hostname to local http://localhost:8787.',
      'Enable TLS endpoint from provider.',
      'Validate /health from mobile data.',
      'Configure service auto-start/restart.',
      'Paste tunnel URL below and run Test Connection.',
    ],
  },
];

function isConnectionMethod(value: string | null | undefined): value is SelfHostConnectionMethod {
  return value === 'port_forward_tls' || value === 'dynamic_dns' || value === 'outbound_tunnel';
}

export default function SelfHostScreen() {
  const router = useRouter();
  const db = useDatabase();
  const modeConfig = getModeConfig(db);

  const initialMethodRaw = getPreference(db, SELF_HOST_CONNECTION_METHOD_KEY);
  const initialMethod: SelfHostConnectionMethod = isConnectionMethod(initialMethodRaw)
    ? initialMethodRaw
    : 'port_forward_tls';

  const [serverUrl, setServerUrl] = useState(modeConfig.serverUrl ?? '');
  const [selectedMethod, setSelectedMethod] = useState<SelfHostConnectionMethod>(initialMethod);
  const [stepIndex, setStepIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [result, setResult] = useState<SelfHostConnectionResult | null>(null);

  const activeMethod = useMemo(
    () => CONNECTION_METHODS.find((item) => item.id === selectedMethod) ?? CONNECTION_METHODS[0],
    [selectedMethod],
  );
  const maxStepIndex = Math.max(0, activeMethod.steps.length - 1);

  const handleSelectMethod = (method: SelfHostConnectionMethod) => {
    setSelectedMethod(method);
    setStepIndex(0);
    setPreference(db, SELF_HOST_CONNECTION_METHOD_KEY, method);
  };

  const applySuggestedUrl = () => {
    setServerUrl(activeMethod.urlTemplate);
    setSaveMessage(`Loaded suggested URL for ${activeMethod.title}.`);
  };

  const handleSave = () => {
    setIsSaving(true);
    try {
      saveModeConfig(db, 'self_host', serverUrl || null);
      incrementAggregateEventCounter(db, 'mode_selected:self_host');
      setSaveMessage('Saved self-host mode and server URL.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const testResult = await testSelfHostConnection(serverUrl);
      setResult(testResult);
      if (testResult.ok) {
        incrementAggregateEventCounter(db, 'setup_completed:self_host');
      }
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text variant="heading">Self-Host Setup Wizard</Text>
        <Text variant="body" color={colors.textSecondary}>
          Compare methods, review pros/cons, follow steps, then run connectivity checks.
        </Text>
      </View>

      <Card style={styles.card}>
        <Text variant="label" color={colors.textSecondary}>1) Choose Connection Method</Text>
        <View style={styles.methodGrid}>
          {CONNECTION_METHODS.map((method) => {
            const active = method.id === selectedMethod;
            return (
              <Pressable
                key={method.id}
                style={active ? [styles.methodCard, styles.methodCardActive] : styles.methodCard}
                onPress={() => handleSelectMethod(method.id)}
              >
                <Text variant="label">{method.title}</Text>
                <Text variant="caption" color={colors.modules.books}>{method.bestFor}</Text>
                <Text variant="caption" color={colors.textSecondary}>{method.overview}</Text>

                <Text variant="caption">Pros</Text>
                {method.pros.map((item) => (
                  <Text key={`${method.id}-pro-${item}`} variant="caption" color={colors.textSecondary}>• {item}</Text>
                ))}

                <Text variant="caption">Cons</Text>
                {method.cons.map((item) => (
                  <Text key={`${method.id}-con-${item}`} variant="caption" color={colors.textSecondary}>• {item}</Text>
                ))}
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card style={styles.card}>
        <Text variant="label" color={colors.textSecondary}>2) Guided Steps</Text>
        <Text variant="caption" color={colors.textSecondary}>{activeMethod.title}</Text>
        <Text variant="caption" color={colors.textSecondary}>Step {stepIndex + 1} of {activeMethod.steps.length}</Text>
        <View style={styles.stepCard}>
          <Text variant="caption" color={colors.textSecondary}>{activeMethod.steps[stepIndex]}</Text>
        </View>
        <View style={styles.buttonRow}>
          <Pressable
            style={styles.button}
            onPress={() => setStepIndex((current) => Math.max(0, current - 1))}
            disabled={stepIndex === 0}
          >
            <Text variant="label">Previous Step</Text>
          </Pressable>
          <Pressable
            style={styles.button}
            onPress={() => setStepIndex((current) => Math.min(maxStepIndex, current + 1))}
            disabled={stepIndex >= maxStepIndex}
          >
            <Text variant="label">Next Step</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={applySuggestedUrl}>
            <Text variant="label">Use Suggested URL</Text>
          </Pressable>
        </View>
      </Card>

      <Card style={styles.card}>
        <Text variant="label" color={colors.textSecondary}>3) Save and Verify</Text>
        <TextInput
          value={serverUrl}
          onChangeText={setServerUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://home.example.com"
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
        />
        <View style={styles.buttonRow}>
          <Pressable style={styles.button} onPress={handleSave} disabled={isSaving}>
            <Text variant="label">{isSaving ? 'Saving...' : 'Save and Use Self-Host'}</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => void handleTest()} disabled={isTesting}>
            <Text variant="label">{isTesting ? 'Testing...' : 'Test Connection'}</Text>
          </Pressable>
        </View>
        <Text variant="caption" color={colors.textSecondary}>
          Current mode: {modeConfig.mode.replace('_', ' ')}
        </Text>
        <Text variant="caption" color={colors.textSecondary}>
          Selected method: {activeMethod.title}
        </Text>
        {saveMessage && (
          <Text variant="caption" color={colors.textSecondary}>{saveMessage}</Text>
        )}
      </Card>

      <Card style={styles.card}>
        <Text variant="label" color={colors.textSecondary}>Connection Test</Text>
        {result ? (
          <View style={styles.checkList}>
            <Text variant="caption" color={colors.textSecondary}>
              Target: {result.baseUrl ?? 'Invalid URL'}
            </Text>
            <Text variant="caption" color={colors.textSecondary}>
              Overall: {result.ok ? 'PASS' : 'FAIL'}
            </Text>
            {result.checks.map((check) => (
              <View key={check.id} style={styles.checkItem}>
                <View style={styles.checkHeader}>
                  <Text variant="label">{check.id.toUpperCase()}</Text>
                  <Text variant="caption" color={check.ok ? '#71d7a0' : '#ff9f9f'}>
                    {check.ok ? 'PASS' : 'FAIL'}
                  </Text>
                </View>
                <Text variant="caption" color={colors.textSecondary}>{check.message}</Text>
                {check.httpStatus !== undefined && (
                  <Text variant="caption" color={colors.textSecondary}>HTTP {check.httpStatus}</Text>
                )}
              </View>
            ))}
          </View>
        ) : (
          <Text variant="caption" color={colors.textSecondary}>
            Run "Test Connection" to validate URL, TLS, health, and sync reachability.
          </Text>
        )}
      </Card>

      <Pressable style={styles.backButton} onPress={() => router.push('/(hub)/settings')}>
        <Text variant="label">Back to Settings</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    gap: spacing.xs,
  },
  card: {
    gap: spacing.sm,
  },
  methodGrid: {
    gap: spacing.sm,
  },
  methodCard: {
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.sm,
    minHeight: 220,
  },
  methodCardActive: {
    borderColor: colors.modules.books,
  },
  stepCard: {
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.sm,
    minHeight: 72,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  button: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  checkList: {
    gap: spacing.sm,
  },
  checkItem: {
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.sm,
  },
  checkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
