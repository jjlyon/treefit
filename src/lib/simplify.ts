import { distance } from './geometry';
import type { Point } from './types';

function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  if (dx === 0 && dy === 0) return distance(point, lineStart);
  const numerator = Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x);
  return numerator / Math.hypot(dx, dy);
}

export function simplifyPolyline(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2 || tolerance <= 0) return points;
  let maxDistance = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i += 1) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > maxDistance) {
      index = i;
      maxDistance = d;
    }
  }

  if (maxDistance > tolerance) {
    const left = simplifyPolyline(points.slice(0, index + 1), tolerance);
    const right = simplifyPolyline(points.slice(index), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [points[0], points[end]];
}
