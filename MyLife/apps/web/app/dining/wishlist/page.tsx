'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchWishlistRestaurants,
  toggleWishlistAction,
  fetchWatchlistEntries,
  createWatchlistAction,
  deleteWatchlistAction,
  fulfillWatchlistAction,
} from '../actions';

const ACCENT = '#DC2626';

type ActiveTab = 'wishlist' | 'watchlist';

interface WishlistRestaurant {
  id: string;
  name: string;
  neighborhood: string | null;
  city: string | null;
  cuisines: string | null;
  price_tier: number | null;
  visit_count: number;
  created_at: string;
}

interface WatchlistEntry {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  party_size: number;
  date_range_start: string | null;
  date_range_end: string | null;
  notify_enabled: number;
  notes: string | null;
  status: string;
  created_at: string;
}

const PRICE_LABELS = ['', '$', '$$', '$$$', '$$$$'];

function parseCuisines(cuisines: string | null): string[] {
  if (!cuisines) return [];
  try {
    return JSON.parse(cuisines);
  } catch {
    return [cuisines];
  }
}

export default function DiningWishlistPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('wishlist');
  const [restaurants, setRestaurants] = useState<WishlistRestaurant[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formRestaurantId, setFormRestaurantId] = useState('');
  const [formPartySize, setFormPartySize] = useState(2);
  const [formDateStart, setFormDateStart] = useState('');
  const [formDateEnd, setFormDateEnd] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const reload = useCallback(async () => {
    try {
      const [r, w] = await Promise.all([
        fetchWishlistRestaurants(),
        fetchWatchlistEntries(),
      ]);
      setRestaurants(r as WishlistRestaurant[]);
      setWatchlist(w as WatchlistEntry[]);
    } catch {
      // silently handle
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleRemoveWishlist = async (id: string) => {
    try {
      await toggleWishlistAction(id, 1);
      reload();
    } catch {
      // silently handle
    }
  };

  const handleDeleteWatch = async (id: string) => {
    try {
      await deleteWatchlistAction(id);
      reload();
    } catch {
      // silently handle
    }
  };

  const handleFulfill = async (id: string) => {
    try {
      await fulfillWatchlistAction(id);
      reload();
    } catch {
      // silently handle
    }
  };

  const handleSubmitWatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRestaurantId) return;
    try {
      await createWatchlistAction({
        restaurant_id: formRestaurantId,
        party_size: formPartySize,
        date_range_start: formDateStart || null,
        date_range_end: formDateEnd || null,
        notes: formNotes || null,
      });
      setShowForm(false);
      setFormRestaurantId('');
      setFormPartySize(2);
      setFormDateStart('');
      setFormDateEnd('');
      setFormNotes('');
      reload();
    } catch {
      // silently handle
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Wishlist & Watchlist</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Restaurants you want to try and reservations you are tracking
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--surface-elevated)' }}>
        {(['wishlist', 'watchlist'] as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            className="flex-1 py-3 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: activeTab === tab ? ACCENT : 'transparent',
              color: activeTab === tab ? '#FFFFFF' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'wishlist'
              ? `Wishlist (${restaurants.length})`
              : `Watchlist (${watchlist.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'wishlist' ? (
        <div className="space-y-3">
          {restaurants.length === 0 ? (
            <div
              className="rounded-xl border p-8 text-center"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--glass)' }}
            >
              <p className="text-4xl mb-3">{'\u2B50'}</p>
              <p className="font-medium mb-1">Your wishlist is empty</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Save restaurants you want to try. Tap the heart icon on any restaurant to add it here.
              </p>
            </div>
          ) : (
            restaurants.map((r) => {
              const cuisines = parseCuisines(r.cuisines);
              return (
                <div
                  key={r.id}
                  className="rounded-xl border p-4 flex items-start gap-4"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--glass)' }}
                >
                  <div className="flex-1">
                    <p className="font-semibold">{r.name}</p>
                    {(r.neighborhood || r.city) && (
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {[r.neighborhood, r.city].filter(Boolean).join(', ')}
                      </p>
                    )}
                    <div className="flex gap-3 mt-1 items-center flex-wrap">
                      {r.price_tier != null && (
                        <span className="text-sm font-semibold" style={{ color: ACCENT }}>
                          {PRICE_LABELS[r.price_tier]}
                        </span>
                      )}
                      {cuisines.slice(0, 2).map((c) => (
                        <span
                          key={c}
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: `${ACCENT}1A`, color: ACCENT }}
                        >
                          {c}
                        </span>
                      ))}
                      {r.visit_count === 0 && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: `${ACCENT}1A`, color: ACCENT }}
                        >
                          Never tried
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                      Added {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-xl"
                    style={{ color: ACCENT, background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => handleRemoveWishlist(r.id)}
                    title="Remove from wishlist"
                  >
                    {'\u2764\uFE0F'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: ACCENT, border: 'none', cursor: 'pointer' }}
              onClick={() => setShowForm(!showForm)}
            >
              {showForm ? 'Cancel' : '+ Add Watch'}
            </button>
          </div>

          {showForm && (
            <form
              onSubmit={handleSubmitWatch}
              className="rounded-xl border p-5 space-y-4"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--glass)' }}
            >
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Restaurant
                </label>
                {restaurants.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Add restaurants to your wishlist first
                  </p>
                ) : (
                  <select
                    value={formRestaurantId}
                    onChange={(e) => setFormRestaurantId(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{
                      backgroundColor: 'var(--surface-elevated)',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <option value="">Select a restaurant</option>
                    {restaurants.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Party Size
                </label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={formPartySize}
                  onChange={(e) => setFormPartySize(parseInt(e.target.value) || 2)}
                  className="w-24 rounded-lg px-3 py-2 text-sm"
                  style={{
                    backgroundColor: 'var(--surface-elevated)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={formDateStart}
                    onChange={(e) => setFormDateStart(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{
                      backgroundColor: 'var(--surface-elevated)',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{ color: 'var(--text-secondary)' }}>
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formDateEnd}
                    onChange={(e) => setFormDateEnd(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{
                      backgroundColor: 'var(--surface-elevated)',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Notes
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  placeholder="Any special requests..."
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{
                    backgroundColor: 'var(--surface-elevated)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    resize: 'vertical',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={!formRestaurantId}
                className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
                style={{ backgroundColor: ACCENT, border: 'none', cursor: formRestaurantId ? 'pointer' : 'default' }}
              >
                Save
              </button>
            </form>
          )}

          {watchlist.length === 0 && !showForm ? (
            <div
              className="rounded-xl border p-8 text-center"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--glass)' }}
            >
              <p className="text-4xl mb-3">{'\uD83D\uDD14'}</p>
              <p className="font-medium mb-1">No active watches</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Track reservation availability for your wishlist restaurants.
              </p>
            </div>
          ) : (
            watchlist.map((w) => (
              <div
                key={w.id}
                className="rounded-xl border p-4 flex items-start gap-4"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--glass)' }}
              >
                <div className="flex-1">
                  <p className="font-semibold">{w.restaurant_name}</p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Party of {w.party_size}
                  </p>
                  {(w.date_range_start || w.date_range_end) && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {w.date_range_start ?? '...'} to {w.date_range_end ?? '...'}
                    </p>
                  )}
                  {w.notes && (
                    <p className="text-xs mt-1 italic" style={{ color: 'var(--text-secondary)' }}>
                      {w.notes}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold"
                    style={{ backgroundColor: 'rgba(48,209,88,0.15)', color: '#30D158', border: 'none', cursor: 'pointer' }}
                    onClick={() => handleFulfill(w.id)}
                    title="Mark fulfilled"
                  >
                    {'\u2713'}
                  </button>
                  <button
                    type="button"
                    className="rounded-full w-8 h-8 flex items-center justify-center text-sm"
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}
                    onClick={() => handleDeleteWatch(w.id)}
                    title="Delete"
                  >
                    {'\u2715'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
