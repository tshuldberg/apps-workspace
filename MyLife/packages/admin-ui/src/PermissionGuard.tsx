'use client';

import React from 'react';

export interface PermissionGuardProps {
  children: React.ReactNode;
  allowedRoles: string[];
  currentRole: string;
  fallback?: React.ReactNode;
}

export function PermissionGuard({
  children,
  allowedRoles,
  currentRole,
  fallback = null,
}: PermissionGuardProps): React.ReactNode {
  if (allowedRoles.includes(currentRole)) {
    return children;
  }
  return fallback;
}
