import { add, clamp, fromAngle, length, nearestPointOnPolygon, pointInPolygon, polygonBounds, scale, sub } from './geometry';
import { getSilhouettePath } from './silhouettes';
import type { Mask, Point, TreeParams } from './types';

function fmt(value: number): string { return Number(value.toFixed(3)).toString(); }
function polygonPath(poly: Point[]): string { return `M ${poly.map((p) => `${fmt(p.x)} ${fmt(p.y)}`).join(' L ')} Z`; }
function shrinkTowardOrigin(point: Point, margin: number): Point { const len = length(point); return len === 0 ? point : scale(point, Math.max(0, len - margin) / len); }

abstract class PolygonMask implements Mask {
  protected readonly polygon: Point[];
  private readonly cachedBounds: { minX: number; minY: number; maxX: number; maxY: number };

  constructor(polygon: Point[]) { this.polygon = polygon; this.cachedBounds = polygonBounds(polygon); }
  contains(point: Point): boolean { return pointInPolygon(point, this.polygon); }
  projectInside(point: Point, margin: number): Point {
    const inner = shrinkTowardOrigin(point, margin);
    if (this.contains(inner)) return inner;
    const edge = nearestPointOnPolygon(point, this.polygon);
    return shrinkTowardOrigin(edge, margin + 0.5);
  }
  boundaryPoint(angleRadians: number, margin: number): Point {
    const ray = fromAngle(angleRadians, 1);
    let best: Point | null = null; let bestT = Infinity;
    for (let i = 0; i < this.polygon.length; i += 1) {
      const a = this.polygon[i]; const b = this.polygon[(i + 1) % this.polygon.length]; const edge = sub(b, a);
      const denom = ray.x * edge.y - ray.y * edge.x;
      if (Math.abs(denom) < 1e-9) continue;
      const t = (a.x * edge.y - a.y * edge.x) / denom;
      const u = (a.x * ray.y - a.y * ray.x) / denom;
      if (t >= 0 && u >= 0 && u <= 1 && t < bestT) { bestT = t; best = scale(ray, t); }
    }
    return best ? shrinkTowardOrigin(best, margin) : { x: 0, y: 0 };
  }
  bounds() { return this.cachedBounds; }
  svgClipPath(id: string): string { return `<clipPath id="${id}"><path d="${polygonPath(this.polygon)}" /></clipPath>`; }
  svgOutline(): string { return `<path d="${polygonPath(this.polygon)}" />`; }
}

export class CircleMask implements Mask {
  constructor(public readonly radius: number) {}
  contains(point: Point): boolean { return length(point) <= this.radius + 1e-6; }
  projectInside(point: Point, margin: number): Point { const limit = Math.max(0, this.radius - margin); const len = length(point); return len <= limit || len === 0 ? point : scale(point, limit / len); }
  boundaryPoint(angleRadians: number, margin: number): Point { return fromAngle(angleRadians, Math.max(0, this.radius - margin)); }
  bounds() { return { minX: -this.radius, minY: -this.radius, maxX: this.radius, maxY: this.radius }; }
  svgClipPath(id: string): string { return `<clipPath id="${id}"><circle cx="0" cy="0" r="${fmt(this.radius)}" /></clipPath>`; }
  svgOutline(): string { return `<circle cx="0" cy="0" r="${fmt(this.radius)}" />`; }
}

export class StarMask extends PolygonMask {
  constructor(radius: number, points = 5, innerRadiusRatio = 0.45) {
    const safePoints = Math.round(clamp(points, 3, 12)); const inner = radius * clamp(innerRadiusRatio, 0.2, 0.8);
    const poly = Array.from({ length: safePoints * 2 }, (_, i) => fromAngle(-Math.PI / 2 + (i * Math.PI) / safePoints, i % 2 === 0 ? radius : inner));
    super(poly);
  }
}

export class HeartMask extends PolygonMask {
  constructor(radius: number) {
    const raw = Array.from({ length: 192 }, (_, i) => {
      const t = (i / 192) * Math.PI * 2;
      return { x: 16 * Math.sin(t) ** 3, y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) };
    });
    const b = polygonBounds(raw); const s = (radius * 2) / Math.max(b.maxX - b.minX, b.maxY - b.minY);
    const center = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
    super(raw.map((p) => scale(sub(p, center), s * 0.98)));
  }
}

function tokenizePath(path: string): string[] { return path.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/gi) ?? []; }
function parsePathToPoints(path: string): Point[] {
  const tokens = tokenizePath(path); const points: Point[] = []; let i = 0; let cmd = ''; let current: Point = { x: 0, y: 0 }; let start: Point = current;
  const num = () => Number(tokens[i++]);
  const hasNum = () => i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i]);
  while (i < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase(); const upper = cmd.toUpperCase();
    if (upper === 'Z') { points.push(start); continue; }
    if (upper === 'M' || upper === 'L') while (hasNum()) { const p = { x: num(), y: num() }; current = rel ? add(current, p) : p; if (upper === 'M') start = current; points.push(current); cmd = rel ? 'l' : 'L'; }
    else if (upper === 'C') while (hasNum()) { const c1 = rel ? add(current, { x: num(), y: num() }) : { x: num(), y: num() }; const c2 = rel ? add(current, { x: num(), y: num() }) : { x: num(), y: num() }; const end = rel ? add(current, { x: num(), y: num() }) : { x: num(), y: num() }; for (let s = 1; s <= 12; s += 1) { const t = s / 12, mt = 1 - t; points.push({ x: mt ** 3 * current.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t ** 3 * end.x, y: mt ** 3 * current.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t ** 3 * end.y }); } current = end; }
    else if (upper === 'Q') while (hasNum()) { const c = rel ? add(current, { x: num(), y: num() }) : { x: num(), y: num() }; const end = rel ? add(current, { x: num(), y: num() }) : { x: num(), y: num() }; for (let s = 1; s <= 12; s += 1) { const t = s / 12, mt = 1 - t; points.push({ x: mt * mt * current.x + 2 * mt * t * c.x + t * t * end.x, y: mt * mt * current.y + 2 * mt * t * c.y + t * t * end.y }); } current = end; }
    else break;
  }
  return points.length >= 3 ? points : [{ x: 0, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }];
}

export class SilhouetteMask extends PolygonMask {
  constructor(radius: number, path: string) {
    const raw = parsePathToPoints(path); const b = polygonBounds(raw); const s = (radius * 2) / Math.max(b.maxX - b.minX, b.maxY - b.minY || 1);
    const center = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
    super(raw.map((p) => scale(sub(p, center), s * 0.96)));
  }
}

export function createMask(params: TreeParams): Mask {
  if (params.maskShape === 'star') return new StarMask(params.maskRadius, params.starPoints, params.starInnerRatio);
  if (params.maskShape === 'heart') return new HeartMask(params.maskRadius);
  if (params.maskShape === 'silhouette') return new SilhouetteMask(params.maskRadius, getSilhouettePath(params.silhouettePreset, params.silhouettePath));
  return new CircleMask(params.maskRadius);
}
