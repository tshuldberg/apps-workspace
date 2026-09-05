import { fetchSurfHomeCards } from '../actions';
import { SURF_TEXT, SURF_TEXT_SECONDARY, SurfHero, SurfPanel } from '../ui';

export default async function SurfAlertsPage() {
  const cards = await fetchSurfHomeCards();
  const rules = cards.slice(0, 4).map((card, index) => ({
    id: card.spot.id,
    spot: card.spot.name,
    condition: 'Wave height',
    operator: '>=',
    value: `${(card.days[0]?.waveHeightMax ?? 3).toFixed(1)} ft`,
    logic: index % 2 === 0 ? 'AND clean wind' : 'AND high tide',
    status: index % 3 === 0 ? 'Paused' : 'Active',
  }));

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <SurfHero
        eyebrow="Alert Management"
        title="Rules for the moments worth paddling out."
        description="Track wave, wind, and tide thresholds by spot and review a clean history of triggered conditions."
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 16 }}>
        <SurfPanel eyebrow="Rules" title="Alert Table">
          <div style={{ display: 'grid', gap: 10 }}>
            {rules.map((rule) => (
              <div key={rule.id} style={rowStyle}>
                <strong style={{ color: SURF_TEXT, width: 140 }}>{rule.spot}</strong>
                <span style={{ color: SURF_TEXT_SECONDARY }}>{rule.condition}</span>
                <span style={{ color: SURF_TEXT_SECONDARY }}>{rule.operator}</span>
                <span style={{ color: SURF_TEXT_SECONDARY }}>{rule.value}</span>
                <span style={{ color: SURF_TEXT_SECONDARY }}>{rule.logic}</span>
                <span style={{ marginLeft: 'auto', color: rule.status === 'Active' ? 'var(--success)' : 'var(--warning)' }}>
                  {rule.status}
                </span>
              </div>
            ))}
          </div>
        </SurfPanel>

        <SurfPanel eyebrow="Create" title="New Alert">
          <div style={tileStyle}>
            <span style={{ color: SURF_TEXT_SECONDARY }}>Spot</span>
            <strong style={{ color: SURF_TEXT }}>{rules[0]?.spot ?? 'Pick a spot'}</strong>
          </div>
          <div style={tileStyle}>
            <span style={{ color: SURF_TEXT_SECONDARY }}>Conditions</span>
            <strong style={{ color: SURF_TEXT }}>Wave + wind + tide</strong>
          </div>
          <div style={tileStyle}>
            <span style={{ color: SURF_TEXT_SECONDARY }}>Delivery</span>
            <strong style={{ color: SURF_TEXT }}>Local push / email later</strong>
          </div>
        </SurfPanel>
      </div>

      <SurfPanel eyebrow="History" title="Triggered Alerts">
        <div style={{ display: 'grid', gap: 10 }}>
          {rules.map((rule, index) => (
            <div key={`${rule.id}-${index}`} style={rowStyle}>
              <strong style={{ color: SURF_TEXT }}>{rule.spot}</strong>
              <span style={{ color: SURF_TEXT_SECONDARY }}>{rule.value}</span>
              <span style={{ color: SURF_TEXT_SECONDARY }}>Matched at dawn window</span>
              <span style={{ marginLeft: 'auto', color: SURF_TEXT_SECONDARY }}>
                {new Date(Date.now() - index * 3600_000).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </SurfPanel>
    </div>
  );
}

const tileStyle = {
  display: 'grid',
  gap: 6,
  padding: 14,
  borderRadius: 18,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
} as const;

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '14px 16px',
  borderRadius: 18,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
} as const;
