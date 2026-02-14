'use client'

import { useState } from 'react'
import { Button } from '@marlin/ui/primitives/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@marlin/ui/primitives/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@marlin/ui/primitives/dialog'
import { Input } from '@marlin/ui/primitives/input'
import { cn } from '@marlin/ui/lib/utils'

// ── Types ──────────────────────────────────────────────────

interface BrokerConnection {
  id: string
  provider: 'alpaca' | 'ibkr' | 'tradier'
  accountId: string
  isActive: boolean
  isPaper: boolean
  connectedAt: string
  updatedAt: string
}

interface BrokerInfo {
  id: 'alpaca' | 'ibkr' | 'tradier'
  name: string
  description: string
  supported: boolean
  logoColor: string
}

const BROKERS: BrokerInfo[] = [
  {
    id: 'alpaca',
    name: 'Alpaca',
    description: 'Commission-free trading API with paper and live modes. Supports stocks and crypto.',
    supported: true,
    logoColor: 'text-yellow-400',
  },
  {
    id: 'ibkr',
    name: 'Interactive Brokers',
    description: 'Professional-grade broker with global market access. Coming soon.',
    supported: false,
    logoColor: 'text-red-400',
  },
  {
    id: 'tradier',
    name: 'Tradier',
    description: 'Low-cost brokerage with powerful options trading. Coming soon.',
    supported: false,
    logoColor: 'text-blue-400',
  },
]

// ── Helpers ────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ── Component ──────────────────────────────────────────────

export default function BrokerSettingsPage() {
  // In production, these come from tRPC queries
  const [connections, setConnections] = useState<BrokerConnection[]>([])
  const [showConnectDialog, setShowConnectDialog] = useState(false)
  const [showDisconnectDialog, setShowDisconnectDialog] = useState<string | null>(null)
  const [connectingProvider, setConnectingProvider] = useState<BrokerInfo | null>(null)

  // Connect form state
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [isPaper, setIsPaper] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)

  const handleConnect = (broker: BrokerInfo) => {
    setConnectingProvider(broker)
    setShowConnectDialog(true)
    setApiKey('')
    setApiSecret('')
    setIsPaper(true)
  }

  const handleSubmitConnect = async () => {
    if (!connectingProvider || !apiKey) return
    setIsConnecting(true)

    try {
      // In production, this calls trpc.broker.connect.mutate()
      const newConnection: BrokerConnection = {
        id: crypto.randomUUID(),
        provider: connectingProvider.id,
        accountId: 'PA-XXXXXXXX',
        isActive: true,
        isPaper,
        connectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      setConnections((prev) => [...prev, newConnection])
      setShowConnectDialog(false)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = (connectionId: string) => {
    // In production, this calls trpc.broker.disconnect.mutate()
    setConnections((prev) => prev.filter((c) => c.id !== connectionId))
    setShowDisconnectDialog(null)
  }

  const activeConnections = connections.filter((c) => c.isActive)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Broker Connections</h1>
        <p className="text-sm text-text-secondary">
          Connect your brokerage account to trade with real money
        </p>
      </div>

      {/* Active connections */}
      {activeConnections.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-text-secondary">Connected Brokers</h2>
          {activeConnections.map((conn) => {
            const broker = BROKERS.find((b) => b.id === conn.provider)
            return (
              <Card key={conn.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    {/* Status indicator */}
                    <div className="relative">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-lg border text-lg font-bold',
                          conn.isActive
                            ? 'border-trading-green/30 bg-trading-green/10 text-trading-green'
                            : 'border-border bg-navy-mid text-text-muted',
                        )}
                      >
                        {broker?.name.charAt(0) ?? '?'}
                      </div>
                      {/* Health dot */}
                      <div
                        className={cn(
                          'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-navy-dark',
                          conn.isActive ? 'bg-trading-green' : 'bg-text-muted',
                        )}
                      />
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-text-primary">
                          {broker?.name ?? conn.provider}
                        </span>
                        <span
                          className={cn(
                            'rounded px-1.5 py-px text-[10px] font-bold uppercase',
                            conn.isPaper
                              ? 'bg-warning/20 text-warning'
                              : 'bg-trading-green/20 text-trading-green',
                          )}
                        >
                          {conn.isPaper ? 'Paper' : 'Live'}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-text-muted">
                        Account: {conn.accountId}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end text-xs">
                      <span className="text-text-muted">
                        Connected {formatDate(conn.connectedAt)}
                      </span>
                      <span className="text-text-muted">
                        Last sync: {timeSince(conn.updatedAt)}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDisconnectDialog(conn.id)}
                    >
                      Disconnect
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Available brokers */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-text-secondary">Available Brokers</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {BROKERS.map((broker) => {
            const isConnected = activeConnections.some((c) => c.provider === broker.id)

            return (
              <Card
                key={broker.id}
                className={cn(
                  'relative flex flex-col',
                  isConnected && 'ring-1 ring-trading-green/30',
                )}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className={broker.logoColor}>{broker.name.charAt(0)}</span>
                    {broker.name}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {broker.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-end pt-0">
                  {isConnected ? (
                    <Button variant="outline" size="sm" disabled className="w-full">
                      Connected
                    </Button>
                  ) : broker.supported ? (
                    <Button size="sm" className="w-full" onClick={() => handleConnect(broker)}>
                      Connect {broker.name}
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" disabled className="w-full">
                      Coming Soon
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Security notice */}
      <Card className="border-border/50">
        <CardContent className="flex items-start gap-3 p-4">
          <svg
            className="mt-0.5 h-5 w-5 shrink-0 text-accent"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <div>
            <p className="text-sm font-medium text-text-primary">Security</p>
            <p className="text-xs text-text-secondary">
              Your broker credentials are encrypted at rest and transmitted over TLS.
              We never store your brokerage password. API keys can be revoked at any time
              from your broker's settings page.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Connect Dialog */}
      <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect {connectingProvider?.name}</DialogTitle>
            <DialogDescription>
              Enter your API credentials to connect your {connectingProvider?.name} account.
              You can generate API keys from your broker's dashboard.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs text-text-secondary">API Key</label>
              <Input
                variant="monospace"
                placeholder="PK..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-secondary">Secret Key</label>
              <Input
                variant="monospace"
                type="password"
                placeholder="Secret key"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={isPaper}
                onChange={(e) => setIsPaper(e.target.checked)}
                className="rounded border-border"
              />
              Paper trading mode (recommended for testing)
            </label>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowConnectDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitConnect} disabled={!apiKey || isConnecting}>
              {isConnecting ? 'Connecting...' : 'Connect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect Dialog */}
      <Dialog
        open={showDisconnectDialog !== null}
        onOpenChange={(open) => !open && setShowDisconnectDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Broker</DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect this broker? Any open orders will remain
              active on the broker's side. You can reconnect at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDisconnectDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => showDisconnectDialog && handleDisconnect(showDisconnectDialog)}
            >
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
