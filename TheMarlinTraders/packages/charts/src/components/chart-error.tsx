'use client'

export interface ChartErrorProps {
  error: Error | string
  onRetry?: () => void
  className?: string
}

export function ChartError({ error, onRetry, className }: ChartErrorProps) {
  const message = typeof error === 'string' ? error : error.message

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        background: '#0f0f1a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        color: '#94a3b8',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ef4444"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div style={{ fontSize: 14, fontWeight: 500, color: '#f8fafc' }}>
        Failed to load chart data
      </div>
      <div style={{ fontSize: 12, maxWidth: 300, textAlign: 'center', opacity: 0.7 }}>
        {message}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            marginTop: 8,
            padding: '8px 20px',
            fontSize: 13,
            fontWeight: 500,
            color: '#f8fafc',
            background: '#3b82f6',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      )}
    </div>
  )
}
