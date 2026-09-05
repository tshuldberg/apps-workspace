'use client';

import { useMemo, useState } from 'react';
import { fetchDigestivePageData } from '../actions';
import { DonutCard } from '../charts';
import {
  MedsChip,
  MedsErrorState,
  MedsLoadingState,
  MedsPageLead,
  MedsPanel,
  MedsSectionTitle,
  formatClinicalDate,
  useMedsLoader,
} from '../ui';

type DigestiveData = Awaited<ReturnType<typeof fetchDigestivePageData>>;

export default function FODMAPPage() {
  const { data, loading, error } = useMedsLoader(fetchDigestivePageData, []);
  const [query, setQuery] = useState('');

  const searchResults = useMemo(() => {
    if (!data || query.trim().length === 0) {
      return data?.foods.slice(0, 8) ?? [];
    }

    return data.foods
      .filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))
      .slice(0, 8);
  }, [data, query]);

  if (loading) {
    return <MedsLoadingState label="Loading digestive health…" />;
  }

  if (error || !data) {
    return <MedsErrorState message={error ?? 'Unable to load digestive health.'} />;
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <MedsPageLead
        eyebrow="Phase 8 / P8-D"
        title="Digestive health"
        description="Today’s FODMAP load, searchable food diary, Bristol-scale stool tracking, symptom correlation cues, and safe-food guidance."
        actions={
          <>
            <MedsChip tone={data.insights.todayLoad.tone === 'safe' ? 'success' : data.insights.todayLoad.tone === 'caution' ? 'warning' : 'danger'}>
              {data.insights.todayLoad.label}
            </MedsChip>
            <MedsChip tone="cyan">{data.foodDiary.length} logged meals</MedsChip>
          </>
        }
      />

      <div className="meds-grid-4">
        {[
          { label: 'Today load', value: data.insights.todayLoad.label },
          { label: 'Meals today', value: `${data.insights.todayLoad.mealCount}` },
          { label: 'Safe foods', value: `${data.insights.safeFoods.length}` },
          { label: 'Recent symptoms', value: `${data.insights.recentSymptoms.length}` },
        ].map((item) => (
          <MedsPanel key={item.label} tone="muted">
            <div className="meds-stack">
              <span className="meds-label">{item.label}</span>
              <strong style={{ fontSize: 30, letterSpacing: '-0.05em' }}>{item.value}</strong>
            </div>
          </MedsPanel>
        ))}
      </div>

      <div className="meds-grid-2">
        <MedsPanel tone="accent">
          <MedsSectionTitle label="Food search" title="Find safe foods" />
          <div className="meds-stack">
            <input
              className="meds-inline-field"
              value={query}
              placeholder="Search the FODMAP library"
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="meds-list">
              {searchResults.map((item) => (
                <div key={item.id} className="meds-row" style={{ justifyContent: 'space-between' }}>
                  <div className="meds-stack">
                    <strong style={{ fontSize: 15 }}>{item.name}</strong>
                    <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 12 }}>{item.category}</span>
                  </div>
                  <MedsChip tone={item.fodmapRating === 'low' ? 'success' : item.fodmapRating === 'moderate' ? 'warning' : 'danger'}>
                    {item.fodmapRating}
                  </MedsChip>
                </div>
              ))}
            </div>
          </div>
        </MedsPanel>

        <DonutCard
          label="Trigger foods"
          title="Food-symptom correlation"
          data={data.insights.triggerFoods.map((item) => ({
            name: item.foodName,
            value: Math.round(item.correlationRate * 100),
            color:
              item.correlationRate >= 0.7 ? '#FF453A' : item.correlationRate >= 0.45 ? '#FFB877' : '#22D3EE',
          }))}
          centerLabel={`${data.insights.triggerFoods.length} triggers`}
        />
      </div>

      <div className="meds-grid-2">
        <MedsPanel>
          <MedsSectionTitle label="Food diary" title="Recent meals" />
          <div style={{ overflowX: 'auto' }}>
            <table className="meds-table">
              <thead>
                <tr>
                  <th>Recorded</th>
                  <th>Meal</th>
                  <th>Foods</th>
                  <th>Rating</th>
                </tr>
              </thead>
              <tbody>
                {data.foodDiary.slice(0, 14).map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatClinicalDate(entry.eatenAt)}</td>
                    <td>{entry.mealType}</td>
                    <td>{entry.foodItems}</td>
                    <td>
                      <MedsChip tone={entry.fodmapRating === 'low' ? 'success' : entry.fodmapRating === 'moderate' ? 'warning' : 'danger'}>
                        {entry.fodmapRating}
                      </MedsChip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </MedsPanel>

        <MedsPanel tone="muted">
          <MedsSectionTitle label="Bristol scale" title="Recent stool logs" />
          <div className="meds-list">
            {data.stoolLogs.slice(0, 8).map((entry) => (
              <div key={entry.id} className="meds-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="meds-stack">
                  <strong style={{ fontSize: 15 }}>{formatClinicalDate(entry.loggedAt)}</strong>
                  <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 12 }}>
                    Urgency {entry.urgency}/5 · pain {entry.painLevel}/5
                  </span>
                </div>
                <MedsChip tone={entry.bristolType <= 2 || entry.bristolType >= 6 ? 'warning' : 'success'}>
                  Type {entry.bristolType}
                </MedsChip>
              </div>
            ))}
          </div>
        </MedsPanel>
      </div>

      <div className="meds-grid-2">
        <MedsPanel>
          <MedsSectionTitle label="Safe foods" title="Most tolerated foods" />
          <div className="meds-list">
            {data.insights.safeFoods.map((item) => (
              <div key={item.name} className="meds-row" style={{ justifyContent: 'space-between' }}>
                <span>{item.name}</span>
                <MedsChip tone="success">{item.servings} servings</MedsChip>
              </div>
            ))}
          </div>
        </MedsPanel>

        <MedsPanel tone="accent">
          <MedsSectionTitle label="Recent symptoms" title="Meal-linked symptoms" />
          <div className="meds-list">
            {data.insights.recentSymptoms.map((item) => (
              <div key={item.id} className="meds-stack">
                <div className="meds-row" style={{ justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 15 }}>{item.name}</strong>
                  <MedsChip tone={item.severity >= 4 ? 'danger' : 'warning'}>
                    {item.severity}/5
                  </MedsChip>
                </div>
                <span style={{ color: 'rgba(214,195,181,0.72)', fontSize: 12 }}>
                  {formatClinicalDate(item.loggedAt)} · {item.relatedMeals.join(' · ') || 'No meal match'}
                </span>
              </div>
            ))}
          </div>
        </MedsPanel>
      </div>
    </div>
  );
}
