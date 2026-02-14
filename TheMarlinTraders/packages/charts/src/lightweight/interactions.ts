import type { IChartApi } from 'lightweight-charts'

export function setupInteractions(chart: IChartApi, container: HTMLElement): () => void {
  // Double-click to reset view (fit all data)
  const handleDblClick = () => {
    chart.timeScale().fitContent()
  }

  container.addEventListener('dblclick', handleDblClick)

  return () => {
    container.removeEventListener('dblclick', handleDblClick)
  }
}
