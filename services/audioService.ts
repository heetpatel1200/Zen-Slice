// Audio Service using Web Audio API to synthesize sounds without external assets

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;

const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.3; // Master volume
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

// Helper to create noise buffer for explosions and slices
const createNoiseBuffer = () => {
  if (!audioCtx) return null;
  const bufferSize = audioCtx.sampleRate * 2; // 2 seconds
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
};

let noiseBuffer: AudioBuffer | null = null;

export const AudioService = {
  init: () => {
    initAudio();
    if (audioCtx && !noiseBuffer) {
      noiseBuffer = createNoiseBuffer();
    }
  },

  playSlice: () => {
    if (!audioCtx || !masterGain || !noiseBuffer) return;
    
    // Create a "Whoosh" sound using filtered noise
    const source = audioCtx.createBufferSource();
    source.buffer = noiseBuffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 1;

    const gain = audioCtx.createGain();
    
    // Envelope for volume
    const t = audioCtx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.8, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

    // Filter sweep for "movement" effect
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(2000, t + 0.15);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    source.start();
    source.stop(t + 0.3);
  },

  playSplat: () => {
    if (!audioCtx || !masterGain) return;

    // Juicy squish sound: Sine wave with rapid pitch drop + Sawtooth for texture
    const t = audioCtx.currentTime;

    // Oscillator 1 (Body)
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);

    // Oscillator 2 (Texture)
    const osc2 = audioCtx.createOscillator();
    osc2.type = "sawtooth";
    osc2.frequency.setValueAtTime(400, t);
    osc2.frequency.exponentialRampToValueAtTime(50, t + 0.1);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(masterGain);

    osc.start();
    osc2.start();
    osc.stop(t + 0.2);
    osc2.stop(t + 0.2);
  },

  playCombo: (count: number) => {
    if (!audioCtx || !masterGain) return;
    
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = "triangle";
    
    // Pitch rises with combo count
    const pitch = 440 + (count * 100); 
    osc.frequency.setValueAtTime(pitch, t);
    osc.frequency.linearRampToValueAtTime(pitch + 200, t + 0.3);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.5, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);

    osc.connect(gain);
    gain.connect(masterGain);
    
    osc.start();
    osc.stop(t + 0.6);
  },

  playBomb: () => {
    if (!audioCtx || !masterGain || !noiseBuffer) return;

    const t = audioCtx.currentTime;
    const source = audioCtx.createBufferSource();
    source.buffer = noiseBuffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1000, t);
    filter.frequency.exponentialRampToValueAtTime(10, t + 1.5);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(1, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 1.5);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    source.start();
    source.stop(t + 2);
  },

  playStart: () => {
    if (!audioCtx || !masterGain) return;
    // Gong-like sound
    const t = audioCtx.currentTime;
    
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 2);
    
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 2);

    osc.connect(gain);
    gain.connect(masterGain);
    
    osc.start();
    osc.stop(t + 2.5);
  }
};
