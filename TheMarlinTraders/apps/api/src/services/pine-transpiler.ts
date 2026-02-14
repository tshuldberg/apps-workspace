/**
 * Pine Script v5 to TypeScript Transpiler
 * Sprints 47-48: Visual Builder + Python Interop + Pine Script Import
 *
 * Converts Pine Script v5 code into TypeScript strategy code that
 * conforms to TheMarlinTraders strategy API. Handles core Pine
 * constructs with graceful degradation for unsupported features.
 *
 * Target: 60-70% compatibility with typical Pine v5 strategies.
 */

// ── Result Types ────────────────────────────────────────────────────────────

export interface TranspileResult {
  /** Generated TypeScript code. */
  code: string
  /** Warnings about unsupported or partially supported constructs. */
  warnings: TranspileWarning[]
  /** Percentage of source lines successfully transpiled (0-100). */
  compatibility: number
}

export interface TranspileWarning {
  line: number
  column: number
  message: string
  severity: 'info' | 'warning' | 'error'
  originalCode: string
}

// ── Token Types ─────────────────────────────────────────────────────────────

interface SourceLine {
  num: number
  raw: string
  trimmed: string
}

// ── Built-in Function Mappings ──────────────────────────────────────────────

const TA_FUNCTION_MAP: Record<string, { fn: string; transform: (args: string) => string }> = {
  'ta.sma': {
    fn: 'indicators.sma',
    transform: (args) => reorderTaArgs(args, ['source', 'period']),
  },
  'ta.ema': {
    fn: 'indicators.ema',
    transform: (args) => reorderTaArgs(args, ['source', 'period']),
  },
  'ta.rsi': {
    fn: 'indicators.rsi',
    transform: (args) => reorderTaArgs(args, ['source', 'period']),
  },
  'ta.atr': {
    fn: 'indicators.atr',
    transform: (args) => args,
  },
  'ta.crossover': {
    fn: 'context.crossOver',
    transform: (args) => args,
  },
  'ta.crossunder': {
    fn: 'context.crossUnder',
    transform: (args) => args,
  },
  'ta.macd': {
    fn: 'indicators.macd',
    transform: (args) => args,
  },
  'ta.bb': {
    fn: 'indicators.bollinger',
    transform: (args) => args,
  },
  'ta.highest': {
    fn: 'context.highest',
    transform: (args) => args,
  },
  'ta.lowest': {
    fn: 'context.lowest',
    transform: (args) => args,
  },
  'ta.change': {
    fn: 'context.change',
    transform: (args) => args,
  },
  'ta.stoch': {
    fn: 'indicators.stochastic',
    transform: (args) => args,
  },
  'ta.wma': {
    fn: 'indicators.wma',
    transform: (args) => reorderTaArgs(args, ['source', 'period']),
  },
  'ta.vwma': {
    fn: 'indicators.vwma',
    transform: (args) => reorderTaArgs(args, ['source', 'period']),
  },
}

const INPUT_FUNCTION_MAP: Record<string, string> = {
  'input.int': 'params.int',
  'input.float': 'params.float',
  'input.bool': 'params.bool',
  'input.string': 'params.string',
  'input': 'params.get',
}

const STRATEGY_ENTRY_MAP: Record<string, { fn: string; transform: (args: string) => string }> = {
  'strategy.entry': {
    fn: '_strategyEntry',
    transform: (args) => args,
  },
  'strategy.close': {
    fn: 'closePosition',
    transform: (args) => args,
  },
  'strategy.exit': {
    fn: '_strategyExit',
    transform: (args) => args,
  },
  'strategy.cancel': {
    fn: '/* strategy.cancel */ // ',
    transform: (args) => args,
  },
  'strategy.cancel_all': {
    fn: '/* strategy.cancel_all */ // ',
    transform: (args) => args,
  },
}

// Visual/decorative functions that produce no backtest effect
const IGNORED_FUNCTIONS = new Set([
  'plot', 'plotshape', 'plotchar', 'plotarrow', 'plotbar', 'plotcandle',
  'bgcolor', 'barcolor', 'fill', 'hline', 'label.new', 'line.new',
  'table.new', 'table.cell', 'box.new', 'alert', 'alertcondition',
  'log.info', 'log.warning', 'log.error',
])

// Pine Script built-in variables → TypeScript equivalents
const VARIABLE_MAP: Record<string, string> = {
  'close': 'bar.close',
  'open': 'bar.open',
  'high': 'bar.high',
  'low': 'bar.low',
  'volume': 'bar.volume',
  'hl2': '(bar.high + bar.low) / 2',
  'hlc3': '(bar.high + bar.low + bar.close) / 3',
  'ohlc4': '(bar.open + bar.high + bar.low + bar.close) / 4',
  'bar_index': 'context.barIndex',
  'time': 'bar.timestamp',
  'na': 'NaN',
  'true': 'true',
  'false': 'false',
  'strategy.position_size': 'position()?.quantity ?? 0',
  'strategy.position_avg_price': 'position()?.avgPrice ?? 0',
  'strategy.equity': 'context.equity',
  'strategy.initial_capital': 'context.initialCapital',
  'strategy.long': '"long"',
  'strategy.short': '"short"',
  'math.abs': 'Math.abs',
  'math.max': 'Math.max',
  'math.min': 'Math.min',
  'math.round': 'Math.round',
  'math.floor': 'Math.floor',
  'math.ceil': 'Math.ceil',
  'math.sqrt': 'Math.sqrt',
  'math.pow': 'Math.pow',
  'math.log': 'Math.log',
  'math.log10': 'Math.log10',
  'math.pi': 'Math.PI',
  'nz': '_nz',
}

// ── Main Transpiler ─────────────────────────────────────────────────────────

/**
 * Transpile Pine Script v5 source code to TypeScript strategy code.
 *
 * @param code - Raw Pine Script v5 source code
 * @returns TranspileResult with generated code, warnings, and compatibility score
 */
export function transpilePineScript(code: string): TranspileResult {
  const warnings: TranspileWarning[] = []
  const sourceLines = parseSourceLines(code)
  const transpiled: string[] = []
  let successfulLines = 0
  let totalNonEmptyLines = 0

  // ── Preamble ──────────────────────────────────────────────────────────
  transpiled.push('// Auto-generated from Pine Script v5')
  transpiled.push('// Transpiled by TheMarlinTraders Pine Transpiler')
  transpiled.push('')
  transpiled.push('// ── Helper: Replace NaN/undefined with default ──')
  transpiled.push('function _nz(value: number, replacement: number = 0): number {')
  transpiled.push('  return Number.isNaN(value) || value === undefined ? replacement : value')
  transpiled.push('}')
  transpiled.push('')

  // Parse for strategy() declaration to extract metadata
  const strategyMeta = extractStrategyMeta(sourceLines, warnings)
  if (strategyMeta) {
    transpiled.push(`// Strategy: ${strategyMeta.title}`)
    if (strategyMeta.overlay !== undefined) {
      transpiled.push(`// Overlay: ${strategyMeta.overlay}`)
    }
    transpiled.push('')
  }

  // Collect input parameters
  const inputs = extractInputParameters(sourceLines, warnings)
  if (inputs.length > 0) {
    transpiled.push('// ── Parameters ──')
    for (const input of inputs) {
      transpiled.push(input.tsCode)
    }
    transpiled.push('')
  }

  // Open the onBar function
  transpiled.push('export function onBar(bar: Bar, indicators: Indicators, context: Context) {')

  // ── Variable declarations (state) ─────────────────────────────────────
  const stateVars = extractStateVariables(sourceLines, warnings)
  if (stateVars.length > 0) {
    transpiled.push('  // ── State Variables ──')
    for (const v of stateVars) {
      transpiled.push(`  ${v.tsCode}`)
    }
    transpiled.push('')
  }

  // ── Process body lines ────────────────────────────────────────────────
  let indentLevel = 1
  let skipUntilEndif = false
  const insideIndicatorDecl = false

  for (const line of sourceLines) {
    const { num, trimmed } = line

    // Skip empty lines, comments, and version/strategy declarations
    if (trimmed === '' || trimmed.startsWith('//')) {
      if (trimmed.startsWith('//')) {
        transpiled.push(`${indent(indentLevel)}${trimmed}`)
      }
      continue
    }

    totalNonEmptyLines++

    // Skip //@version= and indicator() and strategy() declarations (already processed)
    if (
      trimmed.startsWith('//@version') ||
      trimmed.startsWith('indicator(') ||
      trimmed.startsWith('strategy(')
    ) {
      successfulLines++
      continue
    }

    // Skip input declarations (already processed above)
    if (isInputDeclaration(trimmed)) {
      successfulLines++
      continue
    }

    // Skip var/varip declarations (already processed above)
    if (isStateVarDeclaration(trimmed)) {
      successfulLines++
      continue
    }

    // ── Ignored visual functions ──
    if (isIgnoredFunction(trimmed)) {
      transpiled.push(`${indent(indentLevel)}// [visual] ${trimmed}`)
      successfulLines++
      continue
    }

    // ── If / else / else if blocks ──
    if (trimmed.startsWith('if ')) {
      const condition = transpileExpression(trimmed.slice(3).trim(), num, warnings)
      transpiled.push(`${indent(indentLevel)}if (${condition}) {`)
      indentLevel++
      successfulLines++
      continue
    }

    if (trimmed === 'else') {
      indentLevel = Math.max(1, indentLevel - 1)
      transpiled.push(`${indent(indentLevel)}} else {`)
      indentLevel++
      successfulLines++
      continue
    }

    if (trimmed.startsWith('else if ')) {
      indentLevel = Math.max(1, indentLevel - 1)
      const condition = transpileExpression(trimmed.slice(8).trim(), num, warnings)
      transpiled.push(`${indent(indentLevel)}} else if (${condition}) {`)
      indentLevel++
      successfulLines++
      continue
    }

    // ── For loops ──
    if (trimmed.startsWith('for ')) {
      const forResult = transpileForLoop(trimmed, num, warnings)
      if (forResult) {
        transpiled.push(`${indent(indentLevel)}${forResult}`)
        indentLevel++
        successfulLines++
      } else {
        addUnsupported(transpiled, indentLevel, trimmed, num, warnings)
      }
      continue
    }

    // ── While loops ──
    if (trimmed.startsWith('while ')) {
      const condition = transpileExpression(trimmed.slice(6).trim(), num, warnings)
      transpiled.push(`${indent(indentLevel)}while (${condition}) {`)
      indentLevel++
      successfulLines++
      continue
    }

    // ── Strategy entry/close/exit ──
    if (isStrategyCall(trimmed)) {
      const result = transpileStrategyCall(trimmed, num, warnings)
      if (result) {
        transpiled.push(`${indent(indentLevel)}${result}`)
        successfulLines++
      } else {
        addUnsupported(transpiled, indentLevel, trimmed, num, warnings)
      }
      continue
    }

    // ── Variable assignment / expression ──
    if (isAssignment(trimmed)) {
      const result = transpileAssignment(trimmed, num, warnings)
      if (result) {
        transpiled.push(`${indent(indentLevel)}${result}`)
        successfulLines++
      } else {
        addUnsupported(transpiled, indentLevel, trimmed, num, warnings)
      }
      continue
    }

    // ── General expression (function calls, etc.) ──
    const exprResult = transpileExpression(trimmed, num, warnings)
    if (exprResult && exprResult !== trimmed) {
      transpiled.push(`${indent(indentLevel)}${exprResult}`)
      successfulLines++
    } else {
      // Attempt one more pass: treat as general statement
      const generalResult = transpileGeneralStatement(trimmed, num, warnings)
      if (generalResult) {
        transpiled.push(`${indent(indentLevel)}${generalResult}`)
        successfulLines++
      } else {
        addUnsupported(transpiled, indentLevel, trimmed, num, warnings)
      }
    }
  }

  // Close any remaining blocks
  while (indentLevel > 1) {
    indentLevel--
    transpiled.push(`${indent(indentLevel)}}`)
  }

  transpiled.push('}')

  // ── Strategy helper functions ─────────────────────────────────────────
  transpiled.push('')
  transpiled.push('// ── Strategy Helpers ──')
  transpiled.push('')
  transpiled.push('function _strategyEntry(id: string, direction: string, qty?: number) {')
  transpiled.push('  if (direction === "long" || direction === strategy.long) {')
  transpiled.push('    buy(qty ?? 100)')
  transpiled.push('  } else {')
  transpiled.push('    sell(qty ?? 100)')
  transpiled.push('  }')
  transpiled.push('}')
  transpiled.push('')
  transpiled.push('function _strategyExit(id: string, fromId?: string, opts?: {')
  transpiled.push('  stop?: number')
  transpiled.push('  limit?: number')
  transpiled.push('  trailPoints?: number')
  transpiled.push('  trailOffset?: number')
  transpiled.push('}) {')
  transpiled.push('  if (opts?.stop) setStop(opts.stop)')
  transpiled.push('  if (opts?.limit) setTakeProfit(opts.limit)')
  transpiled.push('  if (opts?.trailPoints) setTrailingStop(opts.trailPoints)')
  transpiled.push('}')

  // ── Compute compatibility ─────────────────────────────────────────────
  const compatibility = totalNonEmptyLines > 0
    ? Math.round((successfulLines / totalNonEmptyLines) * 100)
    : 100

  return {
    code: transpiled.join('\n'),
    warnings,
    compatibility,
  }
}

// ── Source Parsing ───────────────────────────────────────────────────────────

function parseSourceLines(code: string): SourceLine[] {
  return code.split('\n').map((raw, i) => ({
    num: i + 1,
    raw,
    trimmed: raw.trim(),
  }))
}

// ── Strategy Metadata Extraction ────────────────────────────────────────────

interface StrategyMeta {
  title: string
  overlay?: boolean
  defaultQty?: number
}

function extractStrategyMeta(lines: SourceLine[], warnings: TranspileWarning[]): StrategyMeta | null {
  for (const line of lines) {
    if (line.trimmed.startsWith('strategy(')) {
      const argsStr = extractFunctionArgs(line.trimmed, 'strategy')
      if (!argsStr) continue

      const title = extractStringArg(argsStr, 0) ?? 'Untitled Strategy'
      const overlay = extractNamedBoolArg(argsStr, 'overlay')
      const defaultQty = extractNamedNumberArg(argsStr, 'default_qty_value')

      return { title, overlay, defaultQty }
    }
  }
  return null
}

// ── Input Parameter Extraction ──────────────────────────────────────────────

interface InputParam {
  name: string
  tsCode: string
}

function extractInputParameters(lines: SourceLine[], warnings: TranspileWarning[]): InputParam[] {
  const params: InputParam[] = []

  for (const line of lines) {
    if (!isInputDeclaration(line.trimmed)) continue

    const match = line.trimmed.match(/^(\w+)\s*=\s*input\.(int|float|bool|string|source)?\s*\((.+)\)$/) ??
                  line.trimmed.match(/^(\w+)\s*=\s*input\s*\((.+)\)$/)

    if (!match) {
      warnings.push({
        line: line.num,
        column: 0,
        message: `Could not parse input declaration`,
        severity: 'warning',
        originalCode: line.trimmed,
      })
      continue
    }

    const varName = match[1]!
    const argsStr = match[match.length - 1]!

    // Extract default value
    const defaultVal = extractDefaultValue(argsStr)
    const title = extractStringArg(argsStr, -1, 'title')

    const comment = title ? ` // ${title}` : ''
    params.push({
      name: varName,
      tsCode: `const ${varName} = ${defaultVal}${comment}`,
    })
  }

  return params
}

function isInputDeclaration(line: string): boolean {
  return /^\w+\s*=\s*input(\.\w+)?\s*\(/.test(line)
}

// ── State Variable Extraction ───────────────────────────────────────────────

interface StateVar {
  name: string
  tsCode: string
}

function extractStateVariables(lines: SourceLine[], warnings: TranspileWarning[]): StateVar[] {
  const vars: StateVar[] = []

  for (const line of lines) {
    if (!isStateVarDeclaration(line.trimmed)) continue

    const match = line.trimmed.match(/^(var|varip)\s+(\w+)\s*=\s*(.+)$/)
    if (!match) continue

    const keyword = match[1]!
    const name = match[2]!
    const initExpr = transpileExpression(match[3]!.trim(), line.num, warnings)

    if (keyword === 'varip') {
      warnings.push({
        line: line.num,
        column: 0,
        message: `'varip' (realtime persistence) is treated as 'var' (bar persistence)`,
        severity: 'info',
        originalCode: line.trimmed,
      })
    }

    vars.push({
      name,
      tsCode: `let ${name} = ${initExpr}`,
    })
  }

  return vars
}

function isStateVarDeclaration(line: string): boolean {
  return /^(var|varip)\s+\w+\s*=/.test(line)
}

// ── Expression Transpilation ────────────────────────────────────────────────

function transpileExpression(expr: string, lineNum: number, warnings: TranspileWarning[]): string {
  let result = expr

  // Replace Pine ternary: condition ? a : b (same syntax in TS, but Pine also uses iff)
  // Pine ternary is identical to JS/TS, so no change needed

  // Replace `and` / `or` / `not` operators
  result = result.replace(/\band\b/g, '&&')
  result = result.replace(/\bor\b/g, '||')
  result = result.replace(/\bnot\b/g, '!')

  // Replace `:=` (Pine reassignment) with `=`
  result = result.replace(/:=/g, '=')

  // Replace ta.* function calls
  for (const [pineFunc, mapping] of Object.entries(TA_FUNCTION_MAP)) {
    const pattern = new RegExp(escapeRegExp(pineFunc) + '\\s*\\(', 'g')
    if (pattern.test(result)) {
      result = result.replace(
        new RegExp(escapeRegExp(pineFunc) + '\\s*\\(([^)]*(?:\\([^)]*\\)[^)]*)*)\\)', 'g'),
        (_, args: string) => `${mapping.fn}(${mapping.transform(args.trim())})`,
      )
    }
  }

  // Replace strategy.* calls
  for (const [pineFunc, mapping] of Object.entries(STRATEGY_ENTRY_MAP)) {
    const pattern = new RegExp(escapeRegExp(pineFunc) + '\\s*\\(', 'g')
    if (pattern.test(result)) {
      result = result.replace(
        new RegExp(escapeRegExp(pineFunc) + '\\s*\\(([^)]*(?:\\([^)]*\\)[^)]*)*)\\)', 'g'),
        (_, args: string) => `${mapping.fn}(${mapping.transform(args.trim())})`,
      )
    }
  }

  // Replace known built-in variables
  for (const [pineVar, tsVar] of Object.entries(VARIABLE_MAP)) {
    // Word-boundary match to avoid partial replacements
    const varPattern = new RegExp(`(?<![.\\w])${escapeRegExp(pineVar)}(?!\\w)`, 'g')
    result = result.replace(varPattern, tsVar)
  }

  // Replace history reference: close[n] → context.history('close', n)
  result = result.replace(
    /\b(close|open|high|low|volume)\[(\d+)\]/g,
    (_, field: string, offset: string) => `context.history('${field}', ${offset})`,
  )

  // Replace color literals (Pine uses color.red, etc.)
  result = result.replace(/\bcolor\.\w+/g, (match) => `"${match}"`)

  // Replace na() function
  result = result.replace(/\bna\(([^)]+)\)/g, 'Number.isNaN($1)')

  return result
}

// ── Assignment Transpilation ────────────────────────────────────────────────

function isAssignment(line: string): boolean {
  // Standard assignment: name = expr
  // Reassignment: name := expr
  // Type-annotated: name = type(expr)
  return /^\w+\s*(:?=)\s*.+/.test(line) && !line.startsWith('if ') && !line.startsWith('for ')
}

function transpileAssignment(line: string, lineNum: number, warnings: TranspileWarning[]): string | null {
  // Handle := (reassignment)
  if (line.includes(':=')) {
    const match = line.match(/^(\w+)\s*:=\s*(.+)$/)
    if (!match) return null
    const name = match[1]!
    const expr = transpileExpression(match[2]!.trim(), lineNum, warnings)
    return `${name} = ${expr}`
  }

  // Handle = (initial assignment)
  const match = line.match(/^(\w+)\s*=\s*(.+)$/)
  if (!match) return null
  const name = match[1]!
  const rawExpr = match[2]!.trim()

  // Check for Pine type annotations: int x = 5, float y = 3.14
  const typeMatch = rawExpr.match(/^(int|float|bool|string|color)\s*\((.+)\)$/)
  if (typeMatch) {
    const expr = transpileExpression(typeMatch[2]!.trim(), lineNum, warnings)
    return `const ${name} = ${expr}`
  }

  const expr = transpileExpression(rawExpr, lineNum, warnings)
  return `const ${name} = ${expr}`
}

// ── Strategy Call Transpilation ──────────────────────────────────────────────

function isStrategyCall(line: string): boolean {
  return /^strategy\.(entry|close|exit|cancel|cancel_all)\s*\(/.test(line)
}

function transpileStrategyCall(line: string, lineNum: number, warnings: TranspileWarning[]): string | null {
  // Match strategy.entry("id", strategy.long, qty=10)
  const entryMatch = line.match(/^strategy\.entry\s*\((.+)\)$/)
  if (entryMatch) {
    const args = parseNamedArgs(entryMatch[1]!)
    const id = args[0] ?? '"entry"'
    const direction = transpileExpression(args[1] ?? 'strategy.long', lineNum, warnings)
    const qty = findNamedArg(args, 'qty') ?? findNamedArg(args, 'quantity')
    const qtyStr = qty ? `, ${transpileExpression(qty, lineNum, warnings)}` : ''
    return `_strategyEntry(${id}, ${direction}${qtyStr})`
  }

  // Match strategy.close("id")
  const closeMatch = line.match(/^strategy\.close\s*\((.+)\)$/)
  if (closeMatch) {
    return `closePosition()`
  }

  // Match strategy.exit("id", "from_entry", stop=x, limit=y)
  const exitMatch = line.match(/^strategy\.exit\s*\((.+)\)$/)
  if (exitMatch) {
    const args = parseNamedArgs(exitMatch[1]!)
    const id = args[0] ?? '"exit"'
    const fromId = args[1] ?? '""'

    const stopArg = findNamedArg(args, 'stop')
    const limitArg = findNamedArg(args, 'limit')
    const trailPointsArg = findNamedArg(args, 'trail_points')
    const trailOffsetArg = findNamedArg(args, 'trail_offset')

    const opts: string[] = []
    if (stopArg) opts.push(`stop: ${transpileExpression(stopArg, lineNum, warnings)}`)
    if (limitArg) opts.push(`limit: ${transpileExpression(limitArg, lineNum, warnings)}`)
    if (trailPointsArg) opts.push(`trailPoints: ${transpileExpression(trailPointsArg, lineNum, warnings)}`)
    if (trailOffsetArg) opts.push(`trailOffset: ${transpileExpression(trailOffsetArg, lineNum, warnings)}`)

    const optsStr = opts.length > 0 ? `, { ${opts.join(', ')} }` : ''
    return `_strategyExit(${id}, ${fromId}${optsStr})`
  }

  return null
}

// ── For Loop Transpilation ──────────────────────────────────────────────────

function transpileForLoop(line: string, lineNum: number, warnings: TranspileWarning[]): string | null {
  // for i = start to end [by step]
  const match = line.match(/^for\s+(\w+)\s*=\s*(.+?)\s+to\s+(.+?)(?:\s+by\s+(.+))?$/)
  if (!match) return null

  const varName = match[1]!
  const start = transpileExpression(match[2]!.trim(), lineNum, warnings)
  const end = transpileExpression(match[3]!.trim(), lineNum, warnings)
  const step = match[4] ? transpileExpression(match[4].trim(), lineNum, warnings) : '1'

  return `for (let ${varName} = ${start}; ${varName} <= ${end}; ${varName} += ${step}) {`
}

// ── Ignored Functions ───────────────────────────────────────────────────────

function isIgnoredFunction(line: string): boolean {
  for (const fn of IGNORED_FUNCTIONS) {
    if (line.startsWith(`${fn}(`) || line.startsWith(`${fn} (`)) {
      return true
    }
  }
  return false
}

// ── General Statement ───────────────────────────────────────────────────────

function transpileGeneralStatement(line: string, lineNum: number, warnings: TranspileWarning[]): string | null {
  // Try as a function call
  const callMatch = line.match(/^(\w+(?:\.\w+)*)\s*\((.+)\)$/)
  if (callMatch) {
    const fn = callMatch[1]!
    const args = callMatch[2]!

    // Check if it's a known ta function
    if (TA_FUNCTION_MAP[fn]) {
      const mapping = TA_FUNCTION_MAP[fn]!
      return `${mapping.fn}(${mapping.transform(args)})`
    }

    // Check if it's a known strategy function
    if (STRATEGY_ENTRY_MAP[fn]) {
      return transpileStrategyCall(line, lineNum, warnings)
    }

    // Check if it's ignored
    if (isIgnoredFunction(line)) {
      return `// [visual] ${line}`
    }

    // Generic function call — pass through with expression transform
    const transArgs = transpileExpression(args, lineNum, warnings)
    return `${fn}(${transArgs})`
  }

  return null
}

// ── Unsupported Line Handler ────────────────────────────────────────────────

function addUnsupported(
  output: string[],
  indentLevel: number,
  line: string,
  lineNum: number,
  warnings: TranspileWarning[],
): void {
  output.push(`${indent(indentLevel)}// UNSUPPORTED: ${line}`)
  warnings.push({
    line: lineNum,
    column: 0,
    message: `Unsupported construct: ${truncate(line, 80)}`,
    severity: 'warning',
    originalCode: line,
  })
}

// ── Argument Parsing Utilities ──────────────────────────────────────────────

function extractFunctionArgs(line: string, fnName: string): string | null {
  const idx = line.indexOf(`${fnName}(`)
  if (idx === -1) return null
  const start = idx + fnName.length + 1
  const end = findMatchingParen(line, start - 1)
  if (end === -1) return null
  return line.slice(start, end)
}

function findMatchingParen(str: string, openPos: number): number {
  let depth = 0
  let inString = false
  let stringChar = ''

  for (let i = openPos; i < str.length; i++) {
    const ch = str[i]!
    if (inString) {
      if (ch === stringChar && str[i - 1] !== '\\') {
        inString = false
      }
      continue
    }
    if (ch === '"' || ch === "'") {
      inString = true
      stringChar = ch
      continue
    }
    if (ch === '(') depth++
    if (ch === ')') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function extractStringArg(argsStr: string, index: number, namedKey?: string): string | null {
  if (namedKey) {
    const match = argsStr.match(new RegExp(`${namedKey}\\s*=\\s*"([^"]*)"`, 'i'))
    return match ? match[1]! : null
  }

  const parts = splitArgs(argsStr)
  const part = parts[index]?.trim()
  if (!part) return null

  const match = part.match(/^["'](.+?)["']$/)
  return match ? match[1]! : null
}

function extractNamedBoolArg(argsStr: string, name: string): boolean | undefined {
  const match = argsStr.match(new RegExp(`${name}\\s*=\\s*(true|false)`, 'i'))
  return match ? match[1]!.toLowerCase() === 'true' : undefined
}

function extractNamedNumberArg(argsStr: string, name: string): number | undefined {
  const match = argsStr.match(new RegExp(`${name}\\s*=\\s*([\\d.]+)`))
  return match ? parseFloat(match[1]!) : undefined
}

function extractDefaultValue(argsStr: string): string {
  // Try named: defval=X
  const namedMatch = argsStr.match(/defval\s*=\s*([^,)]+)/)
  if (namedMatch) return namedMatch[1]!.trim()

  // First positional arg
  const parts = splitArgs(argsStr)
  return parts[0]?.trim() ?? '0'
}

function parseNamedArgs(argsStr: string): string[] {
  return splitArgs(argsStr).map((a) => a.trim())
}

function findNamedArg(args: string[], name: string): string | null {
  for (const arg of args) {
    const match = arg.match(new RegExp(`^${name}\\s*=\\s*(.+)$`))
    if (match) return match[1]!.trim()
  }
  return null
}

function splitArgs(argsStr: string): string[] {
  const result: string[] = []
  let current = ''
  let depth = 0
  let inString = false
  let stringChar = ''

  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i]!
    if (inString) {
      current += ch
      if (ch === stringChar && argsStr[i - 1] !== '\\') {
        inString = false
      }
      continue
    }
    if (ch === '"' || ch === "'") {
      inString = true
      stringChar = ch
      current += ch
      continue
    }
    if (ch === '(' || ch === '[') {
      depth++
      current += ch
      continue
    }
    if (ch === ')' || ch === ']') {
      depth--
      current += ch
      continue
    }
    if (ch === ',' && depth === 0) {
      result.push(current)
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim()) {
    result.push(current)
  }
  return result
}

function reorderTaArgs(args: string, paramNames: string[]): string {
  // Pine ta.sma(source, period) → indicators.sma(period, source)
  // We need to handle both positional and named args
  const parts = splitArgs(args)
  if (parts.length < 2) return args

  // Check for named args
  const hasNamed = parts.some((p) => p.includes('='))
  if (hasNamed) return args // Named args don't need reordering

  // For positional args: swap source and period (Pine is source, period; TS is period, source)
  if (paramNames[0] === 'source' && paramNames[1] === 'period') {
    return `${parts[1]!.trim()}, '${mapSourceArg(parts[0]!.trim())}'`
  }

  return args
}

function mapSourceArg(pineSource: string): string {
  // Map Pine source references to our string keys
  const sourceMap: Record<string, string> = {
    'close': 'close',
    'open': 'open',
    'high': 'high',
    'low': 'low',
    'hl2': 'hl2',
    'hlc3': 'hlc3',
    'ohlc4': 'ohlc4',
    'bar.close': 'close',
    'bar.open': 'open',
    'bar.high': 'high',
    'bar.low': 'low',
  }
  return sourceMap[pineSource] ?? 'close'
}

// ── Utility Helpers ─────────────────────────────────────────────────────────

function indent(level: number): string {
  return '  '.repeat(level)
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen - 3) + '...' : str
}
