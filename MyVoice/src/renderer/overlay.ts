const { ipcRenderer } = require('electron');

const IPC_CHANNELS = {
  DICTATION_START: 'dictation:start',
  DICTATION_STOP: 'dictation:stop',
  DICTATION_CANCEL: 'dictation:cancel',
  DICTATION_PARTIAL_TEXT: 'dictation:partial-text',
  DICTATION_AUDIO_LEVEL: 'dictation:audio-level',
  DICTATION_ERROR: 'dictation:error',
  OVERLAY_READY: 'overlay:ready',
  OVERLAY_DISMISSED: 'overlay:dismissed',
  OVERLAY_SET_SIZE: 'overlay:set-size',
  WAVEFORM_CONFIG: 'waveform:config',
} as const;

const WAVEFORM_SAMPLE_COUNT = 64;
const WAVEFORM_MIN_HEIGHT = 3;
const WAVEFORM_MAX_HEIGHT = 50;
const WAVEFORM_LEVEL_DECAY = 0.985;
const WAVEFORM_LEVEL_SMOOTHING_ALPHA = 0.45;
const WAVEFORM_NO_INPUT_MS = 1200;

type OverlaySetSizePayload = {
  width: number;
  height: number;
  position: 'center' | 'top-left';
};

type WaveformSensitivity = 'low' | 'balanced' | 'high';

type WaveformConfigPayload = {
  sensitivity: WaveformSensitivity;
  debugOverlay: boolean;
};

interface SensitivityProfile {
  noiseFloor: number;
  minDynamicRange: number;
  maxDynamicRange: number;
  boost: number;
  curve: number;
}

const overlayWindowState = window as any;
overlayWindowState.__myvoice_overlay_booted = false;
overlayWindowState.__myvoice_overlay_boot_error = '';

const SAMPLE_COUNT = WAVEFORM_SAMPLE_COUNT;
const MIN_HEIGHT = WAVEFORM_MIN_HEIGHT;
const MAX_HEIGHT = WAVEFORM_MAX_HEIGHT;
const MINI_MIN_HEIGHT = 2;
const MINI_MAX_HEIGHT = 24;
const MAIN_BAR_COUNT = 72;
const MINI_BAR_COUNT = 26;

const SENSITIVITY_PROFILES: Record<WaveformSensitivity, SensitivityProfile> = {
  low: {
    noiseFloor: 0.04,
    minDynamicRange: 0.2,
    maxDynamicRange: 0.55,
    boost: 0.9,
    curve: 0.9,
  },
  balanced: {
    noiseFloor: 0.02,
    minDynamicRange: 0.12,
    maxDynamicRange: 0.45,
    boost: 1.15,
    curve: 0.78,
  },
  high: {
    noiseFloor: 0.01,
    minDynamicRange: 0.08,
    maxDynamicRange: 0.35,
    boost: 1.5,
    curve: 0.7,
  },
};

function getRequiredElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element as T;
}

function getOrCreateContainer(
  id: string,
  className: string,
  parent: HTMLElement
): HTMLDivElement {
  const existing = document.getElementById(id);
  if (existing && existing instanceof HTMLDivElement) {
    return existing;
  }

  const el = document.createElement('div');
  el.id = id;
  el.className = className;
  parent.appendChild(el);
  return el;
}

function createFallbackText(parent: HTMLElement, id: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.id = id;
  span.style.display = 'none';
  parent.appendChild(span);
  return span;
}

function createFallbackDebug(parent: HTMLElement): HTMLDivElement {
  const div = document.createElement('div');
  div.id = 'wave-debug';
  div.className = 'wave-debug';
  parent.appendChild(div);
  return div;
}

try {
  const overlay = getRequiredElement<HTMLDivElement>('#overlay');
  const waveformArea =
    (document.querySelector('.waveform-area') as HTMLElement | null) ?? overlay;
  const miniView = (document.querySelector('.mini-view') as HTMLElement | null) ?? overlay;

  const statusEl =
    (document.getElementById('status') as HTMLElement | null) ??
    createFallbackText(overlay, 'status');
  const transcriptEl =
    (document.getElementById('transcript') as HTMLElement | null) ??
    createFallbackText(overlay, 'transcript');
  const btnMinimize = document.getElementById('btn-minimize') as HTMLButtonElement | null;
  const btnExpand = document.getElementById('btn-expand') as HTMLButtonElement | null;
  const mainBarsEl = getOrCreateContainer('waveform-bars', 'waveform-bars', waveformArea);
  const miniBarsEl = getOrCreateContainer('mini-waveform-bars', 'mini-waveform-bars', miniView);
  const debugEl =
    (document.getElementById('wave-debug') as HTMLDivElement | null) ??
    createFallbackDebug(overlay);

  const ringBuffer = new Float32Array(SAMPLE_COUNT);
  let writeIndex = 0;
  let bufferFilled = false;

  let renderTimer: ReturnType<typeof setInterval> | null = null;
  let isRecording = false;
  let breathPhase = 0;
  let sensitivity: WaveformSensitivity = 'balanced';
  let debugOverlay = false;
  let adaptivePeak = 0.12;
  let lastRawLevel = 0;
  let lastMappedLevel = 0;
  let lastSignalAt = Date.now();

  function createBars(
    container: HTMLDivElement,
    count: number,
    className: string,
    minHeight: number
  ): HTMLDivElement[] {
    container.textContent = '';
    const bars: HTMLDivElement[] = [];
    for (let i = 0; i < count; i += 1) {
      const bar = document.createElement('div');
      bar.className = className;
      bar.style.height = `${minHeight}px`;
      bars.push(bar);
      container.appendChild(bar);
    }
    return bars;
  }

  const mainBars = createBars(mainBarsEl, MAIN_BAR_COUNT, 'wave-bar', MIN_HEIGHT);
  const miniBars = createBars(miniBarsEl, MINI_BAR_COUNT, 'mini-wave-bar', MINI_MIN_HEIGHT);

  function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  function getProfile(): SensitivityProfile {
    return SENSITIVITY_PROFILES[sensitivity];
  }

  function mapIncomingLevel(rawLevel: number): number {
    const profile = getProfile();
    const clampedRaw = clamp(rawLevel, 0, 1);
    lastRawLevel = clampedRaw;

    adaptivePeak = Math.max(clampedRaw, adaptivePeak * WAVEFORM_LEVEL_DECAY);
    adaptivePeak = Math.max(adaptivePeak, profile.noiseFloor + profile.minDynamicRange);

    const dynamicRange = clamp(
      adaptivePeak - profile.noiseFloor,
      profile.minDynamicRange,
      profile.maxDynamicRange
    );
    const normalized = clamp((clampedRaw - profile.noiseFloor) / dynamicRange, 0, 1);
    const shaped = clamp(Math.pow(normalized, profile.curve) * profile.boost, 0, 1);
    lastMappedLevel = shaped;

    if (clampedRaw > profile.noiseFloor + 0.015) {
      lastSignalAt = Date.now();
    }

    return shaped;
  }

  function pushLevel(level: number): void {
    const mapped = mapIncomingLevel(level);
    const prev = ringBuffer[(writeIndex - 1 + SAMPLE_COUNT) % SAMPLE_COUNT];
    const smoothed =
      prev * (1 - WAVEFORM_LEVEL_SMOOTHING_ALPHA) + mapped * WAVEFORM_LEVEL_SMOOTHING_ALPHA;
    ringBuffer[writeIndex] = smoothed;
    writeIndex = (writeIndex + 1) % SAMPLE_COUNT;
    if (writeIndex === 0) bufferFilled = true;
  }

  function getSampleCount(): number {
    return bufferFilled ? SAMPLE_COUNT : writeIndex;
  }

  function getRecentSample(indexFromRight: number): number {
    const count = getSampleCount();
    if (count === 0) return 0;
    const sourceIndex = (writeIndex - 1 - indexFromRight + SAMPLE_COUNT) % SAMPLE_COUNT;
    return ringBuffer[sourceIndex] ?? 0;
  }

  function renderBars(
    bars: HTMLDivElement[],
    minHeight: number,
    maxHeight: number,
    dimEdges: boolean
  ): void {
    const count = bars.length;
    const samples = getSampleCount();

    if (!isRecording || samples === 0) {
      breathPhase += 0.03;
      for (let i = 0; i < count; i += 1) {
        const pulse = 1 + 0.4 * Math.sin(breathPhase + i * 0.15);
        const h = minHeight * pulse;
        const bar = bars[i];
        bar.style.height = `${h.toFixed(2)}px`;
        bar.style.opacity = '0.35';
      }
      return;
    }

    for (let i = 0; i < count; i += 1) {
      const sampleFromRight = Math.floor(
        ((count - 1 - i) / Math.max(count - 1, 1)) * (Math.max(samples, 1) - 1)
      );
      const level = getRecentSample(sampleFromRight);
      const height = Math.max(minHeight, minHeight + level * (maxHeight - minHeight));

      let alpha = 0.88;
      if (dimEdges && count > 4) {
        const norm = i / (count - 1);
        const edgeFade = 1 - Math.pow(2 * norm - 1, 4) * 0.35;
        alpha *= edgeFade;
      }

      const bar = bars[i];
      bar.style.height = `${height.toFixed(2)}px`;
      bar.style.opacity = `${alpha.toFixed(3)}`;
    }
  }

  function renderFrame(): void {
    renderBars(mainBars, MIN_HEIGHT, MAX_HEIGHT, true);
    renderBars(miniBars, MINI_MIN_HEIGHT, MINI_MAX_HEIGHT, false);
    updateListeningHint();
    renderDebugOverlay();
  }

  function startRenderLoop(): void {
    if (renderTimer !== null) return;
    renderFrame();
    renderTimer = setInterval(renderFrame, 33);
  }

  function stopRenderLoop(): void {
    if (renderTimer !== null) {
      clearInterval(renderTimer);
      renderTimer = null;
    }
  }

  function updateListeningHint(): void {
    if (!isRecording) return;
    const statusText = statusEl.textContent ?? '';
    const transcriptText = transcriptEl.textContent ?? '';
    if (!statusText.startsWith('Listening')) return;
    if (transcriptText.trim().length > 0) return;

    const noInput = Date.now() - lastSignalAt >= WAVEFORM_NO_INPUT_MS;
    statusEl.textContent = noInput ? 'Listening... (no input)' : 'Listening...';
  }

  function renderDebugOverlay(): void {
    if (!debugOverlay) {
      debugEl.classList.remove('visible');
      return;
    }

    debugEl.classList.add('visible');
    const profile = getProfile();
    debugEl.textContent =
      `raw:${lastRawLevel.toFixed(3)} mapped:${lastMappedLevel.toFixed(3)} ` +
      `peak:${adaptivePeak.toFixed(3)} floor:${profile.noiseFloor.toFixed(3)} sens:${sensitivity}`;
  }

  function applyWaveformConfig(config: WaveformConfigPayload): void {
    sensitivity = config.sensitivity;
    debugOverlay = config.debugOverlay;
    if (!debugOverlay) {
      debugEl.classList.remove('visible');
    }
  }

  function setOverlayMode(mode: 'expanded' | 'minimized'): void {
    overlay.classList.add('transitioning');
    overlay.classList.remove('expanded', 'minimized');
    overlay.classList.add(mode);

    const payload: OverlaySetSizePayload =
      mode === 'expanded'
        ? { width: 620, height: 160, position: 'center' }
        : { width: 260, height: 56, position: 'top-left' };
    ipcRenderer.send(IPC_CHANNELS.OVERLAY_SET_SIZE, payload);

    setTimeout(() => overlay.classList.remove('transitioning'), 220);
  }

  if (btnMinimize) {
    btnMinimize.addEventListener('click', () => setOverlayMode('minimized'));
  }
  if (btnExpand) {
    btnExpand.addEventListener('click', () => setOverlayMode('expanded'));
  }

  ipcRenderer.on(IPC_CHANNELS.DICTATION_START, () => {
    overlay.classList.remove('dismissing', 'transitioning');
    overlay.classList.remove('minimized');
    overlay.classList.add('expanded');
    statusEl.textContent = 'Listening...';
    transcriptEl.textContent = '';
    ringBuffer.fill(0);
    writeIndex = 0;
    bufferFilled = false;
    isRecording = true;
    breathPhase = 0;
    lastSignalAt = Date.now();
    lastRawLevel = 0;
    lastMappedLevel = 0;
    adaptivePeak = 0.12;
    startRenderLoop();
  });

  ipcRenderer.on(IPC_CHANNELS.DICTATION_AUDIO_LEVEL, (_event: any, level: number) => {
    if (!isRecording) {
      isRecording = true;
      if (statusEl.textContent?.startsWith('Listening')) {
        statusEl.textContent = 'Listening...';
      }
    }
    if (renderTimer === null) {
      startRenderLoop();
    }
    pushLevel(level);
    renderFrame();
  });

  ipcRenderer.on(IPC_CHANNELS.DICTATION_PARTIAL_TEXT, (_event: any, text: string) => {
    transcriptEl.textContent = text;
    statusEl.textContent = 'Listening...';
  });

  ipcRenderer.on(IPC_CHANNELS.DICTATION_STOP, (_event: any, finalText: string) => {
    isRecording = false;
    statusEl.textContent = 'Done';
    transcriptEl.textContent = finalText;
    dismiss();
  });

  ipcRenderer.on(IPC_CHANNELS.DICTATION_CANCEL, () => {
    isRecording = false;
    statusEl.textContent = 'Cancelled';
    dismiss();
  });

  ipcRenderer.on(IPC_CHANNELS.DICTATION_ERROR, (_event: any, message: string) => {
    isRecording = false;
    statusEl.textContent = `Error: ${message}`;
    setTimeout(dismiss, 1500);
  });

  ipcRenderer.on(IPC_CHANNELS.WAVEFORM_CONFIG, (_event: any, payload: WaveformConfigPayload) => {
    if (!payload) return;
    applyWaveformConfig(payload);
  });

  function dismiss(): void {
    overlay.classList.add('dismissing');
    setTimeout(() => {
      stopRenderLoop();
      ipcRenderer.send(IPC_CHANNELS.OVERLAY_DISMISSED);
    }, 200);
  }

  window.addEventListener('beforeunload', () => {
    stopRenderLoop();
  });

  overlayWindowState.__myvoice_overlay_booted = true;
  console.log('[MyVoice][Overlay] booted');
  ipcRenderer.send(IPC_CHANNELS.OVERLAY_READY);
} catch (error: any) {
  const message = error?.stack || error?.message || String(error);
  overlayWindowState.__myvoice_overlay_boot_error = message;
  console.error(`[MyVoice][Overlay] boot failed: ${message}`);
}
