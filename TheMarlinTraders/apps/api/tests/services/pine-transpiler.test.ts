import { describe, it, expect } from 'vitest'
import { transpilePineScript } from '../../src/services/pine-transpiler.js'
import type { TranspileResult } from '../../src/services/pine-transpiler.js'

// ── Helpers ─────────────────────────────────────────────────────────────────

function expectNoErrors(result: TranspileResult) {
  const errors = result.warnings.filter((w) => w.severity === 'error')
  expect(errors).toHaveLength(0)
}

function expectCodeContains(result: TranspileResult, fragment: string) {
  expect(result.code).toContain(fragment)
}

function expectCodeDoesNotContain(result: TranspileResult, fragment: string) {
  expect(result.code).not.toContain(fragment)
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('transpilePineScript', () => {
  // ── Variable Declarations ───────────────────────────────────────────────

  describe('variable declarations', () => {
    it('transpiles simple assignment', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
myVar = 42
`)
      expectNoErrors(result)
      expectCodeContains(result, 'const myVar = 42')
    })

    it('transpiles var (state) declarations', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
var counter = 0
`)
      expectNoErrors(result)
      expectCodeContains(result, 'let counter = 0')
    })

    it('transpiles varip as var with info warning', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
varip myState = 0
`)
      expectCodeContains(result, 'let myState = 0')
      const infoWarnings = result.warnings.filter((w) => w.severity === 'info')
      expect(infoWarnings.length).toBeGreaterThanOrEqual(1)
      expect(infoWarnings.some((w) => w.message.includes('varip'))).toBe(true)
    })

    it('transpiles reassignment operator :=', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
var x = 0
x := x + 1
`)
      expectCodeContains(result, 'x = x + 1')
      // Should not have const for reassignment
      expect(result.code).not.toMatch(/const x = x \+ 1/)
    })
  })

  // ── Built-in Function Mappings ──────────────────────────────────────────

  describe('ta.sma() mapping', () => {
    it('maps ta.sma(close, 20) to indicators.sma(20, \'close\')', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
ma = ta.sma(close, 20)
`)
      expectNoErrors(result)
      expectCodeContains(result, 'indicators.sma(20,')
    })

    it('maps ta.ema(close, 12) to indicators.ema(12, ...)', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
ema12 = ta.ema(close, 12)
`)
      expectCodeContains(result, 'indicators.ema(12,')
    })

    it('maps ta.rsi(close, 14) to indicators.rsi(14, ...)', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
rsiVal = ta.rsi(close, 14)
`)
      expectCodeContains(result, 'indicators.rsi(14,')
    })

    it('maps ta.atr(14) to indicators.atr(14)', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
atrVal = ta.atr(14)
`)
      expectCodeContains(result, 'indicators.atr(14)')
    })

    it('maps ta.crossover to context.crossOver', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
bull = ta.crossover(fastMA, slowMA)
`)
      expectCodeContains(result, 'context.crossOver(')
    })

    it('maps ta.crossunder to context.crossUnder', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
bear = ta.crossunder(fastMA, slowMA)
`)
      expectCodeContains(result, 'context.crossUnder(')
    })
  })

  // ── Strategy Entry/Close/Exit ──────────────────────────────────────────

  describe('strategy.entry() mapping', () => {
    it('transpiles strategy.entry for long', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
strategy.entry("Long", strategy.long)
`)
      expectCodeContains(result, '_strategyEntry("Long", "long"')
    })

    it('transpiles strategy.entry for short', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
strategy.entry("Short", strategy.short)
`)
      expectCodeContains(result, '_strategyEntry("Short", "short"')
    })

    it('transpiles strategy.close to closePosition', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
strategy.close("Long")
`)
      expectCodeContains(result, 'closePosition()')
    })

    it('transpiles strategy.exit with stop and limit', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
strategy.exit("Exit", "Long", stop=stopPrice, limit=targetPrice)
`)
      expectCodeContains(result, '_strategyExit(')
      expectCodeContains(result, 'stop:')
    })
  })

  // ── Unsupported Constructs ─────────────────────────────────────────────

  describe('unsupported constructs', () => {
    it('adds UNSUPPORTED comment for unknown constructs', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
array.new_float(10, 0)
`)
      expectCodeContains(result, '// UNSUPPORTED:')
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('comments out plot() calls', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
plot(close, "Price", color=color.blue)
`)
      expectCodeContains(result, '// [visual]')
      expectCodeDoesNotContain(result, '// UNSUPPORTED')
    })

    it('comments out plotshape() calls', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
plotshape(buySignal, "Buy", shape.triangleup, location.belowbar, color.green)
`)
      expectCodeContains(result, '// [visual]')
    })

    it('comments out bgcolor() calls', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
bgcolor(color.new(color.red, 90))
`)
      expectCodeContains(result, '// [visual]')
    })
  })

  // ── Compatibility Score ────────────────────────────────────────────────

  describe('compatibility score', () => {
    it('returns 100% for fully supported code', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
ma = ta.sma(close, 20)
`)
      expect(result.compatibility).toBe(100)
    })

    it('returns lower score when some lines are unsupported', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
ma = ta.sma(close, 20)
array.new_float(10, 0)
matrix.new<float>(3, 3)
`)
      expect(result.compatibility).toBeLessThan(100)
      expect(result.compatibility).toBeGreaterThan(0)
    })

    it('returns 100% for empty/comment-only scripts', () => {
      const result = transpilePineScript(`
// Just comments
// Nothing here
`)
      expect(result.compatibility).toBe(100)
    })
  })

  // ── Input Parameters ──────────────────────────────────────────────────

  describe('input parameters', () => {
    it('extracts input.int with default value', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
length = input.int(14, "RSI Length")
`)
      expectCodeContains(result, 'const length = 14')
    })

    it('extracts input.float with default value', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
threshold = input.float(2.0, "Multiplier")
`)
      expectCodeContains(result, 'const threshold = 2.0')
    })

    it('extracts input.bool with default value', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
useFilter = input.bool(true, "Use Filter")
`)
      expectCodeContains(result, 'const useFilter = true')
    })
  })

  // ── Boolean Operators ─────────────────────────────────────────────────

  describe('boolean operators', () => {
    it('replaces "and" with "&&"', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
both = condA and condB
`)
      expectCodeContains(result, '&&')
      expectCodeDoesNotContain(result, ' and ')
    })

    it('replaces "or" with "||"', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
either = condA or condB
`)
      expectCodeContains(result, '||')
    })

    it('replaces "not" with "!"', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
inverted = not condition
`)
      expectCodeContains(result, '!')
    })
  })

  // ── Built-in Variables ────────────────────────────────────────────────

  describe('built-in variable mapping', () => {
    it('maps close to bar.close', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
price = close
`)
      expectCodeContains(result, 'bar.close')
    })

    it('maps open/high/low to bar equivalents', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
o = open
h = high
l = low
`)
      expectCodeContains(result, 'bar.open')
      expectCodeContains(result, 'bar.high')
      expectCodeContains(result, 'bar.low')
    })

    it('maps volume to bar.volume', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
vol = volume
`)
      expectCodeContains(result, 'bar.volume')
    })

    it('maps strategy.position_size', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
posSize = strategy.position_size
`)
      expectCodeContains(result, 'position()')
    })
  })

  // ── If/Else Blocks ────────────────────────────────────────────────────

  describe('if/else blocks', () => {
    it('transpiles if statement', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
if condition
    strategy.entry("Long", strategy.long)
`)
      expectCodeContains(result, 'if (')
      expectCodeContains(result, ') {')
    })

    it('transpiles if/else', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
if condition
    strategy.entry("Long", strategy.long)
else
    strategy.close("Long")
`)
      expectCodeContains(result, '} else {')
    })
  })

  // ── Full Strategy Integration ─────────────────────────────────────────

  describe('full MA crossover strategy', () => {
    const FULL_PINE = `//@version=5
strategy("MA Crossover", overlay=true, default_qty_value=100)

fastLen = input.int(10, "Fast Length")
slowLen = input.int(30, "Slow Length")

fastMA = ta.sma(close, fastLen)
slowMA = ta.sma(close, slowLen)

longCondition = ta.crossover(fastMA, slowMA)
shortCondition = ta.crossunder(fastMA, slowMA)

if longCondition
    strategy.entry("Long", strategy.long)

if shortCondition
    strategy.close("Long")

plot(fastMA, "Fast MA", color=color.blue)
plot(slowMA, "Slow MA", color=color.red)
`

    it('produces valid TypeScript output', () => {
      const result = transpilePineScript(FULL_PINE)
      expectNoErrors(result)
      // Should have the onBar function
      expectCodeContains(result, 'export function onBar(')
      // Should have indicator calls
      expectCodeContains(result, 'indicators.sma(')
      // Should have crossover detection
      expectCodeContains(result, 'crossOver')
      // Should have strategy entry
      expectCodeContains(result, '_strategyEntry(')
      // Should have close
      expectCodeContains(result, 'closePosition()')
      // Plot should be commented out
      expectCodeContains(result, '// [visual]')
    })

    it('achieves >= 60% compatibility', () => {
      const result = transpilePineScript(FULL_PINE)
      expect(result.compatibility).toBeGreaterThanOrEqual(60)
    })

    it('extracts strategy metadata', () => {
      const result = transpilePineScript(FULL_PINE)
      expectCodeContains(result, 'MA Crossover')
    })

    it('extracts input parameters', () => {
      const result = transpilePineScript(FULL_PINE)
      expectCodeContains(result, 'const fastLen = 10')
      expectCodeContains(result, 'const slowLen = 30')
    })
  })

  // ── Edge Cases ────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles empty input gracefully', () => {
      const result = transpilePineScript('')
      expect(result.compatibility).toBe(100)
      expect(result.warnings).toHaveLength(0)
      expectCodeContains(result, 'onBar')
    })

    it('handles comments-only input', () => {
      const result = transpilePineScript(`
// This is a comment
// Another comment
`)
      expect(result.compatibility).toBe(100)
    })

    it('does not crash on deeply nested expressions', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
nested = ta.sma(ta.ema(close, 10), 20)
`)
      // Should not throw
      expect(result.code).toBeTruthy()
    })

    it('handles math operations', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
x = math.abs(-5)
y = math.max(a, b)
`)
      expectCodeContains(result, 'Math.abs')
      expectCodeContains(result, 'Math.max')
    })

    it('provides _nz helper function', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
`)
      expectCodeContains(result, 'function _nz(')
    })

    it('provides _strategyEntry and _strategyExit helpers', () => {
      const result = transpilePineScript(`
//@version=5
strategy("Test")
`)
      expectCodeContains(result, 'function _strategyEntry(')
      expectCodeContains(result, 'function _strategyExit(')
    })
  })
})
