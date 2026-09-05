import React, { useState, useCallback } from 'react';
import { colors } from '../tokens/colors';

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

export interface ShareResult {
  shareId: string;
  delivered: boolean;
  transport: string | null;
}

export interface ShareButtonProps {
  moduleId: string;
  tableName: string;
  rowId: string;
  data: Record<string, unknown>;
  workspaceId?: string;
  onShare?: (result: ShareResult) => void;
  onPickContact?: () => Promise<{ deviceId: string; displayName: string } | null>;
  shareEntity?: (opts: {
    toDeviceId: string;
    moduleId: string;
    tableName: string;
    rowId: string;
    data: Record<string, unknown>;
    workspaceId?: string;
  }) => Promise<ShareResult>;
  style?: React.CSSProperties;
  disabled?: boolean;
  renderButton?: (props: {
    onPress: () => void;
    sharing: boolean;
    disabled: boolean;
  }) => React.ReactNode;
}

// ---------------------------------------------------------------------------
// Style tokens (Obsidian Noir, platform-agnostic CSSProperties)
// ---------------------------------------------------------------------------

const s = {
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    backgroundColor: colors.primary,
    color: '#0E0E13',
    transition: 'opacity 0.15s ease',
  } satisfies React.CSSProperties,

  btnDisabled: {
    opacity: 0.4,
    cursor: 'default',
  } satisfies React.CSSProperties,
} as const;

// ---------------------------------------------------------------------------
// ShareButton
// ---------------------------------------------------------------------------

export function ShareButton({
  moduleId,
  tableName,
  rowId,
  data,
  workspaceId,
  onShare,
  onPickContact,
  shareEntity,
  style,
  disabled = false,
  renderButton,
}: ShareButtonProps) {
  const [sharing, setSharing] = useState(false);

  const handlePress = useCallback(async () => {
    if (sharing || disabled || !onPickContact || !shareEntity) return;

    setSharing(true);
    try {
      const contact = await onPickContact();
      if (!contact) {
        setSharing(false);
        return;
      }

      const result = await shareEntity({
        toDeviceId: contact.deviceId,
        moduleId,
        tableName,
        rowId,
        data,
        workspaceId,
      });

      onShare?.(result);
    } catch {
      onShare?.({ shareId: '', delivered: false, transport: null });
    } finally {
      setSharing(false);
    }
  }, [sharing, disabled, onPickContact, shareEntity, moduleId, tableName, rowId, data, workspaceId, onShare]);

  if (renderButton) {
    return <>{renderButton({ onPress: handlePress, sharing, disabled })}</>;
  }

  const isDisabled = disabled || sharing || !onPickContact || !shareEntity;

  return (
    <button
      type="button"
      style={{
        ...s.btn,
        ...(isDisabled ? s.btnDisabled : {}),
        ...style,
      }}
      onClick={handlePress}
      disabled={isDisabled}
    >
      {sharing ? '...' : '↗'}
      {sharing ? 'Sharing...' : 'Share'}
    </button>
  );
}
