import { fetchPackingItems, fetchPackingTemplates } from '../actions';
import { computePackingTotals, formatPackingCategory, formatWeight, groupPackingItems, TEXT, TEXT_SEC, TEXT_TER } from '../ui';
import { TrailsActionLink, TrailsHero, TrailsPanel, TrailsChip } from '../shell';

export default async function TrailsGearPage() {
  const templates = await fetchPackingTemplates();
  const itemSets = await Promise.all(
    templates.map(async (template) => ({
      template,
      items: await fetchPackingItems(template.id),
    })),
  );

  const grouped = groupPackingItems(itemSets.flatMap((set) => set.items));
  const totals = computePackingTotals(grouped);
  const categories = Array.from(new Set(grouped.map((item) => item.category)));

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <TrailsHero
        eyebrow="Gear Inventory"
        title="A category-led desktop gear closet with estimated pack weight."
        description="Because the underlying schema still stores gear as packing items, the web gear hub uses the same heuristic pack-weight model as mobile and groups repeated equipment into a usable inventory board."
        actions={
          <>
            <TrailsActionLink href="/trails/packing" symbol="checklist">
              Packing Lists
            </TrailsActionLink>
            <TrailsActionLink href="/trails/trips" symbol="camping" secondary>
              Trip Planner
            </TrailsActionLink>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        <SummaryCard label="Items" value={String(totals.totalCount)} />
        <SummaryCard label="Base Weight" value={formatWeight(totals.baseWeightGrams)} />
        <SummaryCard label="Consumables" value={formatWeight(totals.consumablesGrams)} />
        <SummaryCard label="Categories" value={String(categories.length)} />
      </div>

      <TrailsPanel eyebrow="Closet" title="Categorized Inventory">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
          {categories.map((category) => {
            const items = grouped.filter((item) => item.category === category);
            const totalWeight = items.reduce(
              (sum, item) => sum + item.estimatedWeightGrams * item.quantity,
              0,
            );

            return (
              <div key={category} style={categoryCardStyle}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <strong style={{ color: TEXT, fontSize: 16 }}>{formatPackingCategory(category)}</strong>
                  <span style={{ color: TEXT_SEC, fontSize: 13 }}>{formatWeight(totalWeight)} estimated</span>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {items.slice(0, 4).map((item) => (
                    <div key={item.key} style={itemRowStyle}>
                      <div style={{ display: 'grid', gap: 2, flex: 1, minWidth: 0 }}>
                        <strong style={{ color: TEXT, fontSize: 14 }}>{item.name}</strong>
                        <span style={{ color: TEXT_TER, fontSize: 12 }}>
                          {formatWeight(item.estimatedWeightGrams * item.quantity)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <TrailsChip label={`x${item.quantity}`} active={item.allChecked} subtle={!item.allChecked} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </TrailsPanel>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={summaryCardStyle}>
      <span style={{ color: TEXT_TER, fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase' }}>{label}</span>
      <strong style={{ color: TEXT, fontSize: 28 }}>{value}</strong>
    </div>
  );
}

const summaryCardStyle = {
  display: 'grid',
  gap: 10,
  minHeight: 118,
  padding: 18,
  borderRadius: 24,
  background: 'linear-gradient(180deg, rgba(43,43,48,0.74), rgba(19,19,24,0.98))',
  boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.08)',
};

const categoryCardStyle = {
  display: 'grid',
  gap: 14,
  padding: 18,
  borderRadius: 24,
  background: 'linear-gradient(180deg, rgba(43,43,48,0.74), rgba(19,19,24,0.98))',
  boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.08)',
};

const itemRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 12px',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.05)',
};
