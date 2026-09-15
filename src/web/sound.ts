// 합성 효과음 (Web Audio, 파일 없음). 첫 사용자 입력 뒤에 컨텍스트를 만든다. 소리 켜기/끄기는 localStorage 'lanista-sound'
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let crowdNode: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
let enabled = localStorage.getItem('lanista-sound') !== '0';

export function soundEnabled() { return enabled; }
export function setSoundEnabled(on: boolean) { enabled = on; localStorage.setItem('lanista-sound', on ? '1' : '0'); if (!on) stopCrowd(); if (master) master.gain.value = on ? 0.8 : 0; }

function ac(): AudioContext | null {
  if (!enabled) return null;
  if (!ctx) { try { ctx = new AudioContext(); master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination); } catch { return null; } }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}
export function unlockAudio() { ac(); } // 클릭 핸들러에서 호출

let noiseBuf: AudioBuffer | null = null;
function noise(c: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
  const len = c.sampleRate * 2; const b = c.createBuffer(1, len, c.sampleRate); const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return (noiseBuf = b);
}
// 짧은 잡음 버스트: 타격·발소리·바람
function burst(c: AudioContext, opts: { dur: number; freq: number; q?: number; gain: number; type?: BiquadFilterType; attack?: number; pitchTo?: number }) {
  const src = c.createBufferSource(); src.buffer = noise(c);
  const f = c.createBiquadFilter(); f.type = opts.type ?? 'bandpass'; f.frequency.value = opts.freq; f.Q.value = opts.q ?? 1;
  if (opts.pitchTo) f.frequency.exponentialRampToValueAtTime(opts.pitchTo, c.currentTime + opts.dur);
  const g = c.createGain(); const t = c.currentTime; const a = opts.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(opts.gain, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
  src.connect(f); f.connect(g); g.connect(master!); src.start(t); src.stop(t + opts.dur + 0.05);
}
// 짧은 음: 금속·팡파르
function tone(c: AudioContext, freq: number, dur: number, gain: number, type: OscillatorType = 'triangle', at = 0, slide?: number) {
  const o = c.createOscillator(); o.type = type; const t = c.currentTime + at; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master!); o.start(t); o.stop(t + dur + 0.05);
}

export const sfx = {
  hit(heavy = false) { const c = ac(); if (!c) return; burst(c, { dur: heavy ? 0.18 : 0.11, freq: heavy ? 220 : 380, q: 0.8, gain: heavy ? 0.9 : 0.55, type: 'lowpass' }); tone(c, heavy ? 90 : 140, 0.12, 0.35, 'sine', 0, 50); }, // 살을 치는 둔탁한 소리 + 저음
  crit() { const c = ac(); if (!c) return; burst(c, { dur: 0.22, freq: 300, q: 0.7, gain: 1.0, type: 'lowpass' }); tone(c, 70, 0.25, 0.5, 'sine', 0, 40); burst(c, { dur: 0.3, freq: 2400, q: 2, gain: 0.25 }); },
  block() { const c = ac(); if (!c) return; tone(c, 1900, 0.09, 0.25, 'square', 0, 900); tone(c, 640, 0.16, 0.3, 'triangle'); burst(c, { dur: 0.08, freq: 3000, q: 3, gain: 0.3 }); }, // 방패에 맞는 쨍한 소리
  net() { const c = ac(); if (!c) return; burst(c, { dur: 0.45, freq: 900, q: 0.6, gain: 0.35, pitchTo: 300, attack: 0.06 }); }, // 그물 휘익
  down() { const c = ac(); if (!c) return; burst(c, { dur: 0.35, freq: 160, q: 0.9, gain: 0.9, type: 'lowpass' }); tone(c, 55, 0.4, 0.5, 'sine', 0.02, 30); }, // 쓰러짐
  whip() { const c = ac(); if (!c) return; burst(c, { dur: 0.06, freq: 3500, q: 1.5, gain: 0.7, attack: 0.002 }); burst(c, { dur: 0.16, freq: 900, q: 0.7, gain: 0.3, attack: 0.01 }); }, // 채찍 딱
  coin() { const c = ac(); if (!c) return; tone(c, 2200, 0.08, 0.2, 'square'); tone(c, 3300, 0.12, 0.15, 'square', 0.04); }, // 세스테르티우스 짤랑
  cheer(strength = 0.6) { const c = ac(); if (!c) return; burst(c, { dur: 0.9 + strength, freq: 700, q: 0.5, gain: 0.35 + strength * 0.4, type: 'bandpass', attack: 0.12, pitchTo: 500 }); }, // 함성 한 번
  boo() { const c = ac(); if (!c) return; burst(c, { dur: 1.2, freq: 240, q: 0.6, gain: 0.5, type: 'bandpass', attack: 0.2, pitchTo: 180 }); }, // 야유
  fanfare() { const c = ac(); if (!c) return; const seq = [[392, 0], [523, 0.16], [659, 0.32], [784, 0.5]]; for (const [f, at] of seq) tone(c, f, 0.35, 0.25, 'sawtooth', at); tone(c, 784, 0.9, 0.2, 'sawtooth', 0.7); }, // 코르누(뿔나팔) 팡파르
  step() { const c = ac(); if (!c) return; burst(c, { dur: 0.06, freq: 900, q: 0.8, gain: 0.22, type: 'bandpass', attack: 0.002 }); }, // 발소리: 짧고 마른 모래 밟는 소리
  drum(n = 2) { const c = ac(); if (!c) return; for (let i = 0; i < n; i++) { burst(c, { dur: 0.16, freq: 120, q: 1, gain: 0.7, type: 'lowpass', attack: 0.004 }); tone(c, 80, 0.18, 0.4, 'sine', i * 0.22, 45); } }, // 북
  chant(n = 2) { const c = ac(); if (!c) return; for (let i = 0; i < n; i++) { const at = i * 0.5; tone(c, 330, 0.16, 0.35, 'sawtooth', at); burst(c, { dur: 0.16, freq: 700, q: 0.6, gain: 0.35, attack: 0.03 }); tone(c, 262, 0.22, 0.35, 'sawtooth', at + 0.22); } }, // 관중 구호 "미-테, 미-테"
  gate() { const c = ac(); if (!c) return; burst(c, { dur: 0.6, freq: 180, q: 0.8, gain: 0.5, type: 'lowpass', attack: 0.05 }); tone(c, 60, 0.5, 0.3, 'sine', 0.1, 40); }, // 문루
};
// 관중 웅성임: 경기 중 계속. level 0~1
export function startCrowd(level = 0.3) {
  const c = ac(); if (!c) return;
  if (!crowdNode) {
    const src = c.createBufferSource(); src.buffer = noise(c); src.loop = true;
    const filter = c.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 600; filter.Q.value = 0.4;
    const gain = c.createGain(); gain.gain.value = 0;
    src.connect(filter); filter.connect(gain); gain.connect(master!); src.start();
    crowdNode = { src, gain, filter };
  }
  setCrowd(level);
}
export function setCrowd(level: number) { if (!crowdNode || !ctx) return; const t = ctx.currentTime; crowdNode.gain.gain.cancelScheduledValues(t); crowdNode.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.25, t, 0.25); crowdNode.filter.frequency.setTargetAtTime(500 + level * 500, t, 0.3); }
export function stopCrowd() { if (!crowdNode || !ctx) return; const n = crowdNode; crowdNode = null; n.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.3); setTimeout(() => { try { n.src.stop(); } catch { /* 이미 멈춤 */ } }, 1500); }
