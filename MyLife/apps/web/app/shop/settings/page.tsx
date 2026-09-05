import type { CSSProperties } from 'react';
import { SHOP_MODULE } from '@mylife/shop';
import { ShopBulletList, ShopPanel } from '../_ui';

export default function ShopSettingsPage() {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <ShopPanel
        eyebrow="Settings"
        title="Tune the privacy boundary"
        body="Settings will manage alert windows, exports, and cross-module bridges while keeping shopping intent strictly local."
      >
        <ShopBulletList
          items={[
            'Return and warranty alert windows will be configurable here',
            'Bridge toggles for Budget, Friends, and Closet will be opt-in and easy to revoke',
            'Full local export of wishlists, purchases, and warranties lives here',
          ]}
        />
        <div style={versionStyles.versionBadge}>
          <span style={versionStyles.versionLabel}>MyShop</span>
          <span style={versionStyles.versionValue}>v{SHOP_MODULE.version}</span>
        </div>
      </ShopPanel>
    </div>
  );
}

const versionStyles: Record<string, CSSProperties> = {
  versionBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    borderRadius: 999,
    border: '1px solid rgba(16,185,129,0.28)',
    background: 'rgba(16,185,129,0.12)',
    alignSelf: 'flex-start',
    width: 'fit-content',
  },
  versionLabel: {
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  versionValue: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: 800,
  },
};
