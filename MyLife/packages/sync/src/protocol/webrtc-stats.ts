/** Classify only the selected ICE path. Successful checks alone do not prove selection. */
export function selectedWebRtcTransport(reports: readonly Record<string, unknown>[]): 'direct' | 'turn' | undefined {
  const byId = new Map(reports.filter((row) => typeof row.id === 'string').map((row) => [row.id, row]));
  const selectedIds = reports.filter((row) => row.type === 'transport' && typeof row.selectedCandidatePairId === 'string')
    .map((row) => row.selectedCandidatePairId);
  const pairs = selectedIds.length
    ? selectedIds.map((id) => byId.get(id))
    : reports.filter((row) => row.type === 'candidate-pair' && row.selected === true);
  if (!pairs.length) return undefined;
  let unknown = false;
  for (const pair of pairs) {
    if (pair?.type !== 'candidate-pair') { unknown = true; continue; }
    const local = byId.get(pair.localCandidateId);
    const remote = byId.get(pair.remoteCandidateId);
    if (local?.type !== 'local-candidate' || remote?.type !== 'remote-candidate') { unknown = true; continue; }
    const types = [local.candidateType, remote.candidateType];
    if (types.includes('relay')) return 'turn';
    if (types.some((type) => !['host', 'srflx', 'prflx'].includes(String(type)))) unknown = true;
  }
  return unknown ? undefined : 'direct';
}
