'use client'

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        background: '#0f0f1a',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 4,
        padding: '20% 10%',
        overflow: 'hidden',
      }}
    >
      {SKELETON_BARS.map((bar, i) => (
        <div
          key={i}
          style={{
            width: '3%',
            height: `${bar}%`,
            background: '#1a1a2e',
            borderRadius: 2,
            animation: 'pulse 1.5s ease-in-out infinite',
            animationDelay: `${i * 80}ms`,
          }}
        />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  )
}

const SKELETON_BARS = [
  40, 55, 45, 60, 50, 70, 65, 75, 60, 55,
  65, 80, 70, 60, 50, 55, 65, 75, 85, 70,
  60, 50, 45, 55, 65,
]
