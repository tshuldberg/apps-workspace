import Link from 'next/link';
import {
  CreateProjectSortBySchema,
  CreateProjectStatusSchema,
  CreateProjectTypeSchema,
} from '@mylife/create';
import { loadCreateProjectsView } from './data';
import {
  CREATE_PROJECT_SORT_OPTIONS,
  CREATE_PROJECT_STATUSES,
  CREATE_PROJECT_TYPES,
  CreateEmptyPanel,
  CreateHero,
  CreateMetricRow,
  CreateProjectCard,
  CreateSection,
  buttonStyle,
  filterPillStyle,
  formatCreateProjectStatus,
  formatCreateProjectType,
  textInputStyle,
} from './ui';

function readParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function buildProjectsHref({
  search,
  status,
  type,
  sortBy,
}: {
  search?: string;
  status?: string;
  type?: string;
  sortBy?: string;
}) {
  const params = new URLSearchParams();
  if (search) params.set('q', search);
  if (status) params.set('status', status);
  if (type) params.set('type', type);
  if (sortBy) params.set('sort', sortBy);
  const query = params.toString();
  return query ? `/create?${query}` : '/create';
}

export default async function CreateProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    status?: string | string[];
    type?: string | string[];
    sort?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const search = readParam(params.q)?.trim() || undefined;
  const status = CreateProjectStatusSchema.safeParse(readParam(params.status))
    .success
    ? CreateProjectStatusSchema.parse(readParam(params.status))
    : undefined;
  const type = CreateProjectTypeSchema.safeParse(readParam(params.type)).success
    ? CreateProjectTypeSchema.parse(readParam(params.type))
    : undefined;
  const sortBy = CreateProjectSortBySchema.safeParse(readParam(params.sort))
    .success
    ? CreateProjectSortBySchema.parse(readParam(params.sort))
    : 'updated_at';

  const { rows, stats } = loadCreateProjectsView({
    search,
    status,
    type,
    sortBy,
  });

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <CreateHero
        eyebrow="Phase 1B"
        title="Projects"
        body="The project board now runs on the typed MyCreate project schema. Search, filter, sort, and open any card for status changes and the linked progress timeline."
        actionHref="/create/project/add"
        actionLabel="Add Project"
      />

      <CreateMetricRow
        items={[
          { label: 'Total', value: String(stats.total) },
          { label: 'Active', value: String(stats.active) },
          { label: 'Due Soon', value: String(stats.dueSoon) },
          { label: 'Complete', value: String(stats.complete) },
        ]}
      />

      <CreateSection title="Search And Sort">
        <form method="get" style={{ display: 'grid', gap: 12 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 180px auto',
              gap: 12,
            }}
          >
            <input
              type="text"
              name="q"
              placeholder="Search by project title"
              defaultValue={search ?? ''}
              style={textInputStyle}
            />
            <select
              name="sort"
              defaultValue={sortBy}
              style={{ ...textInputStyle, appearance: 'auto' }}
            >
              {CREATE_PROJECT_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button type="submit" style={{ ...buttonStyle('primary'), cursor: 'pointer' }}>
              Apply
            </button>
          </div>
          <input type="hidden" name="status" value={status ?? ''} />
          <input type="hidden" name="type" value={type ?? ''} />
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Filters stay in the URL so the board can be shared or bookmarked while hidden.
          </div>
        </form>
      </CreateSection>

      <CreateSection title="Status Filter">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link
            href={buildProjectsHref({ search, type, sortBy })}
            style={filterPillStyle(!status)}
          >
            All
          </Link>
          {CREATE_PROJECT_STATUSES.map((value) => (
            <Link
              key={value}
              href={buildProjectsHref({ search, status: value, type, sortBy })}
              style={filterPillStyle(status === value)}
            >
              {formatCreateProjectStatus(value)}
            </Link>
          ))}
        </div>
      </CreateSection>

      <CreateSection title="Type Filter">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link
            href={buildProjectsHref({ search, status, sortBy })}
            style={filterPillStyle(!type)}
          >
            All
          </Link>
          {CREATE_PROJECT_TYPES.map((value) => (
            <Link
              key={value}
              href={buildProjectsHref({ search, status, type: value, sortBy })}
              style={filterPillStyle(type === value)}
            >
              {formatCreateProjectType(value)}
            </Link>
          ))}
        </div>
        {search || status || type ? (
          <div>
            <Link href="/create" style={buttonStyle('ghost')}>
              Clear filters
            </Link>
          </div>
        ) : null}
      </CreateSection>

      <CreateSection title="Project Cards">
        {rows.length === 0 ? (
          <CreateEmptyPanel
            title="No projects match"
            body={
              stats.total === 0
                ? 'Create the first project to start shaping briefs, deadlines, and future progress logs.'
                : 'Try clearing one of the filters or broadening the search term.'
            }
            actionHref={stats.total === 0 ? '/create/project/add' : '/create'}
            actionLabel={stats.total === 0 ? 'Add Project' : 'Reset Board'}
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            {rows.map((project) => (
              <CreateProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </CreateSection>
    </div>
  );
}
