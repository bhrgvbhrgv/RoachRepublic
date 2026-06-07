/**
 * Cockroach Janta Party - Audio Synthesizer Engine
 * Uses Web Audio API to procedurally generate all sounds.
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.humNode = null;
    this.humGain = null;
    this.masterGain = null;
    this.volume = 0.8;
    this.muted = false;
  }

  // Initialize and resume the audio context
  init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  output() {
    return this.masterGain || (this.ctx ? this.ctx.destination : null);
  }

  setVolume(value) {
    const next = Math.max(0, Math.min(1, Number(value)));
    this.volume = Number.isFinite(next) ? next : this.volume;
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const target = this.muted ? 0 : this.volume;
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(target, now + 0.04);
  }

  setMuted(flag) {
    this.muted = !!flag;
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const target = this.muted ? 0 : this.volume;
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(target, now + 0.04);
  }

  // Synthesize white noise buffer
  createNoiseBuffer() {
    const bufferSize = this.ctx.sampleRate * 0.5; // 0.5 seconds of noise
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // Play button click (High-pass filtered noise + fast decay sine)
  playClick() {
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    // Low body of the click
    const osc = this.ctx.createOscillator();
    const gainOsc = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(10, now + 0.05);

    gainOsc.gain.setValueAtTime(0.5, now);
    gainOsc.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gainOsc);
    gainOsc.connect(this.output());
    osc.start(now);
    osc.stop(now + 0.05);

    // High snap
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1000, now);

    const gainNoise = this.ctx.createGain();
    gainNoise.gain.setValueAtTime(0.4, now);
    gainNoise.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    noise.connect(filter);
    filter.connect(gainNoise);
    gainNoise.connect(this.output());
    
    noise.start(now);
    noise.stop(now + 0.02);
  }

  // Start continuous Refrigerator hum (Droning detuned low-frequency triangle waves + lowpass filtered hum)
  startHum() {
    this.init();
    if (!this.ctx || this.humNode) return;

    const now = this.ctx.currentTime;
    this.humGain = this.ctx.createGain();
    this.humGain.gain.setValueAtTime(0.0, now);
    // Smooth fade in
    this.humGain.gain.linearRampToValueAtTime(0.12, now + 1.5);
    this.humGain.connect(this.output());

    // Droning base oscillator (60Hz hum)
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(60, now);

    // Detuned harmonics (120Hz)
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(120.5, now);

    // Filter to make it muddy and warm
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(150, now);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(this.humGain);

    osc1.start(now);
    osc2.start(now);

    this.humNode = { osc1, osc2, filter };
  }

  // Stop Refrigerator hum with a brief fade out
  stopHum() {
    if (!this.ctx || !this.humNode) return;
    const now = this.ctx.currentTime;
    const gNode = this.humGain;
    const node = this.humNode;
    
    gNode.gain.setValueAtTime(gNode.gain.value, now);
    gNode.gain.linearRampToValueAtTime(0.0, now + 0.2);
    
    setTimeout(() => {
      try {
        node.osc1.stop();
        node.osc2.stop();
      } catch (e) {}
    }, 250);

    this.humNode = null;
    this.humGain = null;
  }

  // Cockroach skittering (short burst of high-pass white noise)
  playSkitter() {
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3500, now);
    filter.Q.setValueAtTime(3.0, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.output());

    noise.start(now);
    noise.stop(now + 0.06);
  }

  // Taking damage hit (explosive retro noise crash)
  playHit() {
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.output());

    noise.start(now);
    noise.stop(now + 0.3);

    // Low boom pitch sweep
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.2);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.4, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(oscGain);
    oscGain.connect(this.output());
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // Picking up collectible (retro sound, ascending arpeggio chime)
  playChime() {
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    notes.forEach((freq, idx) => {
      const noteTime = now + (idx * 0.07);
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);
      
      gain.gain.setValueAtTime(0.15, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.15);
      
      osc.connect(gain);
      gain.connect(this.output());
      
      osc.start(noteTime);
      osc.stop(noteTime + 0.2);
    });
  }

  // Defeat/Game Over sound (sad downward pitch sweep)
  playGameOver() {
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(45, now + 0.8);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.8);

    osc.connect(gain);
    gain.connect(this.output());

    osc.start(now);
    osc.stop(now + 0.8);
  }

  // Lightbulb grab sound (tactile short sweep)
  playGrab() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(250, now);
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.05);
    
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    
    osc.connect(gain);
    gain.connect(this.output());
    osc.start(now);
    osc.stop(now + 0.06);
  }

  // Spring snapback sound (retro boing effect)
  playSnapback() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.quadraticRampToValueAtTime(280, now + 0.1);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.3);
    
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    
    osc.connect(gain);
    gain.connect(this.output());
    osc.start(now);
    osc.stop(now + 0.35);
  }

  // Light crackle/flicker sound when hovering
  playFlicker() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(7500, now);
    filter.Q.setValueAtTime(12.0, now);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.output());
    
    noise.start(now);
    noise.stop(now + 0.02);
  }
}

// Export a single instance
const audio = new AudioEngine();
window.audio = audio;
