'use client';

import { useState, useMemo } from 'react';
import {
  evaluateAutoTags,
  hasAllergens,
  formatAllergenAlert,
  COMMON_ALLERGENS,
} from '@/lib/guests';
import type { RestaurantDinerProfile, DinerProfile, AutoTag } from '@/lib/guests';

// ---------- Mock data for UI development ----------

const MOCK_DINERS: (DinerProfile & { profile: RestaurantDinerProfile })[] = [
  {
    id: 'd1',
    email: 'jane@example.com',
    phone: '(555) 111-2222',
    display_name: 'Jane Chen',
    stripe_customer_id: null,
    default_payment_method_id: null,
    e2e_public_key: null,
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2026-04-18T00:00:00Z',
    profile: {
      id: 'p1',
      restaurant_id: 'r1',
      diner_id: 'd1',
      visit_count: 15,
      last_visit_at: '2026-04-18T19:00:00Z',
      lifetime_spend_cents: 450000,
      vip: true,
      banned: false,
      banned_reason: null,
      allergens: ['Shellfish', 'Peanuts'],
      preferences: { seating: 'window', occasion: 'date night' },
      notes: 'Prefers booth seating. Celebrates anniversary in June.',
      auto_tags: [],
      created_at: '2025-06-01T00:00:00Z',
    },
  },
  {
    id: 'd2',
    email: 'mark@example.com',
    phone: '(555) 333-4444',
    display_name: 'Mark Rivera',
    stripe_customer_id: null,
    default_payment_method_id: null,
    e2e_public_key: null,
    created_at: '2026-01-10T00:00:00Z',
    updated_at: '2026-04-10T00:00:00Z',
    profile: {
      id: 'p2',
      restaurant_id: 'r1',
      diner_id: 'd2',
      visit_count: 7,
      last_visit_at: '2026-04-10T20:00:00Z',
      lifetime_spend_cents: 21000,
      vip: false,
      banned: false,
      banned_reason: null,
      allergens: ['Gluten'],
      preferences: {},
      notes: null,
      auto_tags: [],
      created_at: '2026-01-10T00:00:00Z',
    },
  },
  {
    id: 'd3',
    email: 'sam@example.com',
    phone: null,
    display_name: 'Sam Okafor',
    stripe_customer_id: null,
    default_payment_method_id: null,
    e2e_public_key: null,
    created_at: '2026-04-15T00:00:00Z',
    updated_at: '2026-04-15T00:00:00Z',
    profile: {
      id: 'p3',
      restaurant_id: 'r1',
      diner_id: 'd3',
      visit_count: 1,
      last_visit_at: '2026-04-15T18:30:00Z',
      lifetime_spend_cents: 8500,
      vip: false,
      banned: false,
      banned_reason: null,
      allergens: [],
      preferences: {},
      notes: null,
      auto_tags: [],
      created_at: '2026-04-15T00:00:00Z',
    },
  },
  {
    id: 'd4',
    email: 'trouble@example.com',
    phone: '(555) 666-7777',
    display_name: 'Derek Trouble',
    stripe_customer_id: null,
    default_payment_method_id: null,
    e2e_public_key: null,
    created_at: '2025-08-01T00:00:00Z',
    updated_at: '2026-01-05T00:00:00Z',
    profile: {
      id: 'p4',
      restaurant_id: 'r1',
      diner_id: 'd4',
      visit_count: 3,
      last_visit_at: '2026-01-05T21:00:00Z',
      lifetime_spend_cents: 9500,
      vip: false,
      banned: true,
      banned_reason: 'Aggressive behavior toward staff',
      allergens: [],
      preferences: {},
      notes: 'Banned on 2026-01-05. Do not seat.',
      auto_tags: [],
      created_at: '2025-08-01T00:00:00Z',
    },
  },
  {
    id: 'd5',
    email: 'lina@example.com',
    phone: '(555) 888-9999',
    display_name: 'Lina Petrova',
    stripe_customer_id: null,
    default_payment_method_id: null,
    e2e_public_key: null,
    created_at: '2025-03-01T00:00:00Z',
    updated_at: '2025-12-20T00:00:00Z',
    profile: {
      id: 'p5',
      restaurant_id: 'r1',
      diner_id: 'd5',
      visit_count: 20,
      last_visit_at: '2025-12-20T19:00:00Z',
      lifetime_spend_cents: 120000,
      vip: false,
      banned: false,
      banned_reason: null,
      allergens: ['Dairy', 'Eggs', 'Soy'],
      preferences: { seating: 'quiet area' },
      notes: 'Long-time regular. Has not visited recently.',
      auto_tags: [],
      created_at: '2025-03-01T00:00:00Z',
    },
  },
];

// ---------- Filter types ----------

type FilterKey = 'vip' | 'allergens' | 'banned' | 'visits_1_5' | 'visits_5_plus' | 'visits_10_plus';

const FILTER_LABELS: Record<FilterKey, string> = {
  vip: 'VIP',
  allergens: 'Has Allergens',
  banned: 'Banned',
  visits_1_5: '1-5 Visits',
  visits_5_plus: '5+ Visits',
  visits_10_plus: '10+ Visits',
};

// ---------- Styles ----------

const cardStyle: React.CSSProperties = {
  background: 'var(--surface-low)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '16px',
  cursor: 'pointer',
  transition: 'background 0.15s',
};

const badgeBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '2px 8px',
  borderRadius: '999px',
  fontSize: '0.75rem',
  fontWeight: 600,
};

const tagColors: Record<string, { bg: string; color: string }> = {
  vip: { bg: 'rgba(255, 184, 119, 0.15)', color: 'var(--warm)' },
  regular: { bg: 'rgba(139, 207, 240, 0.15)', color: 'var(--info)' },
  big_spender: { bg: 'rgba(48, 209, 88, 0.15)', color: 'var(--success)' },
  new_guest: { bg: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)' },
  at_risk: { bg: 'rgba(220, 38, 38, 0.15)', color: 'var(--accent-light)' },
  wine_lover: { bg: 'rgba(180, 130, 220, 0.15)', color: '#C8A2E8' },
};

// ---------- Subcomponents ----------

function TagBadge({ tag }: { tag: AutoTag }) {
  const colors = tagColors[tag.tag] ?? tagColors.new_guest;
  const label = tag.tag.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span
      style={{ ...badgeBase, background: colors.bg, color: colors.color }}
      title={tag.reason}
    >
      {label}
    </span>
  );
}

function AllergenBadge({ allergen }: { allergen: string }) {
  return (
    <span style={{ ...badgeBase, background: 'rgba(220, 38, 38, 0.15)', color: 'var(--accent-light)' }}>
      {allergen}
    </span>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...badgeBase,
        padding: '5px 12px',
        fontSize: '0.8125rem',
        background: active ? 'var(--glass-strong)' : 'var(--glass)',
        color: active ? 'var(--text)' : 'var(--text-secondary)',
        border: `1px solid ${active ? 'var(--glass-border)' : 'var(--border)'}`,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function GuestDetail({
  diner,
  onToggleBan,
}: {
  diner: (typeof MOCK_DINERS)[0];
  onToggleBan: () => void;
}) {
  const { profile } = diner;
  const tags = evaluateAutoTags(profile);
  const allergenAlert = formatAllergenAlert(profile.allergens);
  const spendDisplay = `$${(profile.lifetime_spend_cents / 100).toFixed(2)}`;
  const avgCheck = profile.visit_count > 0
    ? `$${(profile.lifetime_spend_cents / profile.visit_count / 100).toFixed(2)}`
    : '$0.00';

  return (
    <div
      style={{
        background: 'var(--surface-mid)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '20px',
        marginTop: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Visit summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'Visits', value: profile.visit_count.toString() },
          { label: 'Lifetime Spend', value: spendDisplay },
          { label: 'Avg Check', value: avgCheck },
          {
            label: 'Last Visit',
            value: profile.last_visit_at
              ? new Date(profile.last_visit_at).toLocaleDateString()
              : 'Never',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: 'var(--glass)',
              borderRadius: '8px',
              padding: '12px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
              {stat.label}
            </div>
            <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Allergens */}
      {profile.allergens.length > 0 && (
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '6px' }}>
            Allergens
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
            {profile.allergens.map((a) => (
              <AllergenBadge key={a} allergen={a} />
            ))}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent-light)', fontWeight: 600 }}>
            {allergenAlert}
          </div>
        </div>
      )}

      {/* Auto-tags with explainability */}
      {tags.length > 0 && (
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '6px' }}>
            Auto-Tags
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {tags.map((tag) => (
              <div key={tag.tag} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TagBadge tag={tag} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {tag.reason}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preferences */}
      {Object.keys(profile.preferences).length > 0 && (
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '6px' }}>
            Preferences
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {Object.entries(profile.preferences)
              .map(([k, v]) => `${k}: ${v}`)
              .join(' | ')}
          </div>
        </div>
      )}

      {/* Notes */}
      {profile.notes && (
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '6px' }}>
            Notes
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
            {profile.notes}
          </div>
        </div>
      )}

      {/* Ban toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={onToggleBan}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            background: profile.banned ? 'var(--glass-strong)' : 'rgba(220, 38, 38, 0.15)',
            color: profile.banned ? 'var(--success)' : 'var(--accent-light)',
            border: `1px solid ${profile.banned ? 'rgba(48, 209, 88, 0.3)' : 'rgba(220, 38, 38, 0.3)'}`,
            cursor: 'pointer',
          }}
        >
          {profile.banned ? 'Unban Guest' : 'Ban Guest'}
        </button>
        {profile.banned && profile.banned_reason && (
          <span style={{ fontSize: '0.8125rem', color: 'var(--accent-light)' }}>
            Reason: {profile.banned_reason}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------- Main page ----------

export default function GuestsPage() {
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [guests, setGuests] = useState(MOCK_DINERS);

  const toggleFilter = (key: FilterKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filtered = useMemo(() => {
    return guests.filter((g) => {
      // Search
      if (search) {
        const q = search.toLowerCase();
        const match =
          g.display_name.toLowerCase().includes(q) ||
          (g.email && g.email.toLowerCase().includes(q)) ||
          (g.phone && g.phone.includes(q));
        if (!match) return false;
      }

      // Filters
      if (activeFilters.size > 0) {
        if (activeFilters.has('vip') && !g.profile.vip) return false;
        if (activeFilters.has('allergens') && !hasAllergens(g.profile)) return false;
        if (activeFilters.has('banned') && !g.profile.banned) return false;
        if (activeFilters.has('visits_1_5') && (g.profile.visit_count < 1 || g.profile.visit_count > 5))
          return false;
        if (activeFilters.has('visits_5_plus') && g.profile.visit_count < 5) return false;
        if (activeFilters.has('visits_10_plus') && g.profile.visit_count < 10) return false;
      }

      return true;
    });
  }, [guests, search, activeFilters]);

  const handleToggleBan = (dinerId: string) => {
    setGuests((prev) =>
      prev.map((g) =>
        g.id === dinerId
          ? { ...g, profile: { ...g.profile, banned: !g.profile.banned } }
          : g,
      ),
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>Guests</h1>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          {filtered.length} guest{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by name, email, or phone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          color: 'var(--text)',
          fontSize: '0.875rem',
          outline: 'none',
        }}
      />

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {(Object.keys(FILTER_LABELS) as FilterKey[]).map((key) => (
          <FilterPill
            key={key}
            label={FILTER_LABELS[key]}
            active={activeFilters.has(key)}
            onClick={() => toggleFilter(key)}
          />
        ))}
      </div>

      {/* Guest list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filtered.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No guests match your search or filters.
          </div>
        )}
        {filtered.map((g) => {
          const tags = evaluateAutoTags(g.profile);
          const isExpanded = expandedId === g.id;

          return (
            <div key={g.id}>
              <div
                onClick={() => setExpandedId(isExpanded ? null : g.id)}
                style={{
                  ...cardStyle,
                  background: isExpanded ? 'var(--surface-mid)' : cardStyle.background,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  {/* Left: name + contact */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 600 }}>{g.display_name}</span>
                      {g.profile.vip && <span title="VIP">&#128081;</span>}
                      {hasAllergens(g.profile) && (
                        <span
                          style={{ ...badgeBase, background: 'rgba(220, 38, 38, 0.15)', color: 'var(--accent-light)' }}
                          title={formatAllergenAlert(g.profile.allergens)}
                        >
                          Allergens
                        </span>
                      )}
                      {g.profile.banned && (
                        <span style={{ ...badgeBase, background: 'rgba(220, 38, 38, 0.25)', color: 'var(--accent-light)' }}>
                          Banned
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {[g.email, g.phone].filter(Boolean).join(' | ') || 'No contact info'}
                    </div>
                  </div>

                  {/* Right: visit stats + tags */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {g.profile.visit_count} visit{g.profile.visit_count !== 1 ? 's' : ''}
                      {g.profile.last_visit_at &&
                        ` | Last: ${new Date(g.profile.last_visit_at).toLocaleDateString()}`}
                    </div>
                    {tags.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {tags.map((tag) => (
                          <TagBadge key={tag.tag} tag={tag} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Expandable detail */}
              {isExpanded && (
                <GuestDetail diner={g} onToggleBan={() => handleToggleBan(g.id)} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
