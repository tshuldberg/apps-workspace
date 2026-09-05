'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { fetchPeopleByCities } from './actions';

const TEXT = 'var(--text, #E4E1E9)';
const TEXT_SEC = 'var(--text-secondary, #D6C3B5)';
const BORDER = 'var(--border, rgba(255,255,255,0.06))';
const GLASS = 'var(--glass, rgba(255,255,255,0.03))';
const ACCENT = '#8BCFF0';

export default function CitiesPage() {
  const [groups, setGroups] = useState<
    Record<string, Array<{ id: string; display_name: string }>>
  >({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchPeopleByCities();
      setGroups(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleCity = (city: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(city)) {
        next.delete(city);
      } else {
        next.add(city);
      }
      return next;
    });
  };

  const cities = Object.keys(groups).sort();

  if (loading) {
    return <div style={{ padding: 32, color: TEXT_SEC }}>Loading...</div>;
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 720 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link
          href="/friends"
          style={{ color: TEXT, textDecoration: 'none', fontSize: 20 }}
        >
          {'\u2190'}
        </Link>
        <div>
          <h1 style={{ color: TEXT, fontSize: 20, fontWeight: 700, margin: 0 }}>
            People by City
          </h1>
          <p style={{ color: TEXT_SEC, fontSize: 13, margin: '2px 0 0', fontStyle: 'italic' }}>
            Who can I see in...?
          </p>
        </div>
      </div>

      {/* City groups */}
      {cities.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 48 }}>
          <p style={{ color: TEXT_SEC, fontWeight: 600 }}>No cities yet</p>
          <p style={{ color: '#9F8E81', fontSize: 13, marginTop: 4 }}>
            Add a city to a friend or log a move event
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cities.map((city) => {
            const people = groups[city];
            const isExpanded = expanded.has(city);

            return (
              <div key={city}>
                <button
                  onClick={() => toggleCity(city)}
                  style={{
                    width: '100%',
                    background: GLASS,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 14,
                    padding: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 20 }}>{'\uD83D\uDCCD'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: TEXT, fontWeight: 700, fontSize: 16 }}>
                      {city}
                    </div>
                    <div style={{ color: TEXT_SEC, fontSize: 12, marginTop: 2 }}>
                      {people.length} {people.length === 1 ? 'person' : 'people'}
                    </div>
                  </div>
                  <span style={{ color: TEXT_SEC, fontSize: 16 }}>
                    {isExpanded ? '\u2303' : '\u2304'}
                  </span>
                </button>

                {isExpanded && (
                  <div style={{ paddingLeft: 48, paddingRight: 20 }}>
                    {people.map((person) => (
                      <Link
                        key={person.id}
                        href={`/friends/${person.id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 0',
                          textDecoration: 'none',
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            background: ACCENT,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ color: TEXT, fontSize: 15 }}>
                          {person.display_name}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
