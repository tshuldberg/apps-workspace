export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          TheMarlin<span className="text-accent">Traders</span>
        </h1>
        <p className="mt-4 text-lg text-text-secondary">
          All-in-one trading platform — charting, strategy, execution, journaling, and community.
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <div className="rounded-panel border border-border bg-navy-dark px-6 py-3 text-sm text-text-secondary">
            Phase 1: Core Charting Platform
          </div>
        </div>
      </div>
    </main>
  )
}
