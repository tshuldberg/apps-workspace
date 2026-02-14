import { describe, it, expect } from 'vitest'
import { DEFAULT_CHART_OPTIONS } from '../src/lightweight/config.js'

describe('DEFAULT_CHART_OPTIONS', () => {
  it('uses dark theme background', () => {
    const layout = DEFAULT_CHART_OPTIONS.layout as Record<string, unknown>
    const bg = layout.background as Record<string, unknown>
    expect(bg.color).toBe('#0a0a0f')
  })

  it('sets text color to slate', () => {
    const layout = DEFAULT_CHART_OPTIONS.layout as Record<string, unknown>
    expect(layout.textColor).toBe('#94a3b8')
  })

  it('uses JetBrains Mono font family', () => {
    const layout = DEFAULT_CHART_OPTIONS.layout as Record<string, unknown>
    expect(layout.fontFamily).toContain('JetBrains Mono')
  })

  it('sets grid lines to navy-mid', () => {
    const grid = DEFAULT_CHART_OPTIONS.grid as Record<string, Record<string, unknown>>
    expect(grid.vertLines!.color).toBe('#1a1a2e')
    expect(grid.horzLines!.color).toBe('#1a1a2e')
  })

  it('sets crosshair color to accent blue', () => {
    const crosshair = DEFAULT_CHART_OPTIONS.crosshair as Record<string, Record<string, unknown>>
    expect(crosshair.vertLine!.color).toBe('#3b82f6')
    expect(crosshair.horzLine!.color).toBe('#3b82f6')
  })

  it('enables mouse wheel scroll and scale', () => {
    expect(DEFAULT_CHART_OPTIONS.handleScroll).toBeDefined()
    expect(DEFAULT_CHART_OPTIONS.handleScale).toBeDefined()
    const scroll = DEFAULT_CHART_OPTIONS.handleScroll as Record<string, unknown>
    const scale = DEFAULT_CHART_OPTIONS.handleScale as Record<string, unknown>
    expect(scroll.mouseWheel).toBe(true)
    expect(scale.mouseWheel).toBe(true)
    expect(scale.pinch).toBe(true)
  })

  it('enables time visibility on time scale', () => {
    const ts = DEFAULT_CHART_OPTIONS.timeScale as Record<string, unknown>
    expect(ts.timeVisible).toBe(true)
  })
})
