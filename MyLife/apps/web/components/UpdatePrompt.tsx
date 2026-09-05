'use client';

import React, { useState } from 'react';
import { PRODUCTS } from '@mylife/billing-config';
import { useEntitlements, usePayment } from './EntitlementsProvider';

/**
 * Banner shown on the hub dashboard or settings when the user's
 * update entitlement has expired (past Year 1, no annual update purchased).
 *
 * The app still works, but the user won't receive updates until they renew.
 */
export function UpdatePrompt() {
  const entitlements = useEntitlements();
  const { paymentService, refreshEntitlements } = usePayment();
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only show when updates are NOT entitled and user has made at least one purchase
  if (entitlements.updateEntitled || !entitlements.purchaseDate) {
    return null;
  }

  const handleRenew = async () => {
    if (!paymentService) return;
    setPurchasing(true);
    setError(null);

    try {
      const result = await paymentService.purchase('mylife_annual_update');
      if (result.success) {
        await refreshEntitlements();
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div style={styles.banner}>
      <div style={styles.content}>
        <p style={styles.title}>Your update period has expired</p>
        <p style={styles.description}>
          Your app still works, but you will not receive new updates or features
          until you renew.
        </p>
        {error && <p style={styles.error}>{error}</p>}
      </div>
      <button
        style={{
          ...styles.renewButton,
          opacity: purchasing ? 0.6 : 1,
        }}
        onClick={() => void handleRenew()}
        disabled={purchasing}
      >
        {purchasing ? 'Processing...' : `Renew for $${PRODUCTS.annualUpdate.price.toFixed(2)}/year`}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  banner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    backgroundColor: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--danger)',
    padding: '16px 20px',
    marginBottom: '24px',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--text)',
    margin: '0 0 4px',
  },
  description: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    margin: 0,
    lineHeight: '1.4',
  },
  error: {
    fontSize: '13px',
    color: 'var(--danger)',
    margin: '4px 0 0',
  },
  renewButton: {
    flexShrink: 0,
    backgroundColor: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text)',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
    whiteSpace: 'nowrap',
  },
};
