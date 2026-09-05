import Link from 'next/link';
import { fetchDatabaseEntries } from '../actions';
import {
  difficultyColor,
  formatDistance,
  formatElevation,
  TEXT,
  TEXT_SEC,
  TEXT_TER,
  type BasicTrail,
} from '../ui';
import {
  TrailsActionLink,
  TrailsHero,
  TrailsPanel,
  TrailsSymbol,
  TrailsChip,
} from '../shell';

type DiscoveryEntry = {
  id: string;
  name: string;
  description: string | null;
  difficulty: string | null;
  distanceMeters: number | null;
  elevationGainMeters: number | null;
  lat: number;
  lng: number;
  region: string | null;
  trailType: string;
  source: string;
  fetchedAt: string;
};

export default async function TrailsDiscoverPage() {
  const entries = (await fetchDatabaseEntries({ limit: 18 })) as DiscoveryEntry[];
  const regionCounts = groupByRegion(entries).slice(0, 4);
  const featured = entries.slice(0, 6);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <TrailsHero
        eyebrow="Discover"
        title="Map-forward discovery for featured regions and trend collections."
        description="Desktop discover mirrors the mobile hub: a broad map hero, curated regional collections, and trending trail cards pulled from the trail database cache."
        actions={
          <>
            <TrailsActionLink href="/trails/list" symbol="terrain">
              Saved Trails
            </TrailsActionLink>
            <TrailsActionLink href="/trails/routes" symbol="route" secondary>
              Plan A Custom Route
            </TrailsActionLink>
          </>
        }
        aside={
          <div style={mapHeroStyle}>
            <div style={mapGridStyle} />
            {regionCounts.map((entry, index) => (
              <div
                key={entry.name}
                style={{
                  position: 'absolute',
                  left: `${16 + index * 20}%`,
                  top: `${26 + ((index % 2) * 20)}%`,
                  display: 'grid',
                  gap: 4,
                  justifyItems: 'center',
                }}
              >
                <span style={pinStyle} />
                <span style={{ fontSize: 11, color: TEXT_TER }}>{entry.name}</span>
              </div>
            ))}
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 16 }}>
        <TrailsPanel eyebrow="Collections" title="Featured Regions">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            {regionCounts.map((entry) => (
              <div key={entry.name} style={collectionCardStyle}>
                <div style={{ display: 'grid', gap: 6 }}>
                  <strong style={{ fontSize: 16, color: TEXT }}>{entry.name}</strong>
                  <span style={{ color: TEXT_SEC, fontSize: 13 }}>{entry.count} cached trails</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: TEXT_TER, fontSize: 12 }}>
                  <TrailsSymbol name="explore" size={18} color="#84CC16" />
                  {entry.sampleNames.join(' · ')}
                </div>
              </div>
            ))}
          </div>
        </TrailsPanel>

        <TrailsPanel eyebrow="For You" title="Trending Types">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Array.from(new Set(entries.map((entry) => entry.trailType))).slice(0, 5).map((type) => (
              <TrailsChip key={type} label={type.replace(/_/g, ' ')} active={type === entries[0]?.trailType} subtle={type !== entries[0]?.trailType} />
            ))}
          </div>
          <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
            {featured.slice(0, 3).map((entry) => (
              <div key={entry.id} style={trendRowStyle}>
                <span style={{ color: TEXT, fontSize: 18 }}>🥾</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: 'block', color: TEXT }}>{entry.name}</strong>
                  <span style={{ color: TEXT_SEC, fontSize: 13 }}>
                    {entry.region ?? 'Unknown region'} · {entry.source}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </TrailsPanel>
      </div>

      <TrailsPanel eyebrow="Trending" title="Global Trail Discovery Grid">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
          {featured.map((entry) => (
            <Link key={entry.id} href="/trails/list" style={entryCardStyle}>
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <strong style={{ fontSize: 16, color: TEXT }}>{entry.name}</strong>
                    <span style={{ color: TEXT_SEC, fontSize: 13 }}>{entry.region ?? 'Wildlands'}</span>
                  </div>
                  {entry.difficulty ? (
                    <span
                      style={{
                        padding: '6px 10px',
                        borderRadius: 999,
                        background: `${difficultyColor(entry.difficulty)}20`,
                        color: difficultyColor(entry.difficulty),
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {entry.difficulty}
                    </span>
                  ) : null}
                </div>
                <p style={{ margin: 0, color: TEXT_SEC, fontSize: 13, lineHeight: 1.6 }}>
                  {entry.description ?? 'Cached route card from the discovery database.'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {entry.distanceMeters ? <MetaPill label={formatDistance(entry.distanceMeters)} /> : null}
                {entry.elevationGainMeters ? <MetaPill label={formatElevation(entry.elevationGainMeters)} /> : null}
                <MetaPill label={entry.trailType.replace(/_/g, ' ')} />
              </div>
            </Link>
          ))}
        </div>
      </TrailsPanel>
    </div>
  );
}

function MetaPill({ label }: { label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '6px 10px',
        borderRadius: 999,
        background: 'rgba(255,255,255,0.05)',
        color: TEXT_SEC,
        fontSize: 12,
      }}
    >
      {label}
    </span>
  );
}

function groupByRegion(entries: DiscoveryEntry[]) {
  const map = new Map<string, { name: string; count: number; sampleNames: string[] }>();
  for (const entry of entries) {
    const key = entry.region ?? 'Unknown Region';
    const current = map.get(key);
    if (current) {
      current.count += 1;
      if (current.sampleNames.length < 2) {
        current.sampleNames.push(entry.name);
      }
    } else {
      map.set(key, { name: key, count: 1, sampleNames: [entry.name] });
    }
  }

  return Array.from(map.values()).sort((left, right) => right.count - left.count);
}

const mapHeroStyle = {
  position: 'relative' as const,
  minHeight: 220,
  borderRadius: 24,
  overflow: 'hidden' as const,
  background: 'linear-gradient(180deg, rgba(12,17,12,0.96), rgba(19,19,24,0.88))',
  boxShadow: 'inset 0 0 0 1.5px rgba(132,204,22,0.12)',
};

const mapGridStyle = {
  position: 'absolute' as const,
  inset: 0,
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
  backgroundSize: '28px 28px',
  opacity: 0.36,
};

const pinStyle = {
  width: 14,
  height: 14,
  borderRadius: 999,
  background: '#84CC16',
  boxShadow: '0 0 0 10px rgba(132,204,22,0.14)',
};

const collectionCardStyle = {
  display: 'grid',
  gap: 12,
  padding: 18,
  borderRadius: 24,
  background: 'linear-gradient(180deg, rgba(43,43,48,0.74), rgba(19,19,24,0.98))',
  boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.08)',
};

const trendRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 14px',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.05)',
};

const entryCardStyle = {
  display: 'grid',
  gap: 16,
  padding: 18,
  borderRadius: 24,
  textDecoration: 'none',
  background: 'linear-gradient(180deg, rgba(43,43,48,0.74), rgba(19,19,24,0.98))',
  boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.08)',
};
