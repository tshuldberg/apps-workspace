'use client';

import React, { useState } from 'react';
import type { ModuleId } from '@mylife/module-registry';
import { PRODUCTS } from '@mylife/billing-config';
import type { ProductId } from '@mylife/entitlements';
import { usePayment } from './EntitlementsProvider';

interface PurchaseGateProps {
  moduleId: ModuleId;
  moduleName: string;
  moduleIcon: string;
  accentColor: string;
  onPurchaseComplete?: () => void;
}

/**
 * Purchase gate shown when a user taps a locked premium module (web).
 *
 * Offers two purchase options:
 * 1. Hub unlock ($19.99) -- unlocks all modules
 * 2. Standalone module unlock ($4.99) -- unlocks just this module
 *
 * Purchases redirect to Stripe Checkout and return to the module on success.
 */
export function PurchaseGate({
  moduleId,
  moduleName,
  moduleIcon,
  accentColor,
  onPurchaseComplete,
}: PurchaseGateProps) {
  const { paymentService, refreshEntitlements } = usePayment();
  const [purchasing, setPurchasing] = useState<'hub' | 'standalone' | 'restore' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hubPrice = PRODUCTS.hubUnlock.price;
  const standalonePrice =
    moduleId !== 'fast' && moduleId in PRODUCTS.standaloneModules
      ? PRODUCTS.standaloneModules[moduleId as keyof typeof PRODUCTS.standaloneModules].price
      : null;

  const handlePurchase = async (type: 'hub' | 'standalone') => {
    if (!paymentService) return;
    setPurchasing(type);
    setError(null);

    try {
      const productId: ProductId =
        type === 'hub'
          ? 'mylife_hub_unlock'
          : (`mylife_${moduleId}_unlock` as ProductId);

      const result = await paymentService.purchase(productId);
      if (result.success) {
        await refreshEntitlements();
        onPurchaseComplete?.();
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setPurchasing(null);
    }
  };

  const handleRestore = async () => {
    if (!paymentService) return;
    setPurchasing('restore');
    setError(null);

    try {
      await paymentService.restore();
      await refreshEntitlements();
      onPurchaseComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setPurchasing(null);
    }
  };

  const isLoading = purchasing !== null;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={styles.icon}>{moduleIcon}</span>
          <h2 style={styles.moduleName}>{moduleName}</h2>
          <p style={styles.subtitle}>This module requires a purchase to unlock.</p>
        </div>

        {/* Hub unlock button */}
        <button
          style={{
            ...styles.purchaseButton,
            backgroundColor: accentColor,
            opacity: isLoading ? 0.6 : 1,
          }}
          onClick={() => void handlePurchase('hub')}
          disabled={isLoading}
        >
          <span style={styles.purchaseButtonText}>Unlock All Modules</span>
          <span style={styles.priceText}>${hubPrice.toFixed(2)}</span>
        </button>

        {/* Standalone unlock button */}
        {standalonePrice !== null && (
          <button
            style={{
              ...styles.standaloneButton,
              borderColor: accentColor,
              color: accentColor,
              opacity: isLoading ? 0.6 : 1,
            }}
            onClick={() => void handlePurchase('standalone')}
            disabled={isLoading}
          >
            <span>Unlock {moduleName}</span>
            <span style={{ fontWeight: 700 }}>${standalonePrice.toFixed(2)}</span>
          </button>
        )}

        {/* Error message */}
        {error && <p style={styles.error}>{error}</p>}

        {/* Restore purchases */}
        <button
          style={styles.restoreButton}
          onClick={() => void handleRestore()}
          disabled={isLoading}
        >
          Restore Purchases
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '32px',
    minHeight: '400px',
  },
  card: {
    backgroundColor: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    padding: '32px',
    maxWidth: '420px',
    width: '100%',
    textAlign: 'center',
  },
  header: {
    marginBottom: '24px',
  },
  icon: {
    fontSize: '56px',
    display: 'block',
    marginBottom: '8px',
  },
  moduleName: {
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--text)',
    margin: '0 0 4px',
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  purchaseButton: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    cursor: 'pointer',
    marginBottom: '8px',
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--background)',
    transition: 'opacity 0.15s',
  },
  purchaseButtonText: {
    fontWeight: 600,
  },
  priceText: {
    fontWeight: 700,
  },
  standaloneButton: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderRadius: 'var(--radius-md)',
    borderWidth: '1px',
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    marginBottom: '8px',
    fontSize: '16px',
    fontWeight: 600,
    transition: 'opacity 0.15s',
  },
  error: {
    fontSize: '13px',
    color: 'var(--danger)',
    margin: '8px 0',
  },
  restoreButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    cursor: 'pointer',
    padding: '8px',
    marginTop: '4px',
  },
};
