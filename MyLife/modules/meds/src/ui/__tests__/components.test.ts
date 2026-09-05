import { describe, expect, it } from 'vitest';
import {
  MD_BP_STATUS,
  MD_GLUCOSE_STATUS,
  MD_PAIN_LEVELS,
  resolveBPClassification,
  resolveGlucoseStatus,
  resolvePainLevel,
} from '../tokens';

describe('BPClassification', () => {
  it('classifies normal readings', () => {
    expect(resolveBPClassification(118, 76)).toEqual({
      tone: 'normal',
      label: 'Normal',
      color: MD_BP_STATUS.normal,
    });
  });

  it('classifies elevated readings', () => {
    expect(resolveBPClassification(124, 78)).toEqual({
      tone: 'elevated',
      label: 'Elevated',
      color: MD_BP_STATUS.elevated,
    });
  });

  it('classifies stage 1 readings', () => {
    expect(resolveBPClassification(132, 84)).toEqual({
      tone: 'stage1',
      label: 'Stage 1',
      color: MD_BP_STATUS.stage1,
    });
  });

  it('classifies stage 2 readings', () => {
    expect(resolveBPClassification(148, 94)).toEqual({
      tone: 'stage2',
      label: 'Stage 2',
      color: MD_BP_STATUS.stage2,
    });
  });

  it('classifies crisis readings', () => {
    expect(resolveBPClassification(184, 122)).toEqual({
      tone: 'crisis',
      label: 'Crisis',
      color: MD_BP_STATUS.crisis,
    });
  });
});

describe('GlucoseRange', () => {
  it('maps low glucose values to the low tone', () => {
    expect(resolveGlucoseStatus(65)).toEqual({
      tone: 'low',
      label: 'Low',
      color: MD_GLUCOSE_STATUS.low,
    });
  });

  it('maps in-range glucose values to the normal tone', () => {
    expect(resolveGlucoseStatus(112)).toEqual({
      tone: 'normal',
      label: 'Normal',
      color: MD_GLUCOSE_STATUS.normal,
    });
  });

  it('maps high glucose values to the high tone', () => {
    expect(resolveGlucoseStatus(212)).toEqual({
      tone: 'high',
      label: 'High',
      color: MD_GLUCOSE_STATUS.high,
    });
  });
});

describe('PainScale', () => {
  it('maps no pain correctly', () => {
    expect(resolvePainLevel(0)).toEqual({
      tone: 'none',
      label: 'None',
      color: MD_PAIN_LEVELS.none,
      value: 0,
    });
  });

  it('maps mild pain correctly', () => {
    expect(resolvePainLevel(3)).toEqual({
      tone: 'mild',
      label: 'Mild',
      color: MD_PAIN_LEVELS.mild,
      value: 3,
    });
  });

  it('maps moderate pain correctly', () => {
    expect(resolvePainLevel(5)).toEqual({
      tone: 'moderate',
      label: 'Moderate',
      color: MD_PAIN_LEVELS.moderate,
      value: 5,
    });
  });

  it('maps severe pain correctly', () => {
    expect(resolvePainLevel(8)).toEqual({
      tone: 'severe',
      label: 'Severe',
      color: MD_PAIN_LEVELS.severe,
      value: 8,
    });
  });

  it('maps worst pain correctly', () => {
    expect(resolvePainLevel(10)).toEqual({
      tone: 'worst',
      label: 'Worst',
      color: MD_PAIN_LEVELS.worst,
      value: 10,
    });
  });
});
