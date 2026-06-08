import { add, clamp, evalBezier, fromAngle, insetPolygon, lerp, nearestPointOnPolygonEdge, pointInPolygon, scale, sub } from './geometry';
import { defaultSilhouettePreset, getPresetPath } from './silhouettes';
import type { Mask, Point, TreeParams } from './types';

function format(n: number): string { return Number(n.toFixed(3)).toString(); }
function pointsAttr(points: Point[]): string { return points.map((p) => `${format(p.x)},${format(p.y)}`).join(' '); }
function polygonBounds(polygon: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  return polygon.reduce((b, p) => ({ minX: Math.min(b.minX, p.x), minY: Math.min(b.minY, p.y), maxX: Math.max(b.maxX, p.x), maxY: Math.max(b.maxY, p.y) }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
}

export class CircleMask implements Mask {
  constructor(private readonly radius: number) {}
  contains(point: Point): boolean { return Math.hypot(point.x, point.y) <= this.radius + 1e-6; }
  projectInside(point: Point, margin: number): Point {
    const maxLen = Math.max(1, this.radius - margin);
    const len = Math.hypot(point.x, point.y);
    return len > maxLen ? scale(point, maxLen / len) : point;
  }
  boundaryPoint(angleRadians: number, margin: number): Point { return fromAngle(angleRadians, Math.max(1, this.radius - margin)); }
  bounds(): { minX: number; minY: number; maxX: number; maxY: number } { return { minX: -this.radius, minY: -this.radius, maxX: this.radius, maxY: this.radius }; }
  svgClipPath(id: string): string { return `<clipPath id="${id}"><circle cx="0" cy="0" r="${format(this.radius)}" /></clipPath>`; }
  svgOutline(): string { return `<circle cx="0" cy="0" r="${format(this.radius)}" />`; }
}

class PolygonMask implements Mask {
  protected readonly polygon: Point[];
  constructor(polygon: Point[]) { this.polygon = polygon; }
  contains(point: Point): boolean { return pointInPolygon(point, this.polygon); }
  projectInside(point: Point, margin: number): Point {
    const inset = insetPolygon(this.polygon, margin);
    return pointInPolygon(point, inset) ? point : nearestPointOnPolygonEdge(point, inset);
  }
  boundaryPoint(angleRadians: number, margin: number): Point {
    const dir = fromAngle(angleRadians);
    const inset = insetPolygon(this.polygon, margin);
    let best: Point | null = null;
    let bestT = Infinity;
    for (let i = 0; i < inset.length; i += 1) {
      const a = inset[i];
      const b = inset[(i + 1) % inset.length];
      const edge = sub(b, a);
      const cross = dir.x * edge.y - dir.y * edge.x;
      if (Math.abs(cross) < 1e-9) continue;
      const t = (a.x * edge.y - a.y * edge.x) / cross;
      const u = (a.x * dir.y - a.y * dir.x) / cross;
      if (t >= 0 && u >= 0 && u <= 1 && t < bestT) {
        bestT = t;
        best = scale(dir, t);
      }
    }
    return best ?? nearestPointOnPolygonEdge(scale(dir, 1_000), inset);
  }
  bounds(): { minX: number; minY: number; maxX: number; maxY: number } { return polygonBounds(this.polygon); }
  svgClipPath(id: string): string { return `<clipPath id="${id}"><polygon points="${pointsAttr(this.polygon)}" /></clipPath>`; }
  svgOutline(): string { return `<polygon points="${pointsAttr(this.polygon)}" />`; }
}

export class StarMask extends PolygonMask {
  constructor(radius: number, points: number, innerRatio: number) {
    const count = Math.max(3, Math.round(points));
    const polygon = Array.from({ length: count * 2 }, (_, i) => {
      const angle = (i * Math.PI) / count - Math.PI / 2;
      const r = i % 2 === 0 ? radius : radius * clamp(innerRatio, 0.05, 0.95);
      return fromAngle(angle, r);
    });
    super(polygon);
  }
}

export class HeartMask extends PolygonMask {
  constructor(radius: number) {
    const raw: Point[] = [];
    for (let i = 0; i < 128; i += 1) {
      const t = (i / 128) * Math.PI * 2;
      raw.push({ x: 16 * Math.sin(t) ** 3, y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) });
    }
    super(scalePolygonToRadius(raw, radius));
  }
}

type PathToken = string | number;
function tokenizePath(pathData: string): PathToken[] {
  return [...pathData.matchAll(/[MmLlCcQqZz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g)].map((m) => (/^[A-Za-z]$/.test(m[0]) ? m[0] : Number(m[0])));
}
function isCommand(token: PathToken | undefined): token is string { return typeof token === 'string'; }
function quadraticPoint(p0: Point, p1: Point, p2: Point, t: number): Point { return lerp(lerp(p0, p1, t), lerp(p1, p2, t), t); }
function scalePolygonToRadius(raw: Point[], radius: number): Point[] {
  const b = polygonBounds(raw);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const s = (radius * 2) / Math.max(b.maxX - b.minX, b.maxY - b.minY, 1);
  return raw.map((p) => ({ x: (p.x - cx) * s, y: (p.y - cy) * s }));
}
function parsePathToPolygon(pathData: string, radius: number): Point[] {
  const tokens = tokenizePath(pathData);
  const points: Point[] = [];
  let i = 0;
  let command = '';
  let current: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };
  const read = (): number => Number(tokens[i++]);
  while (i < tokens.length) {
    if (isCommand(tokens[i])) command = String(tokens[i++]);
    const relative = command === command.toLowerCase();
    const cmd = command.toUpperCase();
    if (cmd === 'Z') { points.push(start); continue; }
    if (cmd === 'M' || cmd === 'L') {
      const next = { x: read(), y: read() };
      current = relative ? add(current, next) : next;
      if (cmd === 'M') start = current;
      points.push(current);
    } else if (cmd === 'C') {
      const c1raw = { x: read(), y: read() };
      const c2raw = { x: read(), y: read() };
      const endRaw = { x: read(), y: read() };
      const c1 = relative ? add(current, c1raw) : c1raw;
      const c2 = relative ? add(current, c2raw) : c2raw;
      const end = relative ? add(current, endRaw) : endRaw;
      for (let step = 1; step <= 8; step += 1) points.push(evalBezier(current, c1, c2, end, step / 8));
      current = end;
    } else if (cmd === 'Q') {
      const cRaw = { x: read(), y: read() };
      const endRaw = { x: read(), y: read() };
      const c = relative ? add(current, cRaw) : cRaw;
      const end = relative ? add(current, endRaw) : endRaw;
      for (let step = 1; step <= 8; step += 1) points.push(quadraticPoint(current, c, end, step / 8));
      current = end;
    } else {
      i += 1;
    }
  }
  return scalePolygonToRadius(points.length >= 3 ? points : [{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: 0, y: 1 }], radius);
}

export class SilhouetteMask extends PolygonMask {
  constructor(radius: number, pathData: string) { super(parsePathToPolygon(pathData, radius)); }
}

export function createMask(params: TreeParams): Mask {
  if (params.maskShape === 'star') return new StarMask(params.maskRadius, params.starPoints, params.starInnerRatio);
  if (params.maskShape === 'heart') return new HeartMask(params.maskRadius);
  if (params.maskShape === 'silhouette') {
    const path = params.silhouettePath.trim() || getPresetPath(params.silhouettePreset) || (getPresetPath(defaultSilhouettePreset) ?? '');
    return new SilhouetteMask(params.maskRadius, path);
  }
  return new CircleMask(params.maskRadius);
}
