import { fetchPlannedRoutes, fetchTrails } from '../actions';
import { RouteBuilderClient } from '../route-builder-client';
import { TrailsHero, TrailsPanel, TrailsActionLink } from '../shell';

export default async function TrailsRoutesPage() {
  const [trails, plannedRoutes] = await Promise.all([fetchTrails({ limit: 8 }), fetchPlannedRoutes()]);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <TrailsHero
        eyebrow="Route Builder"
        title="Interactive desktop canvas for draft routes and waypoint-heavy missions."
        description="Phase 9 ships a web route builder that can sketch routes, save planned drafts, and pull in saved trails as anchors without leaving the trails shell."
        actions={
          <>
            <TrailsActionLink href="/trails/list" symbol="terrain">
              Open Trail Grid
            </TrailsActionLink>
            <TrailsActionLink href="/trails/segments" symbol="social_leaderboard" secondary>
              Compare Segments
            </TrailsActionLink>
          </>
        }
      />

      <TrailsPanel eyebrow="Builder" title="Click-To-Draw Route Drafting">
        <RouteBuilderClient trails={trails} existingRoutes={plannedRoutes} />
      </TrailsPanel>
    </div>
  );
}
