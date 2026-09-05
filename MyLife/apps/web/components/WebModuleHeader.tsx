'use client';

import Link from 'next/link';
import type { ModuleId } from '@mylife/module-registry';
import { MODULE_METADATA } from '@mylife/module-registry';
import type { ModuleLayoutId } from './WebModuleLayoutWrapper';

export interface WebModuleHeaderProps {
  moduleId: ModuleLayoutId;
  title?: string;
  navLinks?: Array<{ href: string; label: string }>;
  maxWidth?: number;
}

/**
 * Shared web module header with consistent height, padding, and typography.
 * Replaces per-module inline header implementations.
 */
export function WebModuleHeader({
  moduleId,
  title,
  navLinks,
  maxWidth = 1200,
}: WebModuleHeaderProps) {
  const meta = MODULE_METADATA[moduleId as ModuleId];
  const displayName = title ?? meta?.name ?? 'Module';
  const accent = `var(--accent-${moduleId})`;

  return (
    <header style={headerStyle}>
      <div style={{ ...innerStyle, maxWidth }}>
        <div>
          <Link
            href={`/${moduleId}`}
            style={{ color: accent, fontSize: 28, fontWeight: 800, textDecoration: 'none' }}
          >
            {displayName}
          </Link>
          {meta?.tagline && (
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
              {meta.tagline}
            </p>
          )}
        </div>
        {navLinks && navLinks.length > 0 && (
          <nav style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}

const headerStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--border)',
  backgroundColor: 'var(--glass-strong)',
  backdropFilter: 'blur(14px)',
};

const innerStyle: React.CSSProperties = {
  margin: '0 auto',
  padding: '18px 24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 20,
  flexWrap: 'wrap',
};
