'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { engineCheckCompatibility, engineGetAllCompanionPlants } from '../actions';
import { GardenActionButton, GardenBadge, GardenGhostButton, GardenKicker, GardenMetricCard, GardenPanel } from '../_components/GardenPrimitives';
import { GARDEN_CHROME, alpha, humanizeGardenValue } from '../_lib/design';

type CompatResult = {
  relationship: 'companion' | 'antagonist' | 'neutral';
  benefit: string;
  category: string;
};

const SCORE_BY_RELATIONSHIP: Record<CompatResult['relationship'], number> = {
  companion: 94,
  neutral: 61,
  antagonist: 18,
};

export default function GardenCompanionsPage() {
  const [plants, setPlants] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plantA, setPlantA] = useState('');
  const [plantB, setPlantB] = useState('');
  const [result, setResult] = useState<CompatResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [matrixPlants, setMatrixPlants] = useState<string[]>([]);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    engineGetAllCompanionPlants()
      .then((rows) => {
        const next = rows as string[];
        setPlants(next);
        setMatrixPlants(next.slice(0, 8));
        setPlantA((current) => current || next[0] || '');
        setPlantB((current) => current || next[1] || '');
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Failed to load companion data'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCheck = useCallback(async () => {
    if (!plantA || !plantB) return;
    setChecking(true);
    try {
      const match = await engineCheckCompatibility(plantA, plantB);
      setResult(match as CompatResult);
    } finally {
      setChecking(false);
    }
  }, [plantA, plantB]);

  useEffect(() => {
    if (!matrixPlants.length) return;
    Promise.all(matrixPlants.flatMap((rowPlant) => matrixPlants.map((columnPlant) => (
      rowPlant === columnPlant ? Promise.resolve(null) : engineCheckCompatibility(rowPlant, columnPlant)
    ))))
      .then(() => {
        /* results computed lazily in render via cached calls below */
      });
  }, [matrixPlants]);

  const [matrixResults, setMatrixResults] = useState<Record<string, CompatResult>>({});

  useEffect(() => {
    if (!matrixPlants.length) return;
    let cancelled = false;
    Promise.all(
      matrixPlants.flatMap((rowPlant) => matrixPlants.map(async (columnPlant) => {
        if (rowPlant === columnPlant) return null;
        const match = await engineCheckCompatibility(rowPlant, columnPlant);
        return { key: `${rowPlant}|${columnPlant}`, value: match as CompatResult };
      })),
    )
      .then((entries) => {
        if (cancelled) return;
        const next: Record<string, CompatResult> = {};
        entries.forEach((entry) => {
          if (entry) next[entry.key] = entry.value;
        });
        setMatrixResults(next);
      });
    return () => {
      cancelled = true;
    };
  }, [matrixPlants]);

  const breakdown = useMemo(() => {
    let companionCount = 0;
    let neutralCount = 0;
    let antagonistCount = 0;

    Object.values(matrixResults).forEach((value) => {
      if (value.relationship === 'companion') companionCount += 1;
      else if (value.relationship === 'antagonist') antagonistCount += 1;
      else neutralCount += 1;
    });

    const total = companionCount + neutralCount + antagonistCount || 1;
    return {
      moisture: Math.round((companionCount / total) * 100),
      luminescence: Math.round(((companionCount + neutralCount * 0.5) / total) * 100),
      growth: Math.round((((companionCount * 2) + neutralCount) / (total * 2)) * 100),
    };
  }, [matrixResults]);

  if (loading) return <CompanionSkeleton />;
  if (error) return <CompanionError message={error} onRetry={refresh} />;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <h1 style={{ margin: 0, fontSize: 40, fontWeight: 800, letterSpacing: -1.2 }}>Companion Matrix</h1>
          <p style={{ margin: 0, color: GARDEN_CHROME.textMuted, lineHeight: 1.7 }}>
            Pair crops, audit antagonists, and inspect the live matrix behind your layout decisions.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 4fr) minmax(0, 8fr)', gap: 20, alignItems: 'start' }}>
        <GardenPanel tone="base" style={{ padding: 24 }}>
          <div style={{ display: 'grid', gap: 18 }}>
            <div>
              <GardenKicker color={GARDEN_CHROME.gold}>Pair Lookup</GardenKicker>
              <h2 style={{ margin: '10px 0 0', fontSize: 30, fontWeight: 800, letterSpacing: -0.9 }}>Check compatibility</h2>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <select value={plantA} onChange={(event) => setPlantA(event.target.value)} style={selectStyle}>
                {plants.map((plant) => <option key={plant} value={plant}>{humanizeGardenValue(plant)}</option>)}
              </select>
              <select value={plantB} onChange={(event) => setPlantB(event.target.value)} style={selectStyle}>
                {plants.map((plant) => <option key={plant} value={plant}>{humanizeGardenValue(plant)}</option>)}
              </select>
              <GardenActionButton onClick={handleCheck} disabled={checking}>
                {checking ? 'Checking' : 'Check Compatibility'}
              </GardenActionButton>
            </div>

            {result ? (
              <GardenPanel tone="focus" style={{ padding: 20 }}>
                <div style={{ display: 'grid', gap: 14 }}>
                  <GardenBadge
                    text={result.relationship === 'companion' ? 'Excellent Match' : result.relationship === 'antagonist' ? 'Avoid Pairing' : 'Neutral Match'}
                    color={result.relationship === 'companion' ? GARDEN_CHROME.accent : result.relationship === 'antagonist' ? GARDEN_CHROME.danger : GARDEN_CHROME.gold}
                    background={alpha(result.relationship === 'companion' ? GARDEN_CHROME.accent : result.relationship === 'antagonist' ? GARDEN_CHROME.danger : GARDEN_CHROME.gold, 0.14)}
                  />
                  <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: -1.4 }}>{SCORE_BY_RELATIONSHIP[result.relationship]}%</div>
                  <p style={{ margin: 0, color: GARDEN_CHROME.textMuted, lineHeight: 1.7 }}>{result.benefit}</p>
                  <ul style={{ margin: 0, paddingLeft: 18, color: GARDEN_CHROME.textMuted, lineHeight: 1.8 }}>
                    <li>{humanizeGardenValue(result.category)} interaction</li>
                    <li>Use this score when placing plants in the layout planner</li>
                  </ul>
                </div>
              </GardenPanel>
            ) : (
              <p style={{ margin: 0, color: GARDEN_CHROME.textMuted, lineHeight: 1.7 }}>
                Pick two plants from the library to see their synergy score and planting note.
              </p>
            )}
          </div>
        </GardenPanel>

        <GardenPanel tone="base" style={{ padding: 24 }}>
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <GardenKicker color={GARDEN_CHROME.tertiary}>Compatibility Matrix</GardenKicker>
                <h2 style={{ margin: '10px 0 0', fontSize: 30, fontWeight: 800, letterSpacing: -0.9 }}>Eight-crop desktop view</h2>
              </div>
              <GardenGhostButton onClick={() => setMatrixPlants(plants.slice(0, 8))}>Reset Grid</GardenGhostButton>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: `120px repeat(${matrixPlants.length}, 72px)`, gap: 8, minWidth: 760 }}>
                <div />
                {matrixPlants.map((plant) => (
                  <MatrixHeader key={plant} label={plant} />
                ))}
                {matrixPlants.map((rowPlant) => (
                  <>
                    <MatrixHeader key={`${rowPlant}-row`} label={rowPlant} />
                    {matrixPlants.map((columnPlant) => {
                      if (rowPlant === columnPlant) {
                        return <MatrixCell key={`${rowPlant}-${columnPlant}`} state="self" value="•" />;
                      }
                      const match = matrixResults[`${rowPlant}|${columnPlant}`];
                      return (
                        <MatrixCell
                          key={`${rowPlant}-${columnPlant}`}
                          state={match?.relationship ?? 'neutral'}
                          value={match?.relationship === 'companion' ? '✓' : match?.relationship === 'antagonist' ? '!' : '·'}
                        />
                      );
                    })}
                  </>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
              <GardenMetricCard label="Moisture Sync" value={`${breakdown.moisture}%`} accent={GARDEN_CHROME.accent} />
              <GardenMetricCard label="Luminescence" value={`${breakdown.luminescence}%`} accent={GARDEN_CHROME.tertiary} />
              <GardenMetricCard label="Growth Cycle" value={`${breakdown.growth}%`} accent={GARDEN_CHROME.gold} />
            </div>
          </div>
        </GardenPanel>
      </div>

      <button type="button" style={fabButton} onClick={() => setPlantA(plants[0] || '')}>
        +
      </button>
    </div>
  );
}

function MatrixHeader({ label }: { label: string }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: 56, color: GARDEN_CHROME.textMuted, fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase' }}>
      {humanizeGardenValue(label).slice(0, 8)}
    </div>
  );
}

function MatrixCell({ state, value }: { state: 'companion' | 'antagonist' | 'neutral' | 'self'; value: string }) {
  const background = state === 'companion'
    ? alpha(GARDEN_CHROME.accent, 0.18)
    : state === 'antagonist'
      ? alpha(GARDEN_CHROME.danger, 0.18)
      : state === 'self'
        ? alpha(GARDEN_CHROME.gold, 0.16)
        : alpha('#FFFFFF', 0.05);
  const color = state === 'companion'
    ? GARDEN_CHROME.accent
    : state === 'antagonist'
      ? GARDEN_CHROME.danger
      : state === 'self'
        ? GARDEN_CHROME.gold
        : GARDEN_CHROME.textMuted;

  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        width: 72,
        height: 72,
        borderRadius: 22,
        background,
        color,
        fontSize: 20,
        fontWeight: 800,
        boxShadow: `inset 0 0 0 1px ${alpha(color, state === 'neutral' ? 0.08 : 0.16)}`,
      }}
    >
      {value}
    </div>
  );
}

function CompanionSkeleton() {
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ ...skeleton, height: 88 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 4fr) minmax(0, 8fr)', gap: 20 }}>
        {[0, 1].map((item) => <div key={item} style={{ ...skeleton, minHeight: 520 }} />)}
      </div>
    </div>
  );
}

function CompanionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <GardenPanel tone="base" style={{ padding: 36, textAlign: 'center' }}>
      <div style={{ display: 'grid', gap: 12, justifyItems: 'center' }}>
        <GardenKicker color={GARDEN_CHROME.danger}>Load Failure</GardenKicker>
        <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.8 }}>Companion matrix failed to load.</h2>
        <p style={{ margin: 0, color: GARDEN_CHROME.textMuted }}>{message}</p>
        <GardenGhostButton onClick={onRetry}>Retry</GardenGhostButton>
      </div>
    </GardenPanel>
  );
}

const selectStyle: CSSProperties = {
  minHeight: 48,
  padding: '0 16px',
  borderRadius: 18,
  border: `1px solid ${alpha('#FFFFFF', 0.08)}`,
  background: alpha('#FFFFFF', 0.04),
  color: GARDEN_CHROME.text,
  fontSize: 14,
  outline: 'none',
};

const fabButton: CSSProperties = {
  position: 'fixed',
  right: 32,
  bottom: 32,
  width: 58,
  height: 58,
  borderRadius: 999,
  border: 'none',
  cursor: 'pointer',
  background: `linear-gradient(135deg, ${GARDEN_CHROME.gold}, ${GARDEN_CHROME.goldDeep})`,
  color: '#2E1600',
  fontSize: 34,
  fontWeight: 700,
  boxShadow: `0 18px 34px ${alpha(GARDEN_CHROME.gold, 0.32)}`,
};

const skeleton: CSSProperties = {
  borderRadius: 28,
  background: alpha('#FFFFFF', 0.05),
};
