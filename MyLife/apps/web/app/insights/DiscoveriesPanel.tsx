/**
 * Phase 4a Insights — Discoveries panel (web, server component).
 *
 * Renders the output of `discoverInsights` as read-only cards. No
 * interactions — this is a cross-module scan by the on-device engine.
 */
import type { InsightCard } from '@mylife/intelligence';

interface Props {
  discoveries: InsightCard[];
}

export function DiscoveriesPanel({ discoveries }: Props) {
  if (discoveries.length === 0) {
    return (
      <div style={emptyStyle}>
        <div style={emptyTitleStyle}>Nothing interesting yet</div>
        <p style={emptyBodyStyle}>
          MyLife scans every permitted module for strong correlations. Keep
          logging and check back in a week or two.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {discoveries.map((insight, i) => (
        <div key={i} style={cardStyle}>
          <div style={headerRowStyle}>
            <span style={confidenceStyle}>{insight.confidence}</span>
            <span style={strengthStyle}>{insight.correlation.strength}</span>
          </div>
          <h3 style={titleStyle}>{insight.title}</h3>
          <p style={bodyStyle}>{insight.description}</p>
        </div>
      ))}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#2A292F',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: 12,
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};
const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
};
const confidenceStyle: React.CSSProperties = {
  color: '#FFB877',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 1,
};
const strengthStyle: React.CSSProperties = {
  color: '#D6C3B5',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 1,
};
const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 600,
  color: '#E4E1E9',
  lineHeight: 1.3,
};
const bodyStyle: React.CSSProperties = {
  margin: 0,
  color: '#D6C3B5',
  fontSize: 14,
  lineHeight: 1.5,
};
const emptyStyle: React.CSSProperties = {
  padding: 40,
  textAlign: 'center',
  color: '#D6C3B5',
  background: '#2A292F',
  borderRadius: 12,
  border: '1px solid rgba(255, 255, 255, 0.06)',
};
const emptyTitleStyle: React.CSSProperties = {
  color: '#E4E1E9',
  fontSize: 16,
  fontWeight: 600,
  marginBottom: 8,
};
const emptyBodyStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.5,
};
