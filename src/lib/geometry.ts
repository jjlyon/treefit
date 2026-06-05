import type { Point } from './types';

export const ORIGIN: Point = { x: 0, y: 0 };

export function add(a: Point, b: Point): Point { return { x: a.x + b.x, y: a.y + b.y }; }
export function sub(a: Point, b: Point): Point { return { x: a.x - b.x, y: a.y - b.y }; }
export function scale(p: Point, scalar: number): Point { return { x: p.x * scalar, y: p.y * scalar }; }
export function length(p: Point): number { return Math.hypot(p.x, p.y); }
export function distance(a: Point, b: Point): number { return length(sub(a, b)); }
export function normalize(p: Point): Point { const len = length(p); return len === 0 ? { x: 0, y: -1 } : { x: p.x / len, y: p.y / len }; }
export function fromAngle(angle: number, len = 1): Point { return { x: Math.cos(angle) * len, y: Math.sin(angle) * len }; }
export function angleOf(p: Point): number { return Math.atan2(p.y, p.x); }
export function lerp(a: Point, b: Point, t: number): Point { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
export function lerpNumber(a: number, b: number, t: number): number { return a + (b - a) * t; }
export function perpendicular(p: Point): Point { return { x: -p.y, y: p.x }; }
export function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
export function isFinitePoint(point: Point): boolean { return Number.isFinite(point.x) && Number.isFinite(point.y); }

export interface CubicBezier { start: Point; c1: Point; c2: Point; end: Point; }

export function catmullRomToBezier(p0: Point, p1: Point, p2: Point, p3: Point, smoothness: number): CubicBezier {
  const tension = clamp(smoothness, 0, 1);
  const factor = (0.08 + tension * 0.18);
  return { start: p1, c1: add(p1, scale(sub(p2, p0), factor)), c2: sub(p2, scale(sub(p3, p1), factor)), end: p2 };
}

export function sampleBezier({ start, c1, c2, end }: CubicBezier, t: number): Point {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return { x: a * start.x + b * c1.x + c * c2.x + d * end.x, y: a * start.y + b * c1.y + c * c2.y + d * end.y };
}

export function bezierTangent({ start, c1, c2, end }: CubicBezier, t: number): Point {
  const mt = 1 - t;
  return normalize({
    x: 3 * mt * mt * (c1.x - start.x) + 6 * mt * t * (c2.x - c1.x) + 3 * t * t * (end.x - c2.x),
    y: 3 * mt * mt * (c1.y - start.y) + 6 * mt * t * (c2.y - c1.y) + 3 * t * t * (end.y - c2.y),
  });
}

export function bezierArcLength(bezier: CubicBezier, steps = 16): number {
  let total = 0; let prev = bezier.start;
  for (let i = 1; i <= steps; i += 1) { const p = sampleBezier(bezier, i / steps); total += distance(prev, p); prev = p; }
  return total;
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const pi = polygon[i], pj = polygon[j];
    const intersects = (pi.y > point.y) !== (pj.y > point.y) && point.x < ((pj.x - pi.x) * (point.y - pi.y)) / ((pj.y - pi.y) || 1e-12) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function nearestPointOnSegment(p: Point, a: Point, b: Point): Point {
  const ab = sub(b, a);
  const denom = ab.x * ab.x + ab.y * ab.y;
  const t = denom === 0 ? 0 : clamp(((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / denom, 0, 1);
  return lerp(a, b, t);
}

export function nearestPointOnPolygon(point: Point, polygon: Point[]): Point {
  let best = polygon[0]; let bestDist = Infinity;
  for (let i = 0; i < polygon.length; i += 1) {
    const candidate = nearestPointOnSegment(point, polygon[i], polygon[(i + 1) % polygon.length]);
    const d = distance(point, candidate);
    if (d < bestDist) { best = candidate; bestDist = d; }
  }
  return best;
}

export function polygonBounds(polygon: Point[]) {
  return polygon.reduce((b, p) => ({ minX: Math.min(b.minX, p.x), minY: Math.min(b.minY, p.y), maxX: Math.max(b.maxX, p.x), maxY: Math.max(b.maxY, p.y) }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}
