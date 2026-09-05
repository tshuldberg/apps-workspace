'use client';

import { useEffect, useState } from 'react';
import type { PlanMode } from '@mylife/entitlements';
import type { SelfHostConnectionResult } from '@/lib/server-endpoint';
import {
  getModeConfigAction,
  setModeConfigAction,
  testSelfHostConnectionAction,
  recordOperationalEventAction,
  getSelfHostConnectionMethodAction,
  setSelfHostConnectionMethodAction,
  type SelfHostConnectionMethod,
} from '@/app/actions';

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

const CONNECTION_METHODS: ConnectionMethodGuide[] = [
  {
    id: 'port_forward_tls',
    title: 'Port Forwarding + Domain + TLS',
    bestFor: 'Best for full control with no tunnel dependency.',
    overview: 'Expose your home node directly over HTTPS using router forwarding and a reverse proxy.',
    urlTemplate: 'https://home.example.com',
    pros: [
      'Direct peer-to-peer server path with no tunnel provider in between.',
      'Low recurring dependency risk after setup.',
      'Works well for always-on home servers with stable networking.',
    ],
    cons: [
      'Router and firewall setup can be complex for non-technical users.',
      'Not possible on some ISP plans (CGNAT or blocked inbound ports).',
      'Public exposure requires careful TLS and patching hygiene.',
    ],
    steps: [
      'Reserve a static LAN IP for your MyLife host and run API on local port 8787.',
      'Configure router port-forward: external 443 -> internal host:443 (reverse proxy).',
      'Create DNS A/AAAA record (for example home.example.com) pointing to your public IP.',
      'Install Caddy or NGINX and proxy / to http://localhost:8787 with automatic TLS.',
      'Verify https://home.example.com/health from mobile data (outside your home Wi-Fi).',
      'Enter this URL below, save mode, and run connection test.',
    ],
  },
  {
    id: 'dynamic_dns',
    title: 'Dynamic DNS + Port Forwarding',
    bestFor: 'Best for home internet plans with changing public IP addresses.',
    overview: 'Use DDNS to keep your hostname updated when your ISP rotates your IP, with the same direct TLS path.',
    urlTemplate: 'https://mylife-home.duckdns.org',
    pros: [
      'Handles changing residential IP addresses automatically.',
      'Keeps the same direct architecture as normal port forwarding.',
      'Usually inexpensive and easy to maintain after initial setup.',
    ],
    cons: [
      'Still needs inbound router forwarding and TLS termination.',
      'DDNS update outages can temporarily break remote reachability.',
      'Hostname quality and trust perception can vary by DDNS provider.',
    ],
    steps: [
      'Choose a DDNS provider and create a hostname.',
      'Install provider updater on router or server to keep DNS current.',
      'Configure router external 443 forwarding to your reverse proxy.',
      'Enable HTTPS certificates for the DDNS hostname via Caddy/NGINX.',
      'Test DNS update by rebooting router and confirming hostname still resolves.',
      'Use your DDNS HTTPS URL below, then run connection test.',
    ],
  },
  {
    id: 'outbound_tunnel',
    title: 'Outbound Tunnel (No Port Open)',
    bestFor: 'Best when router/ISP blocks inbound ports or you want the easiest setup.',
    overview: 'Run a tunnel client that creates an outbound connection to a public endpoint, then routes HTTPS traffic to your local node.',
    urlTemplate: 'https://mylife-node.trycloudflare.com',
    pros: [
      'No inbound router configuration required in most cases.',
      'Works on many restrictive home networks and CGNAT plans.',
      'Fastest initial setup for non-networking users.',
    ],
    cons: [
      'Depends on third-party tunnel infrastructure availability.',
      'Adds one extra network hop and potential latency.',
      'You must keep tunnel client process healthy and auto-restarting.',
    ],
    steps: [
      'Install a tunnel client (for example Cloudflare Tunnel, Tailscale Funnel, or ngrok reserved domain).',
      'Configure tunnel public hostname to proxy to http://localhost:8787.',
      'Enable TLS on the public endpoint provided by the tunnel provider.',
      'Verify https://<your-public-host>/health from outside your LAN.',
      'Set tunnel service to auto-start and auto-restart on reboot.',
      'Paste the tunnel URL below and run connection test.',
    ],
  },
];

function getConnectionMethod(method: SelfHostConnectionMethod): ConnectionMethodGuide {
  return CONNECTION_METHODS.find((entry) => entry.id === method) ?? CONNECTION_METHODS[0];
}

export default function SelfHostSettingsPage() {
  const [mode, setMode] = useState<PlanMode>('local_only');
  const [serverUrl, setServerUrl] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<SelfHostConnectionMethod>('port_forward_tls');
  const [stepIndex, setStepIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [result, setResult] = useState<SelfHostConnectionResult | null>(null);

  useEffect(() => {
    void (async () => {
      const [config, method] = await Promise.all([
        getModeConfigAction(),
        getSelfHostConnectionMethodAction(),
      ]);

      setMode(config.mode);
      setServerUrl(config.serverUrl ?? '');
      setSelectedMethod(method);
      setStepIndex(0);
    })();
  }, []);

  const activeMethod = getConnectionMethod(selectedMethod);
  const maxStepIndex = Math.max(0, activeMethod.steps.length - 1);

  const handleSelectMethod = async (method: SelfHostConnectionMethod) => {
    setSelectedMethod(method);
    setStepIndex(0);
    try {
      await setSelfHostConnectionMethodAction(method);
    } catch {
      // Method selection persistence is best-effort only.
    }
  };

  const applySuggestedUrl = () => {
    setServerUrl(activeMethod.urlTemplate);
    setSaveMessage(`Loaded suggested URL for ${activeMethod.title}.`);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await setModeConfigAction('self_host', serverUrl || null);
      setMode('self_host');
      setSaveMessage('Saved self-host mode and server URL.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const testResult = await testSelfHostConnectionAction(serverUrl);
      setResult(testResult);
      if (testResult.ok) {
        await recordOperationalEventAction('setup_completed:self_host');
      }
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <h1 style={styles.title}>Self-Host Setup Wizard</h1>
        <p style={styles.subtitle}>
          Pick your connectivity method, follow guided steps, then validate with live checks.
        </p>
      </div>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>1) Choose Connection Method</h2>
        <div style={styles.methodGrid}>
          {CONNECTION_METHODS.map((method) => {
            const selected = method.id === selectedMethod;
            return (
              <button
                key={method.id}
                type="button"
                style={selected ? styles.methodCardActive : styles.methodCard}
                onClick={() => void handleSelectMethod(method.id)}
              >
                <span style={styles.methodTitle}>{method.title}</span>
                <span style={styles.methodBestFor}>{method.bestFor}</span>
                <span style={styles.methodOverview}>{method.overview}</span>
                <span style={styles.prosConsLabel}>Pros</span>
                <ul style={styles.listCompact}>
                  {method.pros.map((pro) => (
                    <li key={`${method.id}-pro-${pro}`}>{pro}</li>
                  ))}
                </ul>
                <span style={styles.prosConsLabel}>Cons</span>
                <ul style={styles.listCompact}>
                  {method.cons.map((con) => (
                    <li key={`${method.id}-con-${con}`}>{con}</li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>2) Follow Guided Steps</h2>
        <div style={styles.card}>
          <p style={styles.methodHeaderLine}>{activeMethod.title}</p>
          <p style={styles.note}>Step {stepIndex + 1} of {activeMethod.steps.length}</p>
          <div style={styles.stepCard}>
            <p style={styles.stepText}>{activeMethod.steps[stepIndex]}</p>
          </div>
          <div style={styles.buttonRow}>
            <button
              type="button"
              style={styles.button}
              onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
              disabled={stepIndex === 0}
            >
              Previous Step
            </button>
            <button
              type="button"
              style={styles.button}
              onClick={() => setStepIndex((current) => Math.min(maxStepIndex, current + 1))}
              disabled={stepIndex >= maxStepIndex}
            >
              Next Step
            </button>
            <button type="button" style={styles.button} onClick={applySuggestedUrl}>
              Use Suggested URL
            </button>
          </div>
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>3) Save and Verify</h2>
        <div style={styles.card}>
          <label htmlFor="self-host-url" style={styles.label}>Server URL</label>
          <input
            id="self-host-url"
            type="url"
            value={serverUrl}
            onChange={(event) => setServerUrl(event.target.value)}
            placeholder="https://home.example.com"
            style={styles.input}
          />
          <div style={styles.buttonRow}>
            <button type="button" style={styles.button} onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save and Use Self-Host'}
            </button>
            <button type="button" style={styles.button} onClick={() => void handleTest()} disabled={isTesting}>
              {isTesting ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
          <p style={styles.note}>Current mode: {mode.replace('_', ' ')}</p>
          <p style={styles.note}>Selected method: {activeMethod.title}</p>
          {saveMessage && <p style={styles.note}>{saveMessage}</p>}
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Connection Test</h2>
        <div style={styles.card}>
          {result ? (
            <>
              <p style={styles.note}>Target: {result.baseUrl ?? 'Invalid URL'}</p>
              <p style={styles.note}>Overall: {result.ok ? 'PASS' : 'FAIL'}</p>
              <div style={styles.checkList}>
                {result.checks.map((check) => (
                  <div key={check.id} style={styles.checkItem}>
                    <div style={styles.checkHeader}>
                      <span style={styles.checkName}>{check.id.toUpperCase()}</span>
                      <span style={check.ok ? styles.okBadge : styles.failBadge}>
                        {check.ok ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                    <p style={styles.checkMessage}>{check.message}</p>
                    {check.httpStatus !== undefined && (
                      <p style={styles.checkMessage}>HTTP {check.httpStatus}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p style={styles.note}>
              Run "Test Connection" to validate URL, TLS, health, and entitlement sync reachability.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    maxWidth: '980px',
    margin: '0 auto',
    display: 'grid',
    gap: '20px',
  },
  header: {
    display: 'grid',
    gap: '6px',
  },
  title: {
    margin: 0,
    fontSize: '28px',
    color: 'var(--text)',
  },
  subtitle: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: '14px',
  },
  section: {
    display: 'grid',
    gap: '10px',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '18px',
    color: 'var(--text)',
  },
  card: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--surface)',
    padding: '16px',
    display: 'grid',
    gap: '10px',
  },
  methodGrid: {
    display: 'grid',
    gap: '12px',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  },
  methodCard: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--surface)',
    color: 'var(--text)',
    textAlign: 'left',
    padding: '14px',
    display: 'grid',
    gap: '6px',
    minHeight: '220px',
    cursor: 'pointer',
  },
  methodCardActive: {
    border: '1px solid var(--accent-books)',
    boxShadow: '0 0 0 1px color-mix(in srgb, var(--accent-books) 55%, transparent)',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'color-mix(in srgb, var(--surface) 70%, var(--surface-elevated) 30%)',
    color: 'var(--text)',
    textAlign: 'left',
    padding: '14px',
    display: 'grid',
    gap: '6px',
    minHeight: '220px',
    cursor: 'pointer',
  },
  methodTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: 'var(--text)',
  },
  methodBestFor: {
    fontSize: '12px',
    color: 'var(--accent-books)',
    fontWeight: 700,
  },
  methodOverview: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  prosConsLabel: {
    marginTop: '2px',
    fontSize: '12px',
    color: 'var(--text)',
    fontWeight: 700,
  },
  listCompact: {
    margin: 0,
    paddingInlineStart: '18px',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    lineHeight: '1.35',
    display: 'grid',
    gap: '2px',
  },
  methodHeaderLine: {
    margin: 0,
    fontSize: '14px',
    color: 'var(--text)',
    fontWeight: 700,
  },
  stepCard: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--surface-elevated)',
    padding: '10px',
    minHeight: '64px',
    display: 'grid',
    alignItems: 'center',
  },
  stepText: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: '13px',
    lineHeight: '1.4',
  },
  label: {
    color: 'var(--text-secondary)',
    fontSize: '13px',
    fontWeight: 600,
  },
  input: {
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 12px',
    fontSize: '14px',
  },
  buttonRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  button: {
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text)',
    borderRadius: 'var(--radius-md)',
    padding: '8px 12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  note: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: '13px',
  },
  checkList: {
    display: 'grid',
    gap: '8px',
  },
  checkItem: {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '10px',
    backgroundColor: 'var(--surface-elevated)',
    display: 'grid',
    gap: '6px',
  },
  checkHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checkName: {
    color: 'var(--text)',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.5px',
  },
  checkMessage: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: '13px',
  },
  okBadge: {
    borderRadius: 'var(--radius-sm)',
    border: '1px solid #0f7b4d',
    color: '#71d7a0',
    padding: '2px 6px',
    fontSize: '11px',
    fontWeight: 700,
  },
  failBadge: {
    borderRadius: 'var(--radius-sm)',
    border: '1px solid #9f2a2a',
    color: '#ff9f9f',
    padding: '2px 6px',
    fontSize: '11px',
    fontWeight: 700,
  },
};
