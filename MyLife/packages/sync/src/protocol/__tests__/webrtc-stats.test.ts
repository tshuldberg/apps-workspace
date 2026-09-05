import { describe, expect, it } from 'vitest';
import { selectedWebRtcTransport } from '../webrtc-stats';

function reports(local = 'host', remote = 'host'): Record<string, unknown>[] {
  return [
    { id: 'transport', type: 'transport', selectedCandidatePairId: 'pair' },
    { id: 'pair', type: 'candidate-pair', localCandidateId: 'local', remoteCandidateId: 'remote' },
    { id: 'local', type: 'local-candidate', candidateType: local },
    { id: 'remote', type: 'remote-candidate', candidateType: remote },
  ];
}

describe('selected WebRTC transport', () => {
  it.each([['host', 'srflx', 'direct'], ['relay', 'host', 'turn'], ['host', 'relay', 'turn']])(
    'classifies the selected %s/%s path as %s', (local, remote, expected) => {
      expect(selectedWebRtcTransport(reports(local, remote).reverse())).toBe(expected);
    },
  );
  it('ignores succeeded or nominated pairs that were not selected', () => {
    expect(selectedWebRtcTransport([...reports(), { id: 'other', type: 'candidate-pair', state: 'succeeded', nominated: true, localCandidateType: 'relay' }])).toBe('direct');
    expect(selectedWebRtcTransport([{ type: 'candidate-pair', state: 'succeeded', nominated: true, localCandidateType: 'relay' }])).toBeUndefined();
  });
  it('does not infer a direct path from missing or unknown candidate information', () => {
    expect(selectedWebRtcTransport(reports().slice(0, 3))).toBeUndefined();
    expect(selectedWebRtcTransport(reports('unknown'))).toBeUndefined();
    expect(selectedWebRtcTransport([{ type: 'transport', selectedCandidatePairId: 'missing' }])).toBeUndefined();
  });
  it('accepts explicit legacy selection with real candidate references', () => {
    const rows = reports().slice(1);
    rows[0]!.selected = true;
    expect(selectedWebRtcTransport(rows)).toBe('direct');
  });
  it('never lets an incomplete transport turn a known relay path into direct', () => {
    expect(selectedWebRtcTransport([...reports('relay'), { type: 'transport', selectedCandidatePairId: 'missing' }])).toBe('turn');
  });
});
