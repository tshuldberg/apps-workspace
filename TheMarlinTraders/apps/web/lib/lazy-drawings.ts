import dynamic from 'next/dynamic'

/**
 * Dynamically imported DrawingToolbar component.
 * SSR is disabled since drawings interact with the Canvas chart.
 */
export const LazyDrawingToolbar = dynamic(
  () =>
    import('@marlin/ui/trading/drawing-toolbar').then((mod) => ({
      default: mod.DrawingToolbar,
    })),
  { ssr: false },
)
