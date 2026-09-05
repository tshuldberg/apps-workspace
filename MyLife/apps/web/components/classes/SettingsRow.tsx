'use client';

import type { CSSProperties, ReactNode } from 'react';

const CLASSES_ACCENT = 'var(--accent-classes, #3B82F6)';
const BORDER = 'var(--border)';
const SURFACE_ELEVATED = 'var(--surface-elevated)';
const TEXT = 'var(--text)';
const TEXT_SECONDARY = 'var(--text-secondary)';
const BACKGROUND = 'var(--background)';

export interface SettingsRowToggleProps {
  variant: 'toggle';
  label: string;
  description?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}

export interface SettingsRowSegmentedProps<T extends string | number> {
  variant: 'segmented';
  label: string;
  description?: string;
  options: ReadonlyArray<{ label: string; value: T }>;
  value: T;
  onChange: (next: T) => void;
}

export interface SettingsRowStepperProps {
  variant: 'stepper';
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (next: number) => void;
}

export interface SettingsRowChipsProps<T extends string | number> {
  variant: 'chips';
  label: string;
  description?: string;
  options: ReadonlyArray<{ label: string; value: T }>;
  values: T[];
  onChange: (next: T[]) => void;
}

export interface SettingsRowChildProps {
  variant: 'child';
  label: string;
  description?: string;
  children: ReactNode;
}

export type SettingsRowProps<T extends string | number = string> =
  | SettingsRowToggleProps
  | SettingsRowSegmentedProps<T>
  | SettingsRowStepperProps
  | SettingsRowChipsProps<T>
  | SettingsRowChildProps;

export function SettingsRow<T extends string | number = string>(
  props: SettingsRowProps<T>,
) {
  return (
    <div style={rowStyle}>
      <div style={copyStyle}>
        <div style={labelStyle}>{props.label}</div>
        {props.description ? <div style={descriptionStyle}>{props.description}</div> : null}
      </div>
      <div style={controlStyle}>{renderControl(props)}</div>
    </div>
  );
}

function renderControl<T extends string | number>(props: SettingsRowProps<T>) {
  switch (props.variant) {
    case 'toggle':
      return (
        <button
          type="button"
          role="switch"
          aria-checked={props.value}
          onClick={() => props.onChange(!props.value)}
          style={{
            ...togglePillStyle,
            background: props.value ? CLASSES_ACCENT : SURFACE_ELEVATED,
            borderColor: props.value ? CLASSES_ACCENT : BORDER,
          }}
        >
          <span
            style={{
              ...toggleKnobStyle,
              transform: props.value ? 'translateX(18px)' : 'translateX(0)',
            }}
          />
        </button>
      );
    case 'segmented':
      return (
        <div style={segmentRowStyle}>
          {props.options.map((option) => {
            const active = option.value === props.value;
            return (
              <button
                key={String(option.value)}
                type="button"
                onClick={() => props.onChange(option.value)}
                aria-pressed={active}
                style={{
                  ...pillButtonStyle,
                  background: active ? CLASSES_ACCENT : SURFACE_ELEVATED,
                  borderColor: active ? CLASSES_ACCENT : BORDER,
                  color: active ? BACKGROUND : TEXT_SECONDARY,
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      );
    case 'stepper':
      return (
        <div style={stepperRowStyle}>
          <button
            type="button"
            onClick={() => props.onChange(Math.max(props.min, props.value - props.step))}
            aria-label={`Decrease ${props.label}`}
            style={stepperButtonStyle}
          >
            −
          </button>
          <div style={stepperValueStyle}>
            {props.value}
            {props.unit ? ` ${props.unit}` : ''}
          </div>
          <button
            type="button"
            onClick={() => props.onChange(Math.min(props.max, props.value + props.step))}
            aria-label={`Increase ${props.label}`}
            style={stepperButtonStyle}
          >
            +
          </button>
        </div>
      );
    case 'chips':
      return (
        <div style={segmentRowStyle}>
          {props.options.map((option) => {
            const active = props.values.includes(option.value);
            return (
              <button
                key={String(option.value)}
                type="button"
                onClick={() => {
                  const exists = props.values.includes(option.value);
                  const next = exists
                    ? props.values.filter((item) => item !== option.value)
                    : [...props.values, option.value];
                  props.onChange(next);
                }}
                aria-pressed={active}
                style={{
                  ...pillButtonStyle,
                  background: active ? CLASSES_ACCENT : SURFACE_ELEVATED,
                  borderColor: active ? CLASSES_ACCENT : BORDER,
                  color: active ? BACKGROUND : TEXT_SECONDARY,
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      );
    case 'child':
      return <>{props.children}</>;
  }
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 16,
  padding: '14px 0',
  borderBottom: `1px solid ${BORDER}`,
};

const copyStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  flex: 1,
  paddingRight: 12,
};

const labelStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: TEXT,
};

const descriptionStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: '19px',
  color: TEXT_SECONDARY,
};

const controlStyle: CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'flex-end',
  maxWidth: '60%',
};

const segmentRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  justifyContent: 'flex-end',
};

const pillButtonStyle: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 999,
  border: `1px solid ${BORDER}`,
  background: SURFACE_ELEVATED,
  color: TEXT_SECONDARY,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const togglePillStyle: CSSProperties = {
  position: 'relative',
  width: 44,
  height: 26,
  borderRadius: 999,
  border: `1px solid ${BORDER}`,
  background: SURFACE_ELEVATED,
  cursor: 'pointer',
  padding: 2,
  transition: 'background 0.15s ease, border-color 0.15s ease',
};

const toggleKnobStyle: CSSProperties = {
  display: 'block',
  width: 18,
  height: 18,
  borderRadius: 999,
  background: '#FFFFFF',
  transition: 'transform 0.15s ease',
};

const stepperRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const stepperButtonStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 999,
  border: `1px solid ${BORDER}`,
  background: SURFACE_ELEVATED,
  color: TEXT,
  fontSize: 16,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const stepperValueStyle: CSSProperties = {
  minWidth: 72,
  textAlign: 'center',
  fontSize: 14,
  fontWeight: 600,
  color: TEXT,
};
