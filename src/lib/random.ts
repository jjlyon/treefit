export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export class SeededRandom {
  private state: number;

  constructor(seed: string) {
    this.state = hashString(seed) || 0x9e3779b9;
  }

  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = Math.imul(x >>> 0, 0x85ebca6b) >>> 0;
    return this.state / 0x100000000;
  }

  range(min: number, max: number): number { return min + (max - min) * this.next(); }
  signed(scale = 1): number { return this.range(-scale, scale); }
  chance(probability: number): boolean { return this.next() < probability; }
}
