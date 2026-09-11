// 시드 고정 난수. 시뮬레이션 재현용.
export class Rng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0 || 1; }
  get state(): number { return this.s; }
  set state(v: number) { this.s = v >>> 0; }
  next(): number { // mulberry32
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(min: number, max: number): number { return min + Math.floor(this.next() * (max - min + 1)); }
  range(min: number, max: number): number { return min + this.next() * (max - min); }
  chance(p: number): boolean { return this.next() < p; }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
}
