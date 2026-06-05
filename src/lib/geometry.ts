import type { Point } from './types';

export const ORIGIN: Point = { x: 0, y: 0 };

export function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(p: Point, scalar: number): Point {
  return { x: p.x * scalar, y: p.y * scalar };
}

export function length(p: Point): number {
  return Math.hypot(p.x, p.y);
}

export function distance(a: Point, b: Point): number {
  return length(sub(a, b));
}

export function normalize(p: Point): Point {
  const len = length(p);
  return len === 0 ? { x: 0, y: -1 } : { x: p.x / len, y: p.y / len };
}

export function fromAngle(angle: number, len = 1): Point {
  return { x: Math.cos(angle) * len, y: Math.sin(angle) * len };
}

export function angleOf(p: Point): number {
  return Math.atan2(p.y, p.x);
}

export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function perpendicular(p: Point): Point {
  return { x: -p.y, y: p.x };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function isFinitePoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}
