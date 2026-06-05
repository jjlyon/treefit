import { bezierArcLength, bezierTangent, lerpNumber, perpendicular, sampleBezier, scale, add, sub } from './geometry';
import type { Point } from './types';

function fmt(value: number): string { return Number.isFinite(value) ? Number(value.toFixed(3)).toString() : '0'; }
function pointCmd(prefix: string, p: Point): string { return `${prefix} ${fmt(p.x)} ${fmt(p.y)}`; }

export function taperSegment(start: Point, c1: Point, c2: Point, end: Point, startThickness: number, endThickness: number, minFeatureSize: number): string {
  const bezier = { start, c1, c2, end };
  const sampleCount = Math.max(8, Math.ceil(bezierArcLength(bezier, 20) / 2));
  const left: Point[] = []; const right: Point[] = [];
  for (let i = 0; i <= sampleCount; i += 1) {
    const t = i / sampleCount;
    const p = sampleBezier(bezier, t);
    const tangent = bezierTangent(bezier, t);
    const perp = perpendicular(tangent);
    const thickness = Math.max(0.05, lerpNumber(startThickness, endThickness, t));
    const half = (endThickness < minFeatureSize && i === sampleCount) ? 0 : thickness / 2;
    left.push(add(p, scale(perp, half)));
    right.push(sub(p, scale(perp, half)));
  }
  const path = [pointCmd('M', left[0]), ...left.slice(1).map((p) => pointCmd('L', p)), ...right.reverse().map((p) => pointCmd('L', p)), 'Z'];
  return path.join(' ');
}
