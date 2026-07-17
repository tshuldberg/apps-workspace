// === Chiptune Audio Engine (Web Audio API) ===

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let currentMusic: { stop: () => void; name: string } | null = null;

/** Initialize audio context (call on first user interaction) */
export function initAudio(): void {
  if (audioCtx) return;
  audioCtx = new AudioContext();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.3;
  masterGain.connect(audioCtx.destination);
}

function ensureCtx(): AudioContext {
  if (!audioCtx) initAudio();
  return audioCtx!;
}

/** Play a single note */
export function playNote(
  frequency: number,
  duration: number,
  type: OscillatorType = 'square',
  volume: number = 0.3,
): void {
  const ctx = ensureCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.value = volume;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(masterGain!);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

// Note frequencies (octave 4 as base)
const NOTES: Record<string, number> = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
  C6: 1046.50, D6: 1174.66, E6: 1318.51,
};

function n(name: string): number { return NOTES[name] ?? 440; }

/** Play a sound effect */
export function playSfx(name: string): void {
  const ctx = ensureCtx();
  const t = ctx.currentTime;

  switch (name) {
    case 'menu-select': {
      playNote(n('E5'), 0.08, 'square', 0.2);
      break;
    }
    case 'menu-back': {
      playNote(n('C4'), 0.1, 'square', 0.2);
      break;
    }
    case 'text-advance': {
      playNote(n('A5'), 0.04, 'square', 0.1);
      break;
    }
    case 'damage-hit': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.15);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(gain);
      gain.connect(masterGain!);
      osc.start(t);
      osc.stop(t + 0.15);
      break;
    }
    case 'super-effective': {
      playNote(n('C5'), 0.12, 'square', 0.2);
      setTimeout(() => playNote(n('E5'), 0.12, 'square', 0.2), 120);
      break;
    }
    case 'not-effective': {
      playNote(n('E4'), 0.12, 'square', 0.2);
      setTimeout(() => playNote(n('C4'), 0.12, 'square', 0.2), 120);
      break;
    }
    case 'critical-hit': {
      playNote(n('G5'), 0.06, 'sawtooth', 0.3);
      setTimeout(() => playNote(n('C6'), 0.1, 'sawtooth', 0.3), 60);
      break;
    }
    case 'level-up': {
      const notes = [n('C5'), n('E5'), n('G5'), n('C6')];
      notes.forEach((freq, i) => {
        setTimeout(() => playNote(freq, 0.15, 'square', 0.25), i * 120);
      });
      break;
    }
    case 'heal': {
      const scale = [n('C5'), n('D5'), n('E5'), n('F5'), n('G5'), n('A5')];
      scale.forEach((freq, i) => {
        setTimeout(() => playNote(freq, 0.1, 'square', 0.2), i * 60);
      });
      break;
    }
    case 'save': {
      playNote(n('G4'), 0.1, 'square', 0.2);
      setTimeout(() => playNote(n('C5'), 0.1, 'square', 0.2), 100);
      setTimeout(() => playNote(n('E5'), 0.2, 'square', 0.2), 200);
      break;
    }
    case 'encounter': {
      for (let i = 0; i < 4; i++) {
        setTimeout(() => playNote(n('B5'), 0.06, 'square', 0.3), i * 80);
      }
      setTimeout(() => playNote(n('E5'), 0.3, 'square', 0.3), 340);
      break;
    }
    case 'catch-wobble': {
      playNote(80, 0.12, 'triangle', 0.3);
      break;
    }
    case 'catch-success': {
      const notes = [n('G4'), n('B4'), n('D5'), n('G5')];
      notes.forEach((freq, i) => {
        setTimeout(() => playNote(freq, 0.2, 'square', 0.25), i * 150);
      });
      break;
    }
    case 'catch-fail': {
      playNote(n('G4'), 0.15, 'square', 0.2);
      setTimeout(() => playNote(n('E4'), 0.15, 'square', 0.2), 150);
      setTimeout(() => playNote(n('C4'), 0.2, 'square', 0.2), 300);
      break;
    }
    case 'door': {
      playNote(n('A4'), 0.08, 'square', 0.15);
      setTimeout(() => playNote(n('E5'), 0.08, 'square', 0.15), 80);
      break;
    }
    case 'ledge': {
      playNote(60, 0.15, 'triangle', 0.25);
      break;
    }
    case 'faint': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(600, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.8);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      osc.connect(gain);
      gain.connect(masterGain!);
      osc.start(t);
      osc.stop(t + 0.8);
      break;
    }
  }
}

interface TrackNote {
  freq: number;
  dur: number;
  rest?: number;
}

function buildTrack(notes: TrackNote[]): { notes: TrackNote[]; totalTime: number } {
  let totalTime = 0;
  for (const note of notes) {
    totalTime += note.dur + (note.rest ?? 0);
  }
  return { notes, totalTime };
}

const TRACKS: Record<string, { notes: TrackNote[]; totalTime: number }> = {
  'title': buildTrack([
    { freq: n('E4'), dur: 0.2 }, { freq: n('G4'), dur: 0.2 }, { freq: n('B4'), dur: 0.4 },
    { freq: n('A4'), dur: 0.2 }, { freq: n('G4'), dur: 0.2 }, { freq: n('E4'), dur: 0.4 },
    { freq: n('D4'), dur: 0.2 }, { freq: n('E4'), dur: 0.2 }, { freq: n('G4'), dur: 0.4, rest: 0.2 },
    { freq: n('E4'), dur: 0.2 }, { freq: n('G4'), dur: 0.2 }, { freq: n('A4'), dur: 0.4 },
    { freq: n('B4'), dur: 0.2 }, { freq: n('A4'), dur: 0.2 }, { freq: n('G4'), dur: 0.4, rest: 0.2 },
  ]),
  'battle-wild': buildTrack([
    { freq: n('E5'), dur: 0.1 }, { freq: n('E5'), dur: 0.1, rest: 0.05 },
    { freq: n('D5'), dur: 0.1 }, { freq: n('E5'), dur: 0.15 },
    { freq: n('G5'), dur: 0.1 }, { freq: n('E5'), dur: 0.1, rest: 0.05 },
    { freq: n('C5'), dur: 0.2 }, { freq: n('D5'), dur: 0.15, rest: 0.1 },
    { freq: n('E5'), dur: 0.1 }, { freq: n('G5'), dur: 0.1 },
    { freq: n('A5'), dur: 0.15 }, { freq: n('G5'), dur: 0.1 },
    { freq: n('E5'), dur: 0.1 }, { freq: n('D5'), dur: 0.15, rest: 0.1 },
  ]),
  'battle-trainer': buildTrack([
    { freq: n('A4'), dur: 0.1 }, { freq: n('A4'), dur: 0.1, rest: 0.05 },
    { freq: n('C5'), dur: 0.15 }, { freq: n('A4'), dur: 0.1 },
    { freq: n('E5'), dur: 0.2 }, { freq: n('D5'), dur: 0.15, rest: 0.1 },
    { freq: n('C5'), dur: 0.1 }, { freq: n('A4'), dur: 0.1 },
    { freq: n('G4'), dur: 0.2, rest: 0.1 },
    { freq: n('A4'), dur: 0.1 }, { freq: n('C5'), dur: 0.1 },
    { freq: n('E5'), dur: 0.2 }, { freq: n('D5'), dur: 0.15 },
    { freq: n('C5'), dur: 0.15, rest: 0.1 },
  ]),
  'battle-gym': buildTrack([
    { freq: n('C5'), dur: 0.15 }, { freq: n('E5'), dur: 0.1 },
    { freq: n('G5'), dur: 0.2 }, { freq: n('G5'), dur: 0.1, rest: 0.05 },
    { freq: n('F5'), dur: 0.1 }, { freq: n('E5'), dur: 0.15 },
    { freq: n('D5'), dur: 0.2, rest: 0.1 },
    { freq: n('C5'), dur: 0.1 }, { freq: n('D5'), dur: 0.1 },
    { freq: n('E5'), dur: 0.15 }, { freq: n('G5'), dur: 0.2 },
    { freq: n('A5'), dur: 0.3, rest: 0.1 },
  ]),
  'pokemon-center': buildTrack([
    { freq: n('C5'), dur: 0.2 }, { freq: n('E5'), dur: 0.2 },
    { freq: n('G5'), dur: 0.3, rest: 0.1 },
    { freq: n('G5'), dur: 0.15 }, { freq: n('F5'), dur: 0.15 },
    { freq: n('E5'), dur: 0.2 }, { freq: n('D5'), dur: 0.2, rest: 0.1 },
    { freq: n('E5'), dur: 0.2 }, { freq: n('C5'), dur: 0.3, rest: 0.1 },
    { freq: n('D5'), dur: 0.2 }, { freq: n('E5'), dur: 0.2 },
    { freq: n('C5'), dur: 0.4, rest: 0.2 },
  ]),
  'pallet-town': buildTrack([
    { freq: n('E4'), dur: 0.25 }, { freq: n('G4'), dur: 0.25 },
    { freq: n('A4'), dur: 0.25 }, { freq: n('G4'), dur: 0.25, rest: 0.1 },
    { freq: n('E4'), dur: 0.2 }, { freq: n('C4'), dur: 0.2 },
    { freq: n('D4'), dur: 0.3, rest: 0.1 },
    { freq: n('E4'), dur: 0.2 }, { freq: n('G4'), dur: 0.2 },
    { freq: n('A4'), dur: 0.3 }, { freq: n('B4'), dur: 0.2 },
    { freq: n('A4'), dur: 0.2 }, { freq: n('G4'), dur: 0.4, rest: 0.2 },
  ]),
  'route-1': buildTrack([
    { freq: n('C5'), dur: 0.15 }, { freq: n('D5'), dur: 0.15 },
    { freq: n('E5'), dur: 0.2 }, { freq: n('G5'), dur: 0.15 },
    { freq: n('E5'), dur: 0.15, rest: 0.1 },
    { freq: n('C5'), dur: 0.15 }, { freq: n('D5'), dur: 0.15 },
    { freq: n('E5'), dur: 0.3, rest: 0.1 },
    { freq: n('D5'), dur: 0.15 }, { freq: n('C5'), dur: 0.15 },
    { freq: n('A4'), dur: 0.2 }, { freq: n('C5'), dur: 0.3, rest: 0.2 },
  ]),
  'evolution': buildTrack([
    { freq: n('C4'), dur: 0.2 }, { freq: n('C4'), dur: 0.2, rest: 0.1 },
    { freq: n('D4'), dur: 0.2 }, { freq: n('D4'), dur: 0.2, rest: 0.1 },
    { freq: n('E4'), dur: 0.2 }, { freq: n('E4'), dur: 0.2, rest: 0.1 },
    { freq: n('F4'), dur: 0.2 }, { freq: n('G4'), dur: 0.3 },
    { freq: n('A4'), dur: 0.3 }, { freq: n('B4'), dur: 0.3 },
    { freq: n('C5'), dur: 0.5, rest: 0.2 },
  ]),
};

// Victory is non-looping
const VICTORY_TRACK = buildTrack([
  { freq: n('C5'), dur: 0.15 }, { freq: n('C5'), dur: 0.15, rest: 0.05 },
  { freq: n('C5'), dur: 0.15, rest: 0.1 },
  { freq: n('C5'), dur: 0.3 }, { freq: n('G4'), dur: 0.3 },
  { freq: n('A4'), dur: 0.2 }, { freq: n('B4'), dur: 0.2 },
  { freq: n('C5'), dur: 0.5 },
]);

/** Play a looping music track */
export function playMusic(trackName: string): void {
  if (currentMusic?.name === trackName) return;
  stopMusic();

  const track = TRACKS[trackName];
  if (!track) return;

  let stopped = false;
  let timeoutId: ReturnType<typeof setTimeout>;

  function playLoop() {
    if (stopped) return;
    const ctx = ensureCtx();
    let offset = 0;
    for (const note of track!.notes) {
      if (stopped) break;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = note.freq;
      gain.gain.setValueAtTime(0.12, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + note.dur);
      osc.connect(gain);
      gain.connect(masterGain!);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + note.dur);
      offset += note.dur + (note.rest ?? 0);
    }
    timeoutId = setTimeout(playLoop, track!.totalTime * 1000);
  }

  playLoop();
  currentMusic = {
    name: trackName,
    stop() {
      stopped = true;
      clearTimeout(timeoutId);
    },
  };
}

/** Stop current music */
export function stopMusic(): void {
  if (currentMusic) {
    currentMusic.stop();
    currentMusic = null;
  }
}

/** Play victory fanfare (non-looping) */
export function playVictoryFanfare(): void {
  stopMusic();
  const ctx = ensureCtx();
  let offset = 0;
  for (const note of VICTORY_TRACK.notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = note.freq;
    gain.gain.setValueAtTime(0.15, ctx.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + note.dur);
    osc.connect(gain);
    gain.connect(masterGain!);
    osc.start(ctx.currentTime + offset);
    osc.stop(ctx.currentTime + offset + note.dur);
    offset += note.dur + (note.rest ?? 0);
  }
}

/** Generate a unique Pokemon cry based on species ID */
export function playPokemonCry(speciesId: number): void {
  const ctx = ensureCtx();
  const t = ctx.currentTime;

  // Base frequency varies by species (higher for smaller Pokemon, lower for larger)
  const baseFreq = 100 + ((speciesId * 37) % 400);
  const duration = 0.3 + ((speciesId * 13) % 5) * 0.1;

  // Main tone with frequency sweep
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'square';
  osc1.frequency.setValueAtTime(baseFreq * 1.5, t);
  osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, t + duration);
  gain1.gain.setValueAtTime(0.2, t);
  gain1.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc1.connect(gain1);
  gain1.connect(masterGain!);
  osc1.start(t);
  osc1.stop(t + duration);

  // Harmonic overlay
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sawtooth';
  osc2.frequency.setValueAtTime(baseFreq * 2, t);
  osc2.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, t + duration * 0.7);
  gain2.gain.setValueAtTime(0.08, t);
  gain2.gain.exponentialRampToValueAtTime(0.001, t + duration * 0.7);
  osc2.connect(gain2);
  gain2.connect(masterGain!);
  osc2.start(t);
  osc2.stop(t + duration * 0.7);
}
