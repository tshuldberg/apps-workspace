'use client';

import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import Link from 'next/link';
import type { ModuleId } from '@mylife/module-registry';

interface ModuleErrorBoundaryProps {
  moduleId: ModuleId;
  moduleName: string;
  children: ReactNode;
}

interface ModuleErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ModuleErrorBoundary extends Component<
  ModuleErrorBoundaryProps,
  ModuleErrorBoundaryState
> {
  constructor(props: ModuleErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ModuleErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // TODO: Wire Sentry reporting (Phase 5)
    // Sentry.captureException(error, { extra: { moduleId: this.props.moduleId, componentStack: errorInfo.componentStack } });
    console.error(
      `[${this.props.moduleName}] Render error:`,
      error,
      errorInfo.componentStack,
    );
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            padding: 32,
          }}
        >
          <div
            style={{
              maxWidth: 480,
              width: '100%',
              padding: 32,
              borderRadius: 20,
              backgroundColor: 'var(--surface, #12121A)',
              border: '1px solid var(--glass-border, rgba(255,255,255,0.10))',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                margin: '0 auto 20px',
                borderRadius: 16,
                backgroundColor: 'rgba(255,69,58,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
              }}
            >
              !
            </div>

            <h2
              style={{
                margin: '0 0 8px',
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--text, #F0F0F5)',
              }}
            >
              {this.props.moduleName} ran into a problem
            </h2>

            <p
              style={{
                margin: '0 0 24px',
                fontSize: 14,
                lineHeight: 1.6,
                color: 'var(--text-secondary, rgba(240,240,245,0.65))',
              }}
            >
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={this.handleRetry}
                style={{
                  padding: '10px 20px',
                  borderRadius: 999,
                  border: 'none',
                  backgroundColor: 'var(--danger, #FF453A)',
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Try Again
              </button>
              <Link
                href="/"
                style={{
                  padding: '10px 20px',
                  borderRadius: 999,
                  border: '1px solid var(--glass-border, rgba(255,255,255,0.10))',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary, rgba(240,240,245,0.65))',
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                Back to Hub
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
