import { expect, test } from '@playwright/test';
import type { CallIceCandidate, CallMediaBackend, CallMediaConnectionEvent, CallMediaPeerSession } from '@mylife/sync';

test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } });

test('real local call reports its selected path and releases synthetic media on hangup', async ({ page }) => {
  await page.route('**/media-harness', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Media lifecycle acceptance</title>' }));
  await page.goto('/media-harness');
  const result = await page.evaluate(async () => {
    const pcs: RTCPeerConnection[] = [];
    const NativePeerConnection = RTCPeerConnection;
    globalThis.RTCPeerConnection = class extends NativePeerConnection {
      constructor(config?: RTCConfiguration) { super(config); pcs.push(this); }
    };
    const path = '/src/lib/call-media-backend.ts';
    const { loadCallMediaBackend } = await import(/* @vite-ignore */ path);
    const backend: CallMediaBackend = loadCallMediaBackend({ iceServers: [] });
    type BrowserSession = CallMediaPeerSession & { localStream(): MediaStream; remoteStream(): MediaStream | null };
    const a = await backend.startPeerConnection({ callId: 'local-test', media: 'voice', role: 'offerer', localMicOn: true, localCamOn: false }) as BrowserSession;
    let b: BrowserSession | undefined;
    const iceErrors: string[] = [];
    const stops: Array<() => void> = [];
    const keepStop = (stop: (() => void) | void) => {
      if (typeof stop !== 'function') throw new Error('Unsubscribe callback missing');
      stops.push(stop);
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      b = await backend.startPeerConnection({ callId: 'local-test', media: 'voice', role: 'answerer', localMicOn: true, localCamOn: false }) as BrowserSession;
      const peer = b;
      const tracks = [...a.localStream().getTracks(), ...peer.localStream().getTracks()];
      const queues: CallIceCandidate[][] = [[], []];
      const ready = [false, false];
      [a, peer].forEach((session, index) => {
        const target = index === 0 ? peer : a;
        const targetIndex = 1 - index;
        keepStop(session.onIceCandidate((candidate) => {
          if (!candidate) return;
          if (ready[targetIndex]) void target.addIceCandidate(candidate).catch((error: unknown) => iceErrors.push(String(error)));
          else queues[targetIndex]!.push(candidate);
        }));
      });
      const states: Array<CallMediaConnectionEvent | undefined> = [undefined, undefined];
      const connected = new Promise<void>((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Local call did not connect')), 15_000);
        [a, peer].forEach((session, index) => keepStop(session.onConnectionStateChange((event) => {
          states[index] = event;
          if (states.every((state) => state?.connectionState === 'connected' && state.transport !== undefined)) { clearTimeout(timer); resolve(); }
        })));
      });
      // Attach the rejection handler before negotiation can throw.
      void connected.catch(() => undefined);
      await peer.applyRemoteSdp(await a.createOffer());
      ready[1] = true;
      for (const candidate of queues[1]!) await peer.addIceCandidate(candidate);
      await a.applyRemoteSdp(await peer.createAnswer());
      ready[0] = true;
      for (const candidate of queues[0]!) await a.addIceCandidate(candidate);
      await connected;
      const transports = states.map((state) => state?.transport);
      const stats = await Promise.all(pcs.map(async (pc) => {
        const reports: Record<string, unknown>[] = [];
        (await pc.getStats()).forEach((row) => {
          if (['transport', 'candidate-pair', 'local-candidate', 'remote-candidate'].includes(row.type)) {
            const safe: Record<string, unknown> = {};
            for (const key of ['id', 'type', 'selectedCandidatePairId', 'localCandidateId', 'remoteCandidateId', 'candidateType', 'state']) safe[key] = row[key];
            reports.push(safe);
          }
        });
        return reports;
      }));
      const remoteTracks = [a.remoteStream()?.getTracks().length, peer.remoteStream()?.getTracks().length];
      for (const stop of stops) stop();
      await Promise.all([a.close(), peer.close()]);
      return { transports, stats, remoteTracks, iceErrors, trackStates: tracks.map((track) => track.readyState) };
    } finally {
      clearTimeout(timer);
      for (const stop of stops) stop();
      await Promise.all([a.close(), b?.close()]);
      globalThis.RTCPeerConnection = NativePeerConnection;
    }
  });
  expect(result.transports, JSON.stringify(result.stats)).toEqual(['direct', 'direct']);
  expect(result.remoteTracks).toEqual([1, 1]);
  expect(result.iceErrors).toEqual([]);
  expect(result.trackStates).toEqual(['ended', 'ended']);
});
