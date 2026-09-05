import { fetchSurfSessions, fetchSurfSpots } from '../actions';
import { SURF_TEXT, SURF_TEXT_SECONDARY, SurfHero, SurfPanel } from '../ui';

export default async function SurfCrewPage() {
  const [sessions, spots] = await Promise.all([fetchSurfSessions({ limit: 8 }), fetchSurfSpots()]);

  const crew = spots.slice(0, 4).map((spot, index) => ({
    id: spot.id,
    name: ['Ari', 'Mika', 'Dev', 'Kai'][index] ?? `Crew ${index + 1}`,
    spot: spot.name,
    note: `${spot.breakType} local keeping tabs on ${spot.region}.`,
  }));

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <SurfHero
        eyebrow="Crew / Social"
        title="Shared stoke without the ad-tech feed."
        description="Keep tabs on your people, recent sessions, and invite codes from one calm desktop surface."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
        {crew.map((member) => (
          <div key={member.id} style={cardStyle}>
            <div style={avatarStyle}>{member.name[0]}</div>
            <strong style={{ color: SURF_TEXT }}>{member.name}</strong>
            <span style={{ color: SURF_TEXT_SECONDARY, fontSize: 13 }}>{member.note}</span>
            <span style={{ color: SURF_TEXT_SECONDARY, fontSize: 12 }}>Recent: {member.spot}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 16 }}>
        <SurfPanel eyebrow="Timeline" title="Shared Sessions">
          <div style={{ display: 'grid', gap: 10 }}>
            {sessions.map((session) => (
              <div key={session.id} style={rowStyle}>
                <strong style={{ color: SURF_TEXT }}>{spots.find((spot) => spot.id === session.spotId)?.name ?? 'Spot'}</strong>
                <span style={{ color: SURF_TEXT_SECONDARY }}>{session.durationMin} min</span>
                <span style={{ color: SURF_TEXT_SECONDARY }}>Rating {session.rating}/5</span>
                <span style={{ marginLeft: 'auto', color: SURF_TEXT_SECONDARY }}>
                  {new Date(session.sessionDate).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </SurfPanel>

        <SurfPanel eyebrow="Invite" title="Crew Access">
          <div style={tileStyle}>
            <span style={{ color: SURF_TEXT_SECONDARY }}>Invite code</span>
            <strong style={{ color: SURF_TEXT }}>SURF-POINT-47</strong>
          </div>
          <div style={tileStyle}>
            <span style={{ color: SURF_TEXT_SECONDARY }}>Share link</span>
            <strong style={{ color: SURF_TEXT }}>mylife.app/surf/crew</strong>
          </div>
        </SurfPanel>
      </div>
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

const cardStyle = {
  display: 'grid',
  gap: 10,
  padding: 18,
  borderRadius: 22,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
} as const;

const avatarStyle = {
  width: 42,
  height: 42,
  borderRadius: 999,
  display: 'grid',
  placeItems: 'center',
  background: 'color-mix(in srgb, var(--accent-surf) 20%, transparent)',
  color: SURF_TEXT,
  fontWeight: 800,
} as const;
