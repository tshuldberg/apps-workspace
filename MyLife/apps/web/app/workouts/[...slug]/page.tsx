import { ModuleWebFallback } from '@/components/module-web-fallback';

const TITLE_MAP: Record<string, string> = {
  explore: 'Explore Exercises',
  progress: 'Progress',
  recordings: 'Form Recordings',
  plans: 'Plans',
  'plans/builder': 'Plan Builder',
  workouts: 'Workout Library',
  'workouts/builder': 'Workout Builder',
  pricing: 'Pricing',
  profile: 'Profile',
};

function resolveTitle(slug: string[]): string {
  const key = slug.join('/');
  if (key.startsWith('exercise/')) return 'Exercise Detail';
  if (key.startsWith('plans/')) return 'Plan Detail';
  if (key.startsWith('recordings/')) return 'Recording Detail';
  if (key.startsWith('workout/')) return 'Workout Session';
  return TITLE_MAP[key] ?? `MyWorkouts: ${key}`;
}

export default async function WorkoutsCatchAllPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const routePath = `/workouts/${slug.join('/')}`;

  return (
    <ModuleWebFallback
      moduleName="MyWorkouts"
      title={resolveTitle(slug)}
      routePath={routePath}
      summary="The archived MyWorkouts web app has been folded into MyLife. These routes stay live while the consolidated workouts web experience is completed inside the hub."
      accentColor="var(--accent-workouts)"
      primaryHref="/"
      primaryLabel="Open MyLife Hub"
      links={[
        { href: '/workouts/explore', label: 'Explore' },
        { href: '/workouts/progress', label: 'Progress' },
        { href: '/workouts/recordings', label: 'Recordings' },
      ]}
    />
  );
}
