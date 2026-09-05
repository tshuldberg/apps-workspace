import { describe, it, expect } from 'vitest';
import { suggestNextProtocol } from '../engines/protocol-progression';

describe('suggestNextProtocol', () => {
  it('suggests 18:6 after 7 consecutive successes on 16:8', () => {
    const result = suggestNextProtocol('16:8', 7);
    expect(result.suggestedProtocolId).toBe('18:6');
    expect(result.consecutiveSuccesses).toBe(7);
    expect(result.reason).toContain('Daily 18:6');
  });

  it('returns null suggestion when below threshold', () => {
    const result = suggestNextProtocol('16:8', 3);
    expect(result.suggestedProtocolId).toBeNull();
    expect(result.reason).toContain('4 more successful fasts');
  });

  it('follows full progression path', () => {
    expect(suggestNextProtocol('16:8', 7).suggestedProtocolId).toBe('18:6');
    expect(suggestNextProtocol('18:6', 7).suggestedProtocolId).toBe('20:4');
    expect(suggestNextProtocol('20:4', 7).suggestedProtocolId).toBe('23:1');
    expect(suggestNextProtocol('23:1', 7).suggestedProtocolId).toBe('36:0');
    expect(suggestNextProtocol('36:0', 7).suggestedProtocolId).toBe('48:0');
    expect(suggestNextProtocol('48:0', 7).suggestedProtocolId).toBe('72:0');
  });

  it('returns null for top-level protocol (72h)', () => {
    const result = suggestNextProtocol('72:0', 10);
    expect(result.suggestedProtocolId).toBeNull();
    expect(result.reason).toContain('most advanced protocol');
  });

  it('returns null for lateral protocol (5:2)', () => {
    const result = suggestNextProtocol('5:2', 10);
    expect(result.suggestedProtocolId).toBeNull();
    expect(result.reason).toContain('most advanced protocol');
  });

  it('returns null for unknown custom protocol', () => {
    const result = suggestNextProtocol('custom-my-plan', 10);
    expect(result.suggestedProtocolId).toBeNull();
  });

  it('supports custom threshold', () => {
    const result = suggestNextProtocol('16:8', 3, 3);
    expect(result.suggestedProtocolId).toBe('18:6');
  });

  it('does not suggest when exactly at threshold minus 1', () => {
    const result = suggestNextProtocol('16:8', 6);
    expect(result.suggestedProtocolId).toBeNull();
    expect(result.reason).toContain('1 more');
  });
});
