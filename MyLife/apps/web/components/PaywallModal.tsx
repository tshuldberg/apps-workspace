'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ModuleId } from '@mylife/module-registry';
import { GA_MODULE_IDS } from '@mylife/module-registry';
import { PRODUCTS } from '@mylife/billing-config';
import type { ProductId } from '@mylife/entitlements';
import { usePayment } from './EntitlementsProvider';

interface PaywallModalProps {
  moduleId: ModuleId;
  moduleName: string;
  moduleIcon: string;
  accentColor: string;
  open: boolean;
  onClose: () => void;
  onPurchaseComplete?: () => void;
}

const FEATURES = [
  { icon: '\u{1F513}', label: `Unlock all ${GA_MODULE_IDS.length} modules` },
  { icon: '\u{1F4F1}', label: 'iOS, Android, and Web' },
  { icon: '\u{1F512}', label: 'Privacy-first, offline-capable' },
  { icon: '\u{267E}\u{FE0F}', label: 'One-time purchase, yours forever' },
  { icon: '\u{1F504}', label: 'Free updates for 1 year' },
];

/**
 * Modal paywall for web. Shown as an overlay when a user accesses
 * a premium module without an active purchase. Routes to Stripe Checkout.
 */
export function PaywallModal({
  moduleId,
  moduleName,
  moduleIcon,
  accentColor,
  open,
  onClose,
  onPurchaseComplete,
}: PaywallModalProps) {
  const { paymentService, refreshEntitlements } = usePayment();
  const [purchasing, setPurchasing] = useState<'hub' | 'standalone' | 'restore' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hubPrice = PRODUCTS.hubUnlock.price;
  const standalonePrice =
    moduleId in PRODUCTS.standaloneModules
      ? PRODUCTS.standaloneModules[moduleId as keyof typeof PRODUCTS.standaloneModules]?.price ?? null
      : null;

  const isLoading = purchasing !== null;

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    },
    [onClose, isLoading],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

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
        onClose();
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
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <div
      style={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div style={styles.modal}>
        {/* Close button */}
        <button
          style={styles.closeButton}
          onClick={onClose}
          disabled={isLoading}
          aria-label="Close"
        >
          &times;
        </button>

        {/* Module hero */}
        <div style={styles.hero}>
          <span style={styles.heroIcon}>{moduleIcon}</span>
          <h2 style={{ ...styles.heroTitle, color: accentColor }}>{moduleName}</h2>
          <p style={styles.heroSubtitle}>Part of MyLife Pro</p>
        </div>

        {/* Features */}
        <div style={styles.featureList}>
          {FEATURES.map((f) => (
            <div key={f.label} style={styles.featureRow}>
              <span style={styles.featureIcon}>{f.icon}</span>
              <span style={styles.featureLabel}>{f.label}</span>
            </div>
          ))}
        </div>

        {/* Hub unlock */}
        <button
          style={{
            ...styles.hubButton,
            backgroundColor: accentColor,
            opacity: isLoading ? 0.6 : 1,
          }}
          onClick={() => void handlePurchase('hub')}
          disabled={isLoading}
        >
          <div style={styles.buttonInner}>
            <div>
              <div style={styles.hubButtonTitle}>Unlock Everything</div>
              <div style={styles.hubButtonSubtitle}>All modules, one purchase</div>
            </div>
            <span style={styles.hubPrice}>${hubPrice.toFixed(2)}</span>
          </div>
        </button>

        {/* Standalone unlock */}
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
            <div style={styles.buttonInner}>
              <span>Just {moduleName}</span>
              <span style={{ fontWeight: 700 }}>${standalonePrice.toFixed(2)}</span>
            </div>
          </button>
        )}

        {/* Error */}
        {error && <p style={styles.errorText}>{error}</p>}

        {/* Footer */}
        <div style={styles.footer}>
          <button
            style={styles.linkButton}
            onClick={() => void handleRestore()}
            disabled={isLoading}
          >
            Restore Purchases
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 24,
  },
  modal: {
    position: 'relative',
    backgroundColor: 'var(--surface, #12121A)',
    borderRadius: 24,
    border: '1px solid var(--glass-border, rgba(255,255,255,0.10))',
    padding: 36,
    maxWidth: 440,
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary, rgba(240,240,245,0.65))',
    fontSize: 24,
    cursor: 'pointer',
    padding: '4px 8px',
    lineHeight: 1,
  },
  hero: {
    textAlign: 'center',
    marginBottom: 28,
  },
  heroIcon: {
    fontSize: 64,
    display: 'block',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 800,
    margin: '0 0 4px',
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'var(--text-secondary, rgba(240,240,245,0.65))',
    margin: 0,
  },
  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 28,
  },
  featureRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  featureIcon: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
    flexShrink: 0,
  },
  featureLabel: {
    fontSize: 15,
    color: 'var(--text, #F0F0F5)',
  },
  hubButton: {
    width: '100%',
    padding: '16px 20px',
    borderRadius: 16,
    border: 'none',
    cursor: 'pointer',
    marginBottom: 10,
    transition: 'opacity 0.15s',
  },
  buttonInner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hubButtonTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--background, #0A0A0F)',
    textAlign: 'left',
  },
  hubButtonSubtitle: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.5)',
    textAlign: 'left',
    marginTop: 2,
  },
  hubPrice: {
    fontSize: 22,
    fontWeight: 800,
    color: 'var(--background, #0A0A0F)',
  },
  standaloneButton: {
    width: '100%',
    padding: '14px 20px',
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    marginBottom: 10,
    fontSize: 15,
    fontWeight: 600,
    transition: 'opacity 0.15s',
  },
  errorText: {
    fontSize: 13,
    color: 'var(--danger, #FF453A)',
    textAlign: 'center',
    margin: '8px 0',
  },
  footer: {
    textAlign: 'center',
    marginTop: 8,
  },
  linkButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary, rgba(240,240,245,0.65))',
    fontSize: 13,
    cursor: 'pointer',
    padding: '8px 12px',
    fontWeight: 500,
  },
};
