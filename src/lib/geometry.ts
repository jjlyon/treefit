import type { Point } from './types';

export const ORIGIN: Point = { x: 0, y: 0 };

export function add(a: Point, b: Point): Point { return { x: a.x + b.x, y: a.y + b.y }; }
export function sub(a: Point, b: Point): Point { return { x: a.x - b.x, y: a.y - b.y }; }
export function scale(p: Point, s: number): Point { return { x: p.x * s, y: p.y * s }; }
export function length(p: Point): number { return Math.hypot(p.x, p.y); }
export function distance(a: Point, b: Point): number { return length(sub(a, b)); }
export function normalize(p: Point): Point { const len = length(p); return len > 1e-9 ? scale(p, 1 / len) : { ...ORIGIN }; }
export function fromAngle(angle: number, len = 1): Point { return { x: Math.cos(angle) * len, y: Math.sin(angle) * len }; }
export function angleOf(p: Point): number { return Math.atan2(p.y, p.x); }
export function lerp(a: Point, b: Point, t: number): Point { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
export function perpendicular(p: Point): Point { return { x: -p.y, y: p.x }; }
export function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
export function isFinitePoint(p: Point): boolean { return Number.isFinite(p.x) && Number.isFinite(p.y); }

export function evalBezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

export function evalBezierDerivative(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: 3 * mt * mt * (p1.x - p0.x) + 6 * mt * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
    y: 3 * mt * mt * (p1.y - p0.y) + 6 * mt * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y),
  };
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = (a.y > point.y) !== (b.y > point.y);
    if (crosses) {
      const xAtY = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 1e-9) + a.x;
      if (point.x < xAtY) inside = !inside;
    }
  }
  return inside;
}

function nearestPointOnSegment(point: Point, a: Point, b: Point): Point {
  const ab = sub(b, a);
  const denom = ab.x * ab.x + ab.y * ab.y;
  const t = denom > 0 ? clamp(((point.x - a.x) * ab.x + (point.y - a.y) * ab.y) / denom, 0, 1) : 0;
  return lerp(a, b, t);
}

export function nearestPointOnPolygonEdge(point: Point, polygon: Point[]): Point {
  let best = polygon[0] ?? ORIGIN;
  let bestDist = Infinity;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const candidate = nearestPointOnSegment(point, a, b);
    const d = distance(point, candidate);
    if (d < bestDist) {
      best = candidate;
      bestDist = d;
    }
  }
  return best;
}

export function insetPolygon(polygon: Point[], margin: number): Point[] {
  if (margin <= 0) return polygon.map((p) => ({ ...p }));
  const cx = polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length;
  const cy = polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length;
  return polygon.map((p) => {
    const inward = normalize({ x: cx - p.x, y: cy - p.y });
    return add(p, scale(inward, margin));
  });
}
