interface ToneOptions {
  x: number;
  y: number;
  freqStart: number;
  freqEnd: number;
  duration: number;
  type?: OscillatorType;
  volume?: number;
}

/**
 * Procedural Web Audio synthesizer with 2D stereo panning and distance attenuation.
 * Lets players hear where other bunnies are hopping, booping, bouncing, and building!
 */
export class SpatialAudioEngine {
  private ctx: AudioContext | null = null;
  public enabled = true;
  private listenerX = 800;
  private listenerY = 400;

  unlock(): void {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setListenerPosition(x: number, y: number): void {
    this.listenerX = x;
    this.listenerY = y;
  }

  private computeSpatialParams(x: number, y: number): { gain: number; pan: number } {
    const dx = x - this.listenerX;
    const dy = y - this.listenerY;
    const dist = Math.hypot(dx, dy);
    const maxDist = 1100;
    const attenuation = Math.max(0.04, 1 - dist / maxDist);
    const pan = Math.max(-0.95, Math.min(0.95, dx / 520));
    return { gain: attenuation * attenuation * 0.25, pan };
  }

  playTone({ x, y, freqStart, freqEnd, duration, type = 'sine', volume = 1 }: ToneOptions): void {
    if (!this.enabled) return;
    this.unlock();
    if (!this.ctx) return;

    const { gain, pan } = this.computeSpatialParams(x, y);
    if (gain <= 0.005) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(gain * volume, now + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    if (panner) {
      panner.pan.setValueAtTime(pan, now);
      osc.connect(gainNode);
      gainNode.connect(panner);
      panner.connect(this.ctx.destination);
    } else {
      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);
    }

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playHop(x: number, y: number): void {
    this.playTone({ x, y, freqStart: 270, freqEnd: 460, duration: 0.11, type: 'triangle', volume: 0.65 });
  }

  playBounce(x: number, y: number): void {
    this.playTone({ x, y, freqStart: 190, freqEnd: 640, duration: 0.22, type: 'sine', volume: 1.0 });
  }

  playBoop(x: number, y: number): void {
    this.playTone({ x, y, freqStart: 520, freqEnd: 240, duration: 0.16, type: 'sine', volume: 1.1 });
  }

  playCarrot(x: number, y: number): void {
    this.playTone({ x, y, freqStart: 523, freqEnd: 784, duration: 0.16, type: 'triangle', volume: 1.0 });
    window.setTimeout(() => {
      this.playTone({ x, y, freqStart: 784, freqEnd: 1046, duration: 0.18, type: 'triangle', volume: 0.9 });
    }, 65);
  }

  playShamanCast(x: number, y: number): void {
    this.playTone({ x, y, freqStart: 392, freqEnd: 587, duration: 0.18, type: 'sine', volume: 0.8 });
  }

  playNestEntry(x: number, y: number): void {
    const notes = [523, 659, 784, 1046];
    notes.forEach((freq, idx) => {
      window.setTimeout(() => {
        this.playTone({
          x,
          y,
          freqStart: freq,
          freqEnd: freq * 1.04,
          duration: 0.22,
          type: 'triangle',
          volume: 1.0,
        });
      }, idx * 75);
    });
  }
}
