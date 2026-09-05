'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { fetchRestaurant, updateRestaurantAction } from '../../../actions';

interface RestaurantDetail {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  neighborhood: string | null;
  cuisines: string | null;
  price_tier: number | null;
  website_url: string | null;
  resy_url: string | null;
  opentable_url: string | null;
  tock_url: string | null;
  yelp_url: string | null;
  instagram_handle: string | null;
  notes_md: string | null;
  is_wishlist: number;
  tags: Array<{ id: string; name: string; color: string | null; kind: string }>;
}

const ACCENT = '#DC2626';
const TEXT = 'var(--text)';
const TEXT_SEC = 'var(--text-secondary)';
const BORDER = 'var(--border)';

function parseCuisinesStr(cuisines: string | null): string {
  if (!cuisines) return '';
  try {
    const arr = JSON.parse(cuisines);
    return Array.isArray(arr) ? arr.join(', ') : cuisines;
  } catch {
    return cuisines;
  }
}

const PRICE_LABELS = ['', '$', '$$', '$$$', '$$$$'];

export default function EditRestaurantPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const restaurantId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [cuisinesText, setCuisinesText] = useState('');
  const [priceTier, setPriceTier] = useState(0);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [resyUrl, setResyUrl] = useState('');
  const [opentableUrl, setOpentableUrl] = useState('');
  const [tockUrl, setTockUrl] = useState('');
  const [yelpUrl, setYelpUrl] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [notesMd, setNotesMd] = useState('');
  const [isWishlist, setIsWishlist] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    void fetchRestaurant(restaurantId).then((data) => {
      if (cancelled || !data) return;
      const r = data as RestaurantDetail;
      setName(r.name);
      setAddress(r.address ?? '');
      setCity(r.city ?? '');
      setNeighborhood(r.neighborhood ?? '');
      setCuisinesText(parseCuisinesStr(r.cuisines));
      setPriceTier(r.price_tier ?? 0);
      setWebsiteUrl(r.website_url ?? '');
      setResyUrl(r.resy_url ?? '');
      setOpentableUrl(r.opentable_url ?? '');
      setTockUrl(r.tock_url ?? '');
      setYelpUrl(r.yelp_url ?? '');
      setInstagramHandle(r.instagram_handle ?? '');
      setNotesMd(r.notes_md ?? '');
      setIsWishlist(r.is_wishlist === 1);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [restaurantId]);

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Restaurant name is required.');
      return;
    }

    setSaving(true);

    const cuisinesArray = cuisinesText
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    try {
      await updateRestaurantAction(restaurantId, {
        name: name.trim(),
        address: address.trim() || null,
        city: city.trim() || null,
        neighborhood: neighborhood.trim() || null,
        cuisines: cuisinesArray.length > 0 ? JSON.stringify(cuisinesArray) : null,
        price_tier: priceTier > 0 ? priceTier : null,
        website_url: websiteUrl.trim() || null,
        resy_url: resyUrl.trim() || null,
        opentable_url: opentableUrl.trim() || null,
        tock_url: tockUrl.trim() || null,
        yelp_url: yelpUrl.trim() || null,
        instagram_handle: instagramHandle.trim() || null,
        notes_md: notesMd.trim() || null,
        is_wishlist: isWishlist ? 1 : 0,
      });
      router.push(`/dining/restaurant/${restaurantId}`);
    } catch {
      alert('Failed to save. Please try again.');
      setSaving(false);
    }
  };

  if (!loaded) {
    return <p style={{ color: TEXT_SEC, padding: 24 }}>Loading restaurant...</p>;
  }

  return (
    <div style={{ maxWidth: 640, display: 'grid', gap: 24 }}>
      {/* Breadcrumb */}
      <nav style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: TEXT_SEC }}>
        <Link href="/dining" style={{ color: TEXT_SEC, textDecoration: 'none' }}>Restaurants</Link>
        <span style={{ opacity: 0.4 }}>&gt;</span>
        <Link href={`/dining/restaurant/${restaurantId}`} style={{ color: TEXT_SEC, textDecoration: 'none' }}>{name || 'Detail'}</Link>
        <span style={{ opacity: 0.4 }}>&gt;</span>
        <span style={{ color: TEXT }}>Edit</span>
      </nav>

      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: TEXT }}>
        Edit Restaurant
      </h1>

      {/* Name */}
      <div>
        <label style={labelStyle}>NAME *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
          placeholder="Restaurant name"
        />
      </div>

      {/* Location */}
      <div>
        <label style={labelStyle}>ADDRESS</label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          style={inputStyle}
          placeholder="123 Main St"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <label style={labelStyle}>CITY</label>
          <input type="text" value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle} placeholder="City" />
        </div>
        <div>
          <label style={labelStyle}>NEIGHBORHOOD</label>
          <input type="text" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} style={inputStyle} placeholder="Neighborhood" />
        </div>
      </div>

      {/* Cuisines */}
      <div>
        <label style={labelStyle}>CUISINES</label>
        <input
          type="text"
          value={cuisinesText}
          onChange={(e) => setCuisinesText(e.target.value)}
          style={inputStyle}
          placeholder="Italian, Japanese, Mexican (comma-separated)"
        />
      </div>

      {/* Price */}
      <div>
        <label style={labelStyle}>PRICE</label>
        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          {[1, 2, 3, 4].map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => setPriceTier(priceTier === tier ? 0 : tier)}
              style={{
                padding: '10px 18px',
                borderRadius: 12,
                border: priceTier === tier ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`,
                backgroundColor: priceTier === tier ? ACCENT : 'transparent',
                color: priceTier === tier ? '#FFFFFF' : TEXT_SEC,
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              {PRICE_LABELS[tier]}
            </button>
          ))}
        </div>
      </div>

      {/* Wishlist toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>Wishlist</span>
        <button
          type="button"
          onClick={() => setIsWishlist(!isWishlist)}
          style={{
            padding: '6px 16px',
            borderRadius: 999,
            border: isWishlist ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`,
            backgroundColor: isWishlist ? ACCENT : 'transparent',
            color: isWishlist ? '#FFFFFF' : TEXT_SEC,
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {isWishlist ? 'On Wishlist' : 'Not on Wishlist'}
        </button>
      </div>

      {/* Notes */}
      <div>
        <label style={labelStyle}>NOTES</label>
        <textarea
          value={notesMd}
          onChange={(e) => setNotesMd(e.target.value)}
          rows={5}
          style={{ ...inputStyle, resize: 'vertical' }}
          placeholder="Your notes about this restaurant..."
        />
      </div>

      {/* External links section */}
      <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 20 }}>
        <p style={{ ...labelStyle, marginBottom: 16 }}>EXTERNAL LINKS</p>
        {[
          { label: 'Website', value: websiteUrl, setter: setWebsiteUrl, ph: 'https://...' },
          { label: 'Resy', value: resyUrl, setter: setResyUrl, ph: 'https://resy.com/...' },
          { label: 'OpenTable', value: opentableUrl, setter: setOpentableUrl, ph: 'https://opentable.com/...' },
          { label: 'Tock', value: tockUrl, setter: setTockUrl, ph: 'https://exploretock.com/...' },
          { label: 'Yelp', value: yelpUrl, setter: setYelpUrl, ph: 'https://yelp.com/...' },
          { label: 'Instagram', value: instagramHandle, setter: setInstagramHandle, ph: '@handle' },
        ].map((field) => (
          <div key={field.label} style={{ marginBottom: 12 }}>
            <label style={labelStyle}>{field.label.toUpperCase()}</label>
            <input
              type="text"
              value={field.value}
              onChange={(e) => field.setter(e.target.value)}
              style={inputStyle}
              placeholder={field.ph}
            />
          </div>
        ))}
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            flex: 1,
            padding: '14px 24px',
            borderRadius: 14,
            backgroundColor: ACCENT,
            border: 'none',
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: 16,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <Link
          href={`/dining/restaurant/${restaurantId}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '14px 24px',
            borderRadius: 14,
            border: `1px solid ${BORDER}`,
            backgroundColor: 'transparent',
            color: TEXT_SEC,
            fontWeight: 600,
            fontSize: 15,
            textDecoration: 'none',
          }}
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1,
  textTransform: 'uppercase' as const,
  color: 'var(--text-secondary)',
  marginBottom: 6,
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  backgroundColor: 'var(--surface-elevated, #2A292F)',
  color: 'var(--text)',
  fontSize: 15,
  outline: 'none',
};
