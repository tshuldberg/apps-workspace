import Link from 'next/link';
import { fetchPackingItems, fetchPackingProgress, fetchPackingTemplates } from '../actions';
import { computePackingTotals, formatPackingCategory, formatWeight, groupPackingItems, TEXT, TEXT_SEC, TEXT_TER } from '../ui';
import { TrailsActionLink, TrailsHero, TrailsPanel, TrailsChip } from '../shell';

type PackingTemplate = {
  id: string;
  name: string;
  type: string;
  isBuiltIn: boolean;
};

export default async function TrailsPackingPage() {
  const templates = (await fetchPackingTemplates()) as PackingTemplate[];
  const activeTemplate = templates[0] ?? null;
  const templateCards = await Promise.all(
    templates.map(async (template) => {
      const progress = (await fetchPackingProgress(template.id)) as { total: number; checked: number };
      const percent = progress.total > 0 ? Math.round((progress.checked / progress.total) * 100) : 0;

      return {
        template,
        progress,
        percent,
      };
    }),
  );
  const [activeItems, activeProgress] = activeTemplate
    ? await Promise.all([fetchPackingItems(activeTemplate.id), fetchPackingProgress(activeTemplate.id)])
    : [[], { total: 0, checked: 0 }];

  const grouped = groupPackingItems(activeItems);
  const totals = computePackingTotals(grouped);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <TrailsHero
        eyebrow="Packing"
        title="Checklist library on the left, active carry plan on the right."
        description="The desktop packing hub mirrors the mobile library: reusable templates, progress-aware checklists, and quick visibility into base weight versus consumables."
        actions={
          <>
            <TrailsActionLink href="/trails/gear" symbol="backpack">
              Open Gear Closet
            </TrailsActionLink>
            <TrailsActionLink href="/trails/trips" symbol="camping" secondary>
              Trip Planner
            </TrailsActionLink>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.05fr', gap: 16 }}>
        <TrailsPanel eyebrow="Library" title="Packing Templates">
          {templateCards.length > 0 ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {templateCards.map(({ template, percent }) => (
                  <Link key={template.id} href={`/trails/packing/${template.id}`} style={templateRowStyle}>
                    <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 4 }}>
                      <strong style={{ color: TEXT }}>{template.name}</strong>
                      <span style={{ color: TEXT_SEC, fontSize: 13 }}>{template.type.replace(/_/g, ' ')}</span>
                    </div>
                    <div style={{ display: 'grid', gap: 4, minWidth: 120 }}>
                      <span style={{ color: TEXT_TER, fontSize: 12, textAlign: 'right' }}>{percent}% packed</span>
                      <div style={progressTrackStyle}>
                        <div style={{ ...progressBarStyle, width: `${percent}%` }} />
                      </div>
                    </div>
                  </Link>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: TEXT_SEC }}>Create a packing template on mobile to see it here.</p>
          )}
        </TrailsPanel>

        <TrailsPanel eyebrow="Active Checklist" title={activeTemplate?.name ?? 'No active list'}>
          {activeTemplate ? (
            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <TrailsChip label={`${activeProgress.checked}/${activeProgress.total} checked`} active />
                <TrailsChip label={`Base ${formatWeight(totals.baseWeightGrams)}`} subtle />
                <TrailsChip label={`Consumables ${formatWeight(totals.consumablesGrams)}`} subtle />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                {grouped.slice(0, 8).map((group) => (
                  <div key={group.key} style={groupCardStyle}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <strong style={{ color: TEXT, fontSize: 14 }}>{group.name}</strong>
                        <span style={{ color: TEXT_SEC, fontSize: 12 }}>{formatPackingCategory(group.category)}</span>
                      </div>
                      <span style={{ color: group.allChecked ? '#84CC16' : TEXT_TER, fontSize: 12, fontWeight: 700 }}>
                        {group.checkedCount}/{group.quantity}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: TEXT_TER, fontSize: 12 }}>
                      <span>{formatWeight(group.estimatedWeightGrams * group.quantity)}</span>
                      <span>{group.allChecked ? 'Ready' : 'Pending'}</span>
                    </div>
                  </div>
                ))}
              </div>

              <TrailsActionLink href={`/trails/packing/${activeTemplate.id}`} secondary symbol="checklist">
                Open full checklist
              </TrailsActionLink>
            </div>
          ) : (
            <p style={{ margin: 0, color: TEXT_SEC }}>No packing templates yet.</p>
          )}
        </TrailsPanel>
      </div>
    </div>
  );
}

const templateRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '14px 16px',
  borderRadius: 22,
  textDecoration: 'none',
  background: 'linear-gradient(180deg, rgba(43,43,48,0.74), rgba(19,19,24,0.98))',
  boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.08)',
};

const progressTrackStyle = {
  height: 6,
  borderRadius: 999,
  overflow: 'hidden' as const,
  background: 'rgba(255,255,255,0.08)',
};

const progressBarStyle = {
  height: '100%',
  borderRadius: 999,
  background: 'linear-gradient(90deg, #84CC16, #65A30D)',
};

const groupCardStyle = {
  display: 'grid',
  gap: 10,
  padding: 16,
  borderRadius: 20,
  background: 'rgba(255,255,255,0.05)',
};
