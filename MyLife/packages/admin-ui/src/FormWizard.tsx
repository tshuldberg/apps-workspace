'use client';

import React, { useState, useCallback } from 'react';

export interface FormWizardStep {
  id: string;
  title: string;
  description?: string;
  content: React.ReactNode;
  validate?: () => boolean | Promise<boolean>;
}

export interface FormWizardProps {
  steps: FormWizardStep[];
  onComplete: () => void | Promise<void>;
  onCancel?: () => void;
  completeLabel?: string;
}

export function FormWizard({
  steps,
  onComplete,
  onCancel,
  completeLabel = 'Complete',
}: FormWizardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isValidating, setIsValidating] = useState(false);

  const currentStep = steps[currentIndex];
  const isLastStep = currentIndex === steps.length - 1;

  const handleNext = useCallback(async () => {
    if (!currentStep) return;

    if (currentStep.validate) {
      setIsValidating(true);
      const valid = await currentStep.validate();
      setIsValidating(false);
      if (!valid) return;
    }

    if (isLastStep) {
      await onComplete();
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }, [currentStep, isLastStep, onComplete]);

  const handleBack = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Step indicators */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          justifyContent: 'center',
        }}
      >
        {steps.map((step, i) => (
          <div
            key={step.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 600,
                background:
                  i < currentIndex
                    ? 'var(--accent)'
                    : i === currentIndex
                      ? 'var(--accent)'
                      : 'var(--glass-strong)',
                color:
                  i <= currentIndex ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.2s ease',
              }}
            >
              {i < currentIndex ? '✓' : i + 1}
            </div>
            <span
              style={{
                fontSize: '13px',
                color:
                  i === currentIndex ? 'var(--text)' : 'var(--text-secondary)',
                fontWeight: i === currentIndex ? 600 : 400,
              }}
            >
              {step.title}
            </span>
            {i < steps.length - 1 && (
              <div
                style={{
                  width: '24px',
                  height: '1px',
                  background: i < currentIndex ? 'var(--accent)' : 'var(--border)',
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div style={{ minHeight: '200px' }}>
        {currentStep?.description && (
          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '14px',
              marginBottom: '16px',
            }}
          >
            {currentStep.description}
          </p>
        )}
        {currentStep?.content}
      </div>

      {/* Navigation buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '16px',
          borderTop: '1px solid var(--border)',
        }}
      >
        <div>
          {onCancel && (
            <button
              onClick={onCancel}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Cancel
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {currentIndex > 0 && (
            <button
              onClick={handleBack}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text)',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={isValidating}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              cursor: isValidating ? 'wait' : 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              opacity: isValidating ? 0.7 : 1,
            }}
          >
            {isValidating ? '...' : isLastStep ? completeLabel : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
