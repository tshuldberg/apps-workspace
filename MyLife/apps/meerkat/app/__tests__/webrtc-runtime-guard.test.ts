import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transpileModule, ModuleKind } from 'typescript';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../(root)/data/webrtc-backend.ts', import.meta.url), 'utf8');
const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;

describe('optional WebRTC runtime loading', () => {
  it('does not evaluate the native package when the bridge is absent', () => {
    const loaded: string[] = [];
    const exports: { loadWebRTCBackend?: () => unknown } = {};
    runInNewContext(compiled, {
      exports,
      require: (name: string): unknown => {
        loaded.push(name);
        if (name === 'react-native') return { NativeModules: {} };
        throw new Error('Unsupported native package was evaluated');
      },
    });
    expect(exports.loadWebRTCBackend?.()).toBeNull();
    expect(loaded).toEqual(['react-native']);
  });

  it('keeps the real backend available when its native bridge is registered', () => {
    const exports: { loadWebRTCBackend?: () => { isReal: boolean } | null } = {};
    runInNewContext(compiled, {
      exports,
      require: (name: string): unknown => {
        if (name === 'react-native') return { NativeModules: { WebRTCModule: {} } };
        if (name === '@livekit/react-native-webrtc') return { RTCPeerConnection: class {} };
        if (name === 'expo-constants') return { default: {} };
        throw new Error(`Unexpected dependency: ${name}`);
      },
    });
    expect(exports.loadWebRTCBackend?.()?.isReal).toBe(true);
  });
});


describe('optional call media runtime loading', () => {
  const source = readFileSync(new URL('../(root)/data/call-media-backend.ts', import.meta.url), 'utf8');
  const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
  it.each([false, true])('only evaluates the media package with its bridge registered: %s', (registered) => {
    const loaded: string[] = [];
    const exports: { loadCallMediaBackend?: () => unknown } = {};
    runInNewContext(compiled, {
      exports,
      require(name: string): unknown {
        loaded.push(name);
        if (name === '@mylife/sync') return { selectedWebRtcTransport: () => undefined };
        if (name === 'react-native') return { NativeModules: registered ? { WebRTCModule: {} } : {} };
        if (name === '@livekit/react-native-webrtc') return { RTCPeerConnection: class {}, mediaDevices: {} };
        if (name === 'expo-constants') return { default: {} };
        throw new Error(`Unexpected dependency: ${name}`);
      },
    });
    const backend = exports.loadCallMediaBackend!();
    if (registered) { expect(backend).not.toBeNull(); expect(loaded).toContain('@livekit/react-native-webrtc'); }
    else { expect(backend).toBeNull(); expect(loaded).toEqual(['@mylife/sync', 'react-native']); }
  });
});
