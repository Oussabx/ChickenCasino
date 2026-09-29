import { useStore } from '../store';

let ctx: AudioContext | null = null;
const ac = () => {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};

function tone(freq: number, dur = 0.08, type: OscillatorType = 'sine', gain = 0.15, slideTo?: number, delay = 0) {
  const { sound, volume } = useStore.getState().settings;
  if (!sound || volume <= 0) return;
  try {
    const c = ac();
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain * volume, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch {
    /* audio unavailable */
  }
}

export const sfx = {
  click: () => tone(520, 0.05, 'triangle', 0.08),
  tick: (pitch = 0) => tone(900 + pitch * 40, 0.035, 'square', 0.03),
  bet: () => { tone(330, 0.07, 'triangle', 0.1); tone(495, 0.08, 'triangle', 0.08, undefined, 0.05); },
  step: () => tone(620, 0.06, 'triangle', 0.1, 820),
  reveal: () => { tone(880, 0.07, 'sine', 0.12); tone(1320, 0.1, 'sine', 0.08, undefined, 0.05); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.12, undefined, i * 0.07)),
  bigWin: () => [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.22, 'square', 0.07, undefined, i * 0.08)),
  lose: () => tone(300, 0.35, 'sawtooth', 0.08, 90),
  crash: () => { tone(160, 0.5, 'sawtooth', 0.12, 40); tone(90, 0.6, 'square', 0.06, 30, 0.05); },
  cashout: () => { tone(660, 0.08, 'triangle', 0.12); tone(990, 0.14, 'triangle', 0.12, undefined, 0.07); },
  cluck: () => { tone(700, 0.05, 'square', 0.06, 450); tone(820, 0.07, 'square', 0.05, 500, 0.08); },
};
