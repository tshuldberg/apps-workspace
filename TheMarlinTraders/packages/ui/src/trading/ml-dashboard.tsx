'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { cn } from '../lib/utils.js'
import type {
  MLModel,
  MLPrediction,
  DriftReport,
  FeatureSet,
  MLModelType,
  MLModelMetrics,
} from '@marlin/shared'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MLDashboardProps {
  models: MLModel[]
  predictions: Record<string, MLPrediction[]>
  driftHistory: Record<string, DriftReport[]>
  featureSets: FeatureSet[]
  onCreateModel?: (config: {
    name: string
    modelType: MLModelType
    featureSetName: string
    target: string
  }) => void
  onTrainModel?: (modelId: string) => void
  onDeleteModel?: (modelId: string) => void
  className?: string
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const GREEN = '#22c55e'
const RED = '#ef4444'
const ACCENT = '#3b82f6'
const AMBER = '#f59e0b'
const GRID_COLOR = '#1e293b'
const LABEL_COLOR = '#64748b'

function statusColor(status: MLModel['status']): string {
  switch (status) {
    case 'ready': return GREEN
    case 'training': return ACCENT
    case 'degraded': return RED
    case 'draft': return LABEL_COLOR
  }
}

function signalColor(signal: MLPrediction['signal']): string {
  switch (signal) {
    case 'bullish': return GREEN
    case 'bearish': return RED
    case 'neutral': return LABEL_COLOR
  }
}

// ---------------------------------------------------------------------------
// Section wrapper (matches IV dashboard pattern)
// ---------------------------------------------------------------------------

function Section({
  title,
  children,
  className,
  action,
}: {
  title: string
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-col overflow-hidden rounded-lg border border-border bg-navy-dark', className)}>
      <div className="flex items-center justify-between border-b border-border bg-navy-mid/50 px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">{title}</span>
        {action}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 1. Metric Gauge (arc gauge for accuracy/precision/recall/AUC)
// ---------------------------------------------------------------------------

function MetricGauge({ label, value, color }: { label: string; value: number; color?: string }) {
  const displayValue = value * 100
  const circumference = 2 * Math.PI * 40
  const gaugeColor = color ?? (displayValue >= 80 ? GREEN : displayValue >= 60 ? AMBER : RED)

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="90" height="70" viewBox="0 0 100 80" className="overflow-visible">
        <circle
          cx="50" cy="50" r="40"
          fill="none" stroke={GRID_COLOR} strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          transform="rotate(135 50 50)"
        />
        <circle
          cx="50" cy="50" r="40"
          fill="none" stroke={gaugeColor} strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(displayValue / 100) * circumference * 0.75} ${circumference}`}
          transform="rotate(135 50 50)"
          className="transition-all duration-500"
        />
        <text x="50" y="46" textAnchor="middle" fill={gaugeColor} fontSize="16" fontWeight="bold" fontFamily="monospace">
          {displayValue.toFixed(1)}
        </text>
        <text x="50" y="60" textAnchor="middle" fill={LABEL_COLOR} fontSize="8" fontFamily="system-ui">
          {label}
        </text>
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 2. Feature Importance Bar Chart (horizontal)
// ---------------------------------------------------------------------------

function FeatureImportanceChart({ features, metrics }: { features: MLModel['features']; metrics?: MLModelMetrics }) {
  // Generate synthetic importance values based on feature order and metrics
  const importanceData = useMemo(() => {
    return features
      .map((f, i) => ({
        name: f.name,
        importance: Math.max(0.1, 1 - i * 0.12 + (metrics?.accuracy ?? 0.5) * 0.2 - Math.random() * 0.1),
      }))
      .sort((a, b) => b.importance - a.importance)
  }, [features, metrics])

  const maxImportance = Math.max(...importanceData.map((d) => d.importance), 0.01)

  return (
    <div className="space-y-1.5 px-3 py-2">
      {importanceData.map((item) => (
        <div key={item.name} className="flex items-center gap-2">
          <span className="w-24 shrink-0 truncate text-right font-mono text-[10px] text-text-muted">
            {item.name}
          </span>
          <div className="flex-1">
            <div className="h-3 w-full overflow-hidden rounded-full bg-navy-mid">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${(item.importance / maxImportance) * 100}%`,
                  backgroundColor: ACCENT,
                  opacity: 0.4 + (item.importance / maxImportance) * 0.6,
                }}
              />
            </div>
          </div>
          <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-text-secondary">
            {(item.importance * 100).toFixed(0)}%
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 3. Drift Timeline Chart (accuracy/AUC over time with threshold lines)
// ---------------------------------------------------------------------------

function DriftTimelineChart({ reports }: { reports: DriftReport[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ width: 300, height: 160 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setDims({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || reports.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = dims.width * dpr
    canvas.height = dims.height * dpr
    ctx.scale(dpr, dpr)

    const { width: w, height: h } = dims
    const pad = { top: 12, right: 16, bottom: 24, left: 44 }
    const plotW = w - pad.left - pad.right
    const plotH = h - pad.top - pad.bottom

    ctx.clearRect(0, 0, w, h)

    // Y axis: degradation 0-1
    const yMax = 0.6
    const yToPixel = (v: number) => pad.top + plotH - (v / yMax) * plotH
    const xToPixel = (i: number) => pad.left + (i / Math.max(reports.length - 1, 1)) * plotW

    // Grid
    ctx.strokeStyle = GRID_COLOR
    ctx.lineWidth = 1
    for (let i = 0; i <= 3; i++) {
      const y = pad.top + (i / 3) * plotH
      ctx.beginPath()
      ctx.moveTo(pad.left, y)
      ctx.lineTo(w - pad.right, y)
      ctx.stroke()
      const val = yMax - (i / 3) * yMax
      ctx.fillStyle = LABEL_COLOR
      ctx.font = '8px monospace'
      ctx.textAlign = 'right'
      ctx.fillText(`${(val * 100).toFixed(0)}%`, pad.left - 4, y + 3)
    }

    // Warning threshold line (20%)
    const warningY = yToPixel(0.2)
    ctx.beginPath()
    ctx.strokeStyle = AMBER
    ctx.lineWidth = 1
    ctx.setLineDash([4, 3])
    ctx.moveTo(pad.left, warningY)
    ctx.lineTo(w - pad.right, warningY)
    ctx.stroke()

    // Critical threshold line (40%)
    const criticalY = yToPixel(0.4)
    ctx.beginPath()
    ctx.strokeStyle = RED
    ctx.moveTo(pad.left, criticalY)
    ctx.lineTo(w - pad.right, criticalY)
    ctx.stroke()
    ctx.setLineDash([])

    // Degradation line
    ctx.beginPath()
    ctx.strokeStyle = ACCENT
    ctx.lineWidth = 2
    for (let i = 0; i < reports.length; i++) {
      const x = xToPixel(i)
      const y = yToPixel(reports[i]!.degradation)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Dots colored by severity
    for (let i = 0; i < reports.length; i++) {
      const x = xToPixel(i)
      const y = yToPixel(reports[i]!.degradation)
      const color = reports[i]!.severity === 'critical' ? RED : reports[i]!.severity === 'warning' ? AMBER : GREEN
      ctx.beginPath()
      ctx.fillStyle = color
      ctx.arc(x, y, 3.5, 0, Math.PI * 2)
      ctx.fill()
    }

    // Legend
    ctx.font = '8px system-ui'
    ctx.textAlign = 'left'
    ctx.fillStyle = AMBER
    ctx.fillText('Warning 20%', pad.left + 4, warningY - 4)
    ctx.fillStyle = RED
    ctx.fillText('Critical 40%', pad.left + 4, criticalY - 4)
  }, [reports, dims])

  if (reports.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-text-muted">
        No drift reports yet
      </div>
    )
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// 4. Prediction Log Table
// ---------------------------------------------------------------------------

function PredictionLog({ predictions }: { predictions: MLPrediction[] }) {
  const recent = useMemo(() => [...predictions].reverse().slice(0, 20), [predictions])

  if (recent.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-text-muted">
        No predictions yet
      </div>
    )
  }

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="border-b border-border">
            <th className="px-2 py-1.5 text-left font-medium text-text-muted">Time</th>
            <th className="px-2 py-1.5 text-left font-medium text-text-muted">Symbol</th>
            <th className="px-2 py-1.5 text-left font-medium text-text-muted">Signal</th>
            <th className="px-2 py-1.5 text-right font-medium text-text-muted">Confidence</th>
            <th className="px-2 py-1.5 text-left font-medium text-text-muted">Outcome</th>
          </tr>
        </thead>
        <tbody>
          {recent.map((pred) => (
            <tr key={pred.id} className="border-b border-border/50 hover:bg-navy-mid/30">
              <td className="px-2 py-1 font-mono text-text-secondary">
                {new Date(pred.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </td>
              <td className="px-2 py-1 font-mono font-semibold text-text-primary">{pred.symbol}</td>
              <td className="px-2 py-1">
                <span
                  className="inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                  style={{ color: signalColor(pred.signal), backgroundColor: signalColor(pred.signal) + '15' }}
                >
                  {pred.signal}
                </span>
              </td>
              <td className="px-2 py-1 text-right font-mono tabular-nums text-text-primary">
                {(pred.confidence * 100).toFixed(1)}%
              </td>
              <td className="px-2 py-1">
                {pred.actualOutcome ? (
                  <span
                    className="inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                    style={{ color: signalColor(pred.actualOutcome), backgroundColor: signalColor(pred.actualOutcome) + '15' }}
                  >
                    {pred.actualOutcome}
                  </span>
                ) : (
                  <span className="text-text-muted">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 5. Model Card (list item)
// ---------------------------------------------------------------------------

function ModelCard({
  model,
  isSelected,
  onClick,
}: {
  model: MLModel
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full rounded-lg border p-3 text-left transition-colors',
        isSelected
          ? 'border-accent bg-accent/10'
          : 'border-border bg-navy-dark hover:border-border/80 hover:bg-navy-mid/30',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-primary">{model.name}</span>
        <div className="flex items-center gap-1.5">
          <div
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: statusColor(model.status) }}
          />
          <span className="text-[9px] uppercase text-text-muted">{model.status}</span>
        </div>
      </div>

      <div className="mt-1.5 flex items-center gap-3 text-[10px] text-text-muted">
        <span className="rounded bg-navy-mid px-1.5 py-0.5 font-mono uppercase">
          {model.type}
        </span>
        {model.metrics?.accuracy != null && (
          <span className="font-mono tabular-nums">
            Acc: {(model.metrics.accuracy * 100).toFixed(1)}%
          </span>
        )}
        {model.trainedAt && (
          <span>
            Trained {new Date(model.trainedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="mt-1 text-[10px] text-text-muted">
        {model.features.length} features / target: {model.targetVariable}
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// 6. New Model Wizard (inline)
// ---------------------------------------------------------------------------

function NewModelWizard({
  featureSets,
  onSubmit,
  onCancel,
}: {
  featureSets: FeatureSet[]
  onSubmit: (config: { name: string; modelType: MLModelType; featureSetName: string; target: string }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [modelType, setModelType] = useState<MLModelType>('classification')
  const [featureSetName, setFeatureSetName] = useState(featureSets[0]?.name ?? '')
  const [target, setTarget] = useState('binaryDirection_5')

  const handleSubmit = useCallback(() => {
    if (!name.trim()) return
    onSubmit({ name: name.trim(), modelType, featureSetName, target })
  }, [name, modelType, featureSetName, target, onSubmit])

  return (
    <div className="space-y-3 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">New Model</h3>

      <div>
        <label className="mb-1 block text-[10px] text-text-muted">Model Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Trend Classifier v1"
          className="w-full rounded border border-border bg-navy-mid px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-[10px] text-text-muted">Model Type</label>
        <div className="flex gap-2">
          {(['classification', 'regression'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setModelType(t)}
              className={cn(
                'flex-1 rounded border px-2 py-1.5 text-[10px] font-medium uppercase transition-colors',
                modelType === t
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-text-muted hover:border-border/80',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[10px] text-text-muted">Feature Set</label>
        <select
          value={featureSetName}
          onChange={(e) => setFeatureSetName(e.target.value)}
          className="w-full rounded border border-border bg-navy-mid px-2 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
        >
          {featureSets.map((fs) => (
            <option key={fs.name} value={fs.name}>{fs.name} ({fs.features.length} features)</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-[10px] text-text-muted">Target Variable</label>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="w-full rounded border border-border bg-navy-mid px-2 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
        >
          <option value="binaryDirection_5">Binary Direction (5 bars)</option>
          <option value="binaryDirection_10">Binary Direction (10 bars)</option>
          <option value="returnNBars_5">Return (5 bars)</option>
          <option value="returnNBars_10">Return (10 bars)</option>
        </select>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="flex-1 rounded bg-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Create Model
        </button>
        <button
          onClick={onCancel}
          className="rounded border border-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:bg-navy-mid"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 7. Drift Alert Banner
// ---------------------------------------------------------------------------

function DriftAlertBanner({ reports }: { reports: DriftReport[] }) {
  const latest = reports[reports.length - 1]
  if (!latest) return null

  const isCritical = latest.severity === 'critical'
  const bgColor = isCritical ? 'bg-red-500/10' : 'bg-amber-500/10'
  const borderColor = isCritical ? 'border-red-500/30' : 'border-amber-500/30'
  const textColor = isCritical ? 'text-red-400' : 'text-amber-400'
  const label = isCritical ? 'CRITICAL DRIFT' : 'DRIFT WARNING'

  return (
    <div className={cn('rounded-lg border px-4 py-3', bgColor, borderColor)}>
      <div className="flex items-center gap-2">
        <div className={cn('h-2 w-2 rounded-full', isCritical ? 'bg-red-500' : 'bg-amber-500')} />
        <span className={cn('text-xs font-semibold uppercase', textColor)}>{label}</span>
      </div>
      <p className="mt-1 text-[11px] text-text-secondary">{latest.recommendation}</p>
      <div className="mt-1.5 flex gap-4 text-[10px] text-text-muted">
        <span>Metric: <span className="font-mono text-text-primary">{latest.metric}</span></span>
        <span>Baseline: <span className="font-mono text-text-primary">{(latest.baseline * 100).toFixed(1)}%</span></span>
        <span>Current: <span className={cn('font-mono', textColor)}>{(latest.current * 100).toFixed(1)}%</span></span>
        <span>Degradation: <span className={cn('font-mono', textColor)}>{(latest.degradation * 100).toFixed(1)}%</span></span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export function MLDashboard({
  models,
  predictions,
  driftHistory,
  featureSets,
  onCreateModel,
  onTrainModel,
  onDeleteModel,
  className,
}: MLDashboardProps) {
  const [selectedModelId, setSelectedModelId] = useState<string | null>(models[0]?.id ?? null)
  const [showWizard, setShowWizard] = useState(false)

  const selectedModel = useMemo(
    () => models.find((m) => m.id === selectedModelId) ?? null,
    [models, selectedModelId],
  )

  const modelPredictions = useMemo(
    () => (selectedModelId ? predictions[selectedModelId] ?? [] : []),
    [predictions, selectedModelId],
  )

  const modelDriftHistory = useMemo(
    () => (selectedModelId ? driftHistory[selectedModelId] ?? [] : []),
    [driftHistory, selectedModelId],
  )

  // Check for any degraded model to show alert
  const degradedReports = useMemo(() => {
    for (const model of models) {
      const reports = driftHistory[model.id] ?? []
      const latest = reports[reports.length - 1]
      if (latest && (latest.severity === 'warning' || latest.severity === 'critical')) {
        return reports
      }
    }
    return []
  }, [models, driftHistory])

  const handleCreateModel = useCallback(
    (config: { name: string; modelType: MLModelType; featureSetName: string; target: string }) => {
      onCreateModel?.(config)
      setShowWizard(false)
    },
    [onCreateModel],
  )

  return (
    <div className={cn('flex h-full flex-col gap-3 bg-navy-black', className)}>
      {/* Drift alert banner */}
      {degradedReports.length > 0 && (
        <DriftAlertBanner reports={degradedReports} />
      )}

      <div className="flex flex-1 gap-3 overflow-hidden">
        {/* Left panel — Model list */}
        <div className="flex w-72 shrink-0 flex-col gap-2 overflow-y-auto">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
              Models ({models.length})
            </h3>
            <button
              onClick={() => setShowWizard(!showWizard)}
              className="rounded bg-accent/10 px-2 py-1 text-[10px] font-medium text-accent transition-colors hover:bg-accent/20"
            >
              + New
            </button>
          </div>

          {showWizard && (
            <div className="rounded-lg border border-border bg-navy-dark">
              <NewModelWizard
                featureSets={featureSets}
                onSubmit={handleCreateModel}
                onCancel={() => setShowWizard(false)}
              />
            </div>
          )}

          {models.map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              isSelected={model.id === selectedModelId}
              onClick={() => setSelectedModelId(model.id)}
            />
          ))}

          {models.length === 0 && !showWizard && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <span className="text-xs text-text-muted">No models yet</span>
              <button
                onClick={() => setShowWizard(true)}
                className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white"
              >
                Create First Model
              </button>
            </div>
          )}
        </div>

        {/* Right panel — Model detail */}
        {selectedModel ? (
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
            {/* Header with actions */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">{selectedModel.name}</h2>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-text-muted">
                  <span className="rounded bg-navy-mid px-1.5 py-0.5 font-mono uppercase">{selectedModel.type}</span>
                  <div className="flex items-center gap-1">
                    <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusColor(selectedModel.status) }} />
                    <span className="uppercase">{selectedModel.status}</span>
                  </div>
                  {selectedModel.trainedAt && (
                    <span>Last trained: {new Date(selectedModel.trainedAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {selectedModel.status === 'draft' && (
                  <button
                    onClick={() => onTrainModel?.(selectedModel.id)}
                    className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                  >
                    Train Model
                  </button>
                )}
                {(selectedModel.status === 'ready' || selectedModel.status === 'degraded') && (
                  <button
                    onClick={() => onTrainModel?.(selectedModel.id)}
                    className="rounded border border-accent px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
                  >
                    Retrain
                  </button>
                )}
                <button
                  onClick={() => onDeleteModel?.(selectedModel.id)}
                  className="rounded border border-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-red-500/30 hover:text-red-400"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Metrics gauges */}
            {selectedModel.metrics && (
              <Section title="Training Metrics">
                <div className="flex flex-wrap items-center justify-around gap-2 py-2">
                  {selectedModel.metrics.accuracy != null && (
                    <MetricGauge label="Accuracy" value={selectedModel.metrics.accuracy} />
                  )}
                  {selectedModel.metrics.auc != null && (
                    <MetricGauge label="AUC" value={selectedModel.metrics.auc} />
                  )}
                  {selectedModel.metrics.precision != null && (
                    <MetricGauge label="Precision" value={selectedModel.metrics.precision} />
                  )}
                  {selectedModel.metrics.recall != null && (
                    <MetricGauge label="Recall" value={selectedModel.metrics.recall} />
                  )}
                  {selectedModel.metrics.r2 != null && (
                    <MetricGauge label="R-squared" value={selectedModel.metrics.r2} />
                  )}
                </div>
                {selectedModel.metrics.sharpe != null && (
                  <div className="border-t border-border px-3 py-2 text-center">
                    <span className="text-[9px] uppercase text-text-muted">Sharpe Ratio</span>
                    <div className="font-mono text-sm font-semibold tabular-nums text-accent">
                      {selectedModel.metrics.sharpe.toFixed(2)}
                    </div>
                  </div>
                )}
              </Section>
            )}

            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              {/* Feature importance */}
              <Section title="Feature Importance">
                <FeatureImportanceChart features={selectedModel.features} metrics={selectedModel.metrics} />
              </Section>

              {/* Drift monitor */}
              <Section title="Drift Monitor" className="min-h-[200px]">
                <DriftTimelineChart reports={modelDriftHistory} />
              </Section>
            </div>

            {/* Prediction log */}
            <Section title={`Prediction Log (${modelPredictions.length})`} className="max-h-[300px]">
              <PredictionLog predictions={modelPredictions} />
            </Section>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-xs text-text-muted">
            Select a model to view details
          </div>
        )}
      </div>
    </div>
  )
}
