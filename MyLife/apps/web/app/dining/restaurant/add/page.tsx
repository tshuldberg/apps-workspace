'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { addRestaurant, getCuisineTags, addCustomTag } from '../../actions';
import {
  parseRestaurantUrl,
  isValidUrl,
  platformToUrlField,
} from '@mylife/dining';
import type { Tag, CreateRestaurantInput, Platform } from '@mylife/dining';

const ACCENT = '#DC2626';
const ACCENT_DIM = 'rgba(220,38,38,0.15)';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const TEXT_TER = 'var(--text-tertiary)';
const SURFACE = 'var(--surface)';
const SURFACE_EL = 'var(--surface-elevated)';
const BORDER = 'var(--border)';
const DANGER = 'var(--danger)';

const PRICE_TIERS = ['$', '$$', '$$$', '$$$$'] as const;

export default function AddRestaurantPage() {
  const router = useRouter();

  // URL parsing
  const [urlInput, setUrlInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedPlatform, setParsedPlatform] = useState<Platform | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [priceTier, setPriceTier] = useState<number | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [notes, setNotes] = useState('');
  const [isWishlist, setIsWishlist] = useState(false);
  const [isPetFriendly, setIsPetFriendly] = useState(false);

  // Platform URLs
  const [platformUrls, setPlatformUrls] = useState<Record<string, string>>({});

  // Tags
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [newTagName, setNewTagName] = useState('');

  // Saving
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load tags on mount
  useEffect(() => {
    getCuisineTags()
      .then(setAllTags)
      .catch(() => {
        // Tags will load empty; user can still add restaurants
      });
  }, []);

  // Handle URL input
  const handleUrlParse = useCallback(async () => {
    const trimmed = urlInput.trim();
    if (!trimmed || !isValidUrl(trimmed)) return;

    setIsParsing(true);
    try {
      const parsed = await parseRestaurantUrl(trimmed);
      setParsedPlatform(parsed.platform);

      if (parsed.name && !name) setName(parsed.name);
      if (parsed.address && !address) setAddress(parsed.address);
      if (parsed.city && !city) setCity(parsed.city);
      if (parsed.website && !websiteUrl) setWebsiteUrl(parsed.website);

      if (parsed.platformUrl) {
        const field = platformToUrlField(parsed.platform);
        if (field) {
          setPlatformUrls((prev) => ({ ...prev, [field]: parsed.platformUrl! }));
        }
      }

      // Auto-select matching cuisine tags
      if (parsed.cuisines && parsed.cuisines.length > 0) {
        const matchingIds = new Set<string>();
        for (const cuisine of parsed.cuisines) {
          const lower = cuisine.toLowerCase();
          const found = allTags.find((t) => t.name.toLowerCase() === lower);
          if (found) matchingIds.add(found.id);
        }
        if (matchingIds.size > 0) {
          setSelectedTagIds((prev) => new Set([...prev, ...matchingIds]));
        }
      }
    } finally {
      setIsParsing(false);
    }
  }, [urlInput, name, address, city, websiteUrl, allTags]);

  useEffect(() => {
    if (isValidUrl(urlInput.trim()) && urlInput.trim().length > 10) {
      void handleUrlParse();
    }
  }, [urlInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTag = useCallback((tagId: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  }, []);

  const handleCreateTag = useCallback(async () => {
    const trimmed = newTagName.trim();
    if (!trimmed) return;

    const existing = allTags.find(
      (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) {
      setSelectedTagIds((prev) => new Set([...prev, existing.id]));
      setNewTagName('');
      return;
    }

    try {
      const tag = await addCustomTag({ name: trimmed, kind: 'cuisine', color: null });
      setAllTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedTagIds((prev) => new Set([...prev, tag.id]));
      setNewTagName('');
    } catch {
      setError('Failed to create tag');
    }
  }, [newTagName, allTags]);

  const handleSave = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName || isSaving) return;

    setIsSaving(true);
    setError(null);

    try {
      const input: CreateRestaurantInput = {
        name: trimmedName,
        address: address.trim() || null,
        city: city.trim() || null,
        neighborhood: neighborhood.trim() || null,
        price_tier: priceTier,
        website_url: websiteUrl.trim() || null,
        instagram_handle: instagramHandle.trim() || null,
        notes_md: notes.trim() || null,
        is_wishlist: isWishlist ? 1 : 0,
        resy_url: platformUrls.resy_url || null,
        opentable_url: platformUrls.opentable_url || null,
        tock_url: platformUrls.tock_url || null,
        yelp_url: platformUrls.yelp_url || null,
      };

      const finalTagIds = [...selectedTagIds];

      // Add Pet-Friendly tag if toggled
      if (isPetFriendly) {
        try {
          const petTag = await addCustomTag({ name: 'Pet-Friendly', kind: 'vibe', color: '#30D158' });
          finalTagIds.push(petTag.id);
        } catch {
          // Tag may already exist; try to find it in allTags or proceed without
        }
      }

      await addRestaurant(input, finalTagIds);
      router.push('/dining');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save restaurant');
    } finally {
      setIsSaving(false);
    }
  }, [
    name, address, city, neighborhood, priceTier, websiteUrl,
    instagramHandle, notes, isWishlist, isPetFriendly, platformUrls,
    selectedTagIds, isSaving, router,
  ]);

  const canSave = name.trim().length > 0 && !isSaving;

  const inputStyle = {
    width: '100%' as const,
    padding: '12px 14px',
    borderRadius: 12,
    border: `1px solid ${BORDER}`,
    backgroundColor: SURFACE,
    color: TEXT,
    fontSize: 15,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box' as const,
  };

  const labelStyle = {
    fontSize: 11,
    fontWeight: 700 as const,
    letterSpacing: 1.2,
    color: TEXT_TER,
    textTransform: 'uppercase' as const,
    marginBottom: 8,
    display: 'block' as const,
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <button
          type="button"
          onClick={() => router.push('/dining')}
          style={{
            background: 'none',
            border: 'none',
            color: ACCENT,
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            padding: 0,
          }}
        >
          Cancel
        </button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: TEXT }}>
          Add Restaurant
        </h1>
        <div style={{ width: 50 }} />
      </div>

      {/* Error Banner */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            border: `1px solid ${DANGER}`,
            backgroundColor: 'rgba(220,38,38,0.08)',
            color: DANGER,
            fontSize: 14,
            marginBottom: 20,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gap: 24 }}>
        {/* URL Paste */}
        <div>
          <label style={labelStyle}>Paste a link</label>
          <div style={{ position: 'relative' }}>
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Resy, OpenTable, Tock, Yelp, or Google Maps"
              style={inputStyle}
            />
            {isParsing && (
              <div
                style={{
                  position: 'absolute',
                  right: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: ACCENT,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Parsing...
              </div>
            )}
          </div>
          {parsedPlatform && parsedPlatform !== 'unknown' && (
            <div style={{ fontSize: 12, color: ACCENT, fontWeight: 600, marginTop: 6, textTransform: 'capitalize' }}>
              Detected: {parsedPlatform.replace('_', ' ')}
            </div>
          )}
        </div>

        {/* Name */}
        <div>
          <label style={labelStyle}>Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Restaurant name"
            style={inputStyle}
          />
        </div>

        {/* Address */}
        <div>
          <label style={labelStyle}>Address</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street address"
            style={inputStyle}
          />
        </div>

        {/* City + Neighborhood */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>City</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Neighborhood</label>
            <input
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              placeholder="Neighborhood"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Price Tier */}
        <div>
          <label style={labelStyle}>Price</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {PRICE_TIERS.map((label, idx) => {
              const tier = idx + 1;
              const active = priceTier === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setPriceTier(active ? null : tier)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 10,
                    border: active ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`,
                    backgroundColor: active ? ACCENT : SURFACE,
                    color: active ? '#FFFFFF' : TEXT_SEC,
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cuisine Tags */}
        <div>
          <label style={labelStyle}>Cuisine Tags</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {allTags.map((tag) => {
              const active = selectedTagIds.has(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 999,
                    border: active ? `1px solid ${tag.color ?? ACCENT}` : `1px solid ${BORDER}`,
                    backgroundColor: active ? (tag.color ?? ACCENT) : 'transparent',
                    color: active ? '#FFFFFF' : TEXT_SEC,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleCreateTag();
                }
              }}
              placeholder="Add custom tag..."
              style={{ ...inputStyle, flex: 1 }}
            />
            {newTagName.trim().length > 0 && (
              <button
                type="button"
                onClick={() => void handleCreateTag()}
                style={{
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: 'none',
                  backgroundColor: ACCENT,
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                Add
              </button>
            )}
          </div>
        </div>

        {/* Website */}
        <div>
          <label style={labelStyle}>Website</label>
          <input
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://..."
            style={inputStyle}
          />
        </div>

        {/* Instagram */}
        <div>
          <label style={labelStyle}>Instagram</label>
          <input
            value={instagramHandle}
            onChange={(e) => setInstagramHandle(e.target.value)}
            placeholder="@handle"
            style={inputStyle}
          />
        </div>

        {/* Notes */}
        <div>
          <label style={labelStyle}>Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What to order, who recommended it..."
            rows={4}
            style={{
              ...inputStyle,
              resize: 'vertical' as const,
              minHeight: 100,
            }}
          />
        </div>

        {/* Wishlist Toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: SURFACE_EL,
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>Add to wishlist</div>
            <div style={{ fontSize: 13, color: TEXT_TER, marginTop: 2 }}>
              Mark as a place you want to try
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsWishlist(!isWishlist)}
            role="switch"
            aria-checked={isWishlist}
            style={{
              width: 48,
              height: 28,
              borderRadius: 14,
              border: 'none',
              backgroundColor: isWishlist ? ACCENT : 'rgba(255,255,255,0.10)',
              position: 'relative',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: '#FFFFFF',
                position: 'absolute',
                top: 3,
                left: isWishlist ? 23 : 3,
                transition: 'left 0.2s',
              }}
            />
          </button>
        </div>

        {/* Pet-Friendly Toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: SURFACE_EL,
            borderRadius: 12,
            padding: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>{'\uD83D\uDC3E'} Pet-Friendly</div>
            <div style={{ fontSize: 13, color: TEXT_TER, marginTop: 2 }}>
              This restaurant welcomes pets
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsPetFriendly(!isPetFriendly)}
            role="switch"
            aria-checked={isPetFriendly}
            style={{
              width: 48,
              height: 28,
              borderRadius: 14,
              border: 'none',
              backgroundColor: isPetFriendly ? '#30D158' : 'rgba(255,255,255,0.10)',
              position: 'relative',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: '#FFFFFF',
                position: 'absolute',
                top: 3,
                left: isPetFriendly ? 23 : 3,
                transition: 'left 0.2s',
              }}
            />
          </button>
        </div>

        {/* Save Button */}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSave}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: 14,
            border: 'none',
            backgroundColor: canSave ? ACCENT : ACCENT_DIM,
            color: '#FFFFFF',
            fontSize: 16,
            fontWeight: 700,
            cursor: canSave ? 'pointer' : 'default',
            fontFamily: 'inherit',
            opacity: canSave ? 1 : 0.5,
            marginBottom: 40,
          }}
        >
          {isSaving ? 'Saving...' : 'Save Restaurant'}
        </button>
      </div>
    </div>
  );
}
