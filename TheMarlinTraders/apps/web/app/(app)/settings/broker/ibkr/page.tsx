'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@marlin/ui/primitives/button'
import { Input } from '@marlin/ui/primitives/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@marlin/ui/primitives/card'
import { cn } from '@marlin/ui/lib/utils'

// ── Types ────────────────────────────────────────────────

interface IBKRSubAccount {
  accountId: string
  displayName: string
  alias: string
  type: string
  tradingType: string
  isPaper: boolean
  isActive: boolean
}

interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error' | 'expired'
  connectionId?: string
  lastSyncAt?: string
  sessionExpiresAt?: string
  errorMessage?: string
}

// ── Helpers ──────────────────────────────────────────────

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getTimeUntilExpiry(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  return `${hours}h ${minutes}m remaining`
}

// ── Main Page ───────────────────────────────────────────

export default function IBKRSettingsPage() {
  const [connection, setConnection] = useState<ConnectionState>({
    status: 'disconnected',
  })
  const [sessionToken, setSessionToken] = useState('')
  const [accounts, setAccounts] = useState<IBKRSubAccount[]>([])
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null)
  const [editingAlias, setEditingAlias] = useState<string | null>(null)
  const [aliasValue, setAliasValue] = useState('')
  const [accountBalances, setAccountBalances] = useState<
    Record<string, { equity: number; cashBalance: number; buyingPower: number; marginUsed: number }>
  >({})

  // Simulate session expiry warning
  const isSessionExpiring =
    connection.sessionExpiresAt &&
    new Date(connection.sessionExpiresAt).getTime() - Date.now() < 2 * 60 * 60 * 1000

  const handleConnect = useCallback(async () => {
    if (!sessionToken.trim()) return

    setConnection({ status: 'connecting' })

    try {
      // TODO: Call tRPC broker.connect({ provider: 'ibkr', accessToken: sessionToken })
      // Simulated success for now
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

      setConnection({
        status: 'connected',
        connectionId: 'ibkr-placeholder-id',
        lastSyncAt: new Date().toISOString(),
        sessionExpiresAt: expiresAt,
      })

      // TODO: Call tRPC broker.ibkrListAccounts to populate accounts
      setAccounts([])
    } catch {
      setConnection({
        status: 'error',
        errorMessage: 'Failed to connect. Ensure IBKR Client Portal Gateway is running.',
      })
    }
  }, [sessionToken])

  const handleDisconnect = useCallback(async () => {
    // TODO: Call tRPC broker.disconnect({ connectionId })
    setConnection({ status: 'disconnected' })
    setAccounts([])
    setActiveAccountId(null)
    setAccountBalances({})
    setSessionToken('')
  }, [])

  const handleSwitchAccount = useCallback(
    async (accountId: string) => {
      setActiveAccountId(accountId)
      // TODO: Call tRPC broker.ibkrSwitchAccount
    },
    [],
  )

  const handleSaveAlias = useCallback(
    async (accountId: string) => {
      // TODO: Call tRPC broker.ibkrSetAlias({ accountId, alias: aliasValue })
      setAccounts((prev) =>
        prev.map((a) =>
          a.accountId === accountId ? { ...a, alias: aliasValue } : a,
        ),
      )
      setEditingAlias(null)
      setAliasValue('')
    },
    [aliasValue],
  )

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">
          Interactive Brokers
        </h1>
        <p className="text-sm text-text-secondary">
          Connect your IBKR account via Client Portal Gateway
        </p>
      </div>

      {/* Session Expiry Warning */}
      {connection.status === 'connected' && isSessionExpiring && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <span className="text-warning text-lg">!</span>
            <div>
              <p className="text-sm font-medium text-warning">
                Session Expiring Soon
              </p>
              <p className="text-xs text-text-secondary">
                IBKR sessions expire after approximately 24 hours. Your session
                has{' '}
                {connection.sessionExpiresAt
                  ? getTimeUntilExpiry(connection.sessionExpiresAt)
                  : 'unknown time'}{' '}
                left. Re-authenticate to continue trading.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={handleDisconnect}
              >
                Re-authenticate
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Connection Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Connection</CardTitle>
              <CardDescription>
                IBKR Client Portal Gateway session
              </CardDescription>
            </div>
            <span
              className={cn(
                'rounded px-2 py-0.5 text-xs font-bold',
                connection.status === 'connected' &&
                  'bg-trading-green/20 text-trading-green',
                connection.status === 'disconnected' &&
                  'bg-text-muted/20 text-text-muted',
                connection.status === 'connecting' &&
                  'bg-accent/20 text-accent',
                connection.status === 'error' &&
                  'bg-trading-red/20 text-trading-red',
                connection.status === 'expired' &&
                  'bg-warning/20 text-warning',
              )}
            >
              {connection.status.toUpperCase()}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {connection.status === 'disconnected' && (
            <>
              <div className="rounded-lg border border-border bg-navy-dark/50 p-3">
                <p className="text-xs text-text-muted">
                  To connect IBKR, you need the Client Portal Gateway running
                  locally. Follow the{' '}
                  <a
                    href="https://www.interactivebrokers.com/en/trading/ib-api.php"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline"
                  >
                    IBKR API setup guide
                  </a>{' '}
                  to install and configure the gateway.
                </p>
              </div>
              <Input
                placeholder="Session Token"
                type="password"
                value={sessionToken}
                onChange={(e) => setSessionToken(e.target.value)}
              />
              <Button onClick={handleConnect} disabled={!sessionToken.trim()}>
                Connect to IBKR
              </Button>
            </>
          )}

          {connection.status === 'connecting' && (
            <p className="text-sm text-text-muted">
              Authenticating with IBKR Client Portal Gateway...
            </p>
          )}

          {connection.status === 'error' && (
            <div className="space-y-3">
              <p className="text-sm text-trading-red">
                {connection.errorMessage}
              </p>
              <Button variant="outline" onClick={handleConnect}>
                Retry Connection
              </Button>
            </div>
          )}

          {connection.status === 'connected' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs text-text-muted">Last Sync</span>
                  <p className="font-mono text-text-primary">
                    {connection.lastSyncAt
                      ? formatTime(connection.lastSyncAt)
                      : '--'}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-text-muted">
                    Session Expires
                  </span>
                  <p className="font-mono text-text-primary">
                    {connection.sessionExpiresAt
                      ? getTimeUntilExpiry(connection.sessionExpiresAt)
                      : '--'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  Refresh Session
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDisconnect}
                >
                  Disconnect
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sub-Accounts Card */}
      {connection.status === 'connected' && (
        <Card>
          <CardHeader>
            <CardTitle>Sub-Accounts</CardTitle>
            <CardDescription>
              Select the active account for trading. IBKR master accounts can
              contain multiple sub-accounts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <p className="text-sm text-text-muted">
                No sub-accounts found. This may indicate a single-account setup.
              </p>
            ) : (
              <div className="space-y-2">
                {accounts.map((account) => (
                  <div
                    key={account.accountId}
                    className={cn(
                      'flex items-center justify-between rounded-lg border p-3 transition-colors',
                      activeAccountId === account.accountId
                        ? 'border-accent bg-accent/5'
                        : 'border-border hover:border-border/80',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleSwitchAccount(account.accountId)}
                        className={cn(
                          'h-4 w-4 rounded-full border-2 transition-colors',
                          activeAccountId === account.accountId
                            ? 'border-accent bg-accent'
                            : 'border-text-muted',
                        )}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          {editingAlias === account.accountId ? (
                            <div className="flex items-center gap-1">
                              <Input
                                variant="monospace"
                                value={aliasValue}
                                onChange={(e) => setAliasValue(e.target.value)}
                                className="h-6 w-32 text-xs"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter')
                                    handleSaveAlias(account.accountId)
                                  if (e.key === 'Escape')
                                    setEditingAlias(null)
                                }}
                                autoFocus
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleSaveAlias(account.accountId)
                                }
                                className="h-6 px-1 text-xs"
                              >
                                Save
                              </Button>
                            </div>
                          ) : (
                            <>
                              <span className="text-sm font-medium text-text-primary">
                                {account.alias || account.displayName}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingAlias(account.accountId)
                                  setAliasValue(account.alias || '')
                                }}
                                className="text-xs text-text-muted hover:text-accent"
                              >
                                Edit
                              </button>
                            </>
                          )}
                        </div>
                        <span className="font-mono text-xs text-text-muted">
                          {account.accountId}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        {account.isPaper && (
                          <span className="rounded bg-warning/20 px-1.5 py-0.5 text-xs font-bold text-warning">
                            PAPER
                          </span>
                        )}
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-xs font-medium',
                            account.isActive
                              ? 'bg-trading-green/10 text-trading-green'
                              : 'bg-text-muted/10 text-text-muted',
                          )}
                        >
                          {account.type}
                        </span>
                      </div>

                      {/* Balance summary */}
                      {accountBalances[account.accountId] && (
                        <div className="text-right">
                          <p className="font-mono text-xs tabular-nums text-text-primary">
                            {formatCurrency(
                              accountBalances[account.accountId].equity,
                            )}
                          </p>
                          <p className="font-mono text-xs tabular-nums text-text-muted">
                            Margin:{' '}
                            {formatCurrency(
                              accountBalances[account.accountId].marginUsed,
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Connection Health */}
      {connection.status === 'connected' && (
        <Card>
          <CardHeader>
            <CardTitle>Connection Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-text-muted">Gateway</span>
                <span className="text-sm font-medium text-trading-green">
                  Connected
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-text-muted">WebSocket</span>
                <span className="text-sm font-medium text-trading-green">
                  Active
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-text-muted">Market Data</span>
                <span className="text-sm font-medium text-trading-green">
                  Streaming
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>About IBKR Integration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-text-secondary">
          <p>
            Interactive Brokers integration uses the Client Portal API gateway
            running locally on your machine. This provides secure access to
            your IBKR accounts without sharing your credentials with our
            servers.
          </p>
          <p>
            Sessions expire approximately every 24 hours. You will need to
            re-authenticate through the Client Portal when your session
            expires.
          </p>
          <ul className="list-inside list-disc space-y-1 text-text-muted">
            <li>Multi-account support (master + sub-accounts)</li>
            <li>Bracket orders (entry + take profit + stop loss)</li>
            <li>OCA orders (One-Cancels-All groups)</li>
            <li>Conditional orders (price, time, margin triggers)</li>
            <li>Options trading with contract resolution</li>
            <li>Real-time order status via WebSocket</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
