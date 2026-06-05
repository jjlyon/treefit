import { length, scale } from './geometry';
import type { Mask, Point } from './types';

export class CircleMask implements Mask {
  constructor(public readonly radius: number) {}

  contains(point: Point): boolean {
    return length(point) <= this.radius + 1e-6;
  }

  projectInside(point: Point, margin: number): Point {
    const limit = Math.max(0, this.radius - margin);
    const len = length(point);
    if (len <= limit || len === 0) return point;
    return scale(point, limit / len);
  }

  boundaryPoint(angleRadians: number, margin: number): Point {
    const r = Math.max(0, this.radius - margin);
    return { x: Math.cos(angleRadians) * r, y: Math.sin(angleRadians) * r };
  }

  bounds() {
    return { minX: -this.radius, minY: -this.radius, maxX: this.radius, maxY: this.radius };
  }
}
