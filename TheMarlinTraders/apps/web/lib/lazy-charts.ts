import dynamic from 'next/dynamic'

/**
 * Dynamically imported MarlinChart component.
 * SSR is disabled since charts rely on Canvas/WebGL.
 * Uses an inline skeleton to avoid pulling @marlin/charts into the initial bundle.
 */
export const LazyMarlinChart = dynamic(
  () => import('@marlin/charts').then((mod) => ({ default: mod.MarlinChart })),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#0f0f1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            border: '2px solid #1a1a2e',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    ),
  },
)
