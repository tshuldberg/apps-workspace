'use client';

import type { ReactNode } from 'react';
import type { ModuleId } from '@mylife/module-registry';
import { WebModuleHeader } from './WebModuleHeader';
import { ModuleErrorBoundary } from './ModuleErrorBoundary';

/**
 * Shell meta-routes that reuse the module layout chrome but aren't registered
 * modules (e.g., the `/social` feed aggregates activity across modules).
 */
export type ShellRouteId = 'social';
export type ModuleLayoutId = ModuleId | ShellRouteId;

export interface WebModuleLayoutWrapperProps {
  moduleId: ModuleLayoutId;
  children: ReactNode;
  navLinks?: Array<{ href: string; label: string }>;
  maxWidth?: number;
  title?: string;
}

/**
 * Shared web module layout wrapper.
 * Applies consistent negative margin, header, and content container.
 */
export function WebModuleLayoutWrapper({
  moduleId,
  children,
  navLinks,
  maxWidth = 1200,
  title,
}: WebModuleLayoutWrapperProps) {
  return (
    <section
      style={{
        margin: '-32px',
        minHeight: '100vh',
        background: 'var(--background)',
        color: 'var(--text)',
      }}
    >
      <WebModuleHeader
        moduleId={moduleId}
        title={title}
        navLinks={navLinks}
        maxWidth={maxWidth}
      />
      <div style={{ margin: '0 auto', maxWidth, padding: '32px 24px 48px' }}>
        <ModuleErrorBoundary moduleId={moduleId as ModuleId} moduleName={title ?? moduleId}>
          {children}
        </ModuleErrorBoundary>
      </div>
    </section>
  );
}
