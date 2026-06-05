import { add, distance, evalBezier, evalBezierDerivative, normalize, perpendicular, scale } from './geometry';
import type { BezierSegment, Point } from './types';

function fmt(n: number): string { return Number(n.toFixed(2)).toString(); }
function cmd(point: Point): string { return `${fmt(point.x)} ${fmt(point.y)}`; }
function polyline(points: Point[]): string { return points.slice(1).map((p) => `L ${cmd(p)}`).join(' '); }

export function taperSegment(seg: BezierSegment, minFeatureSize: number): string {
  let arcLength = 0;
  let prev = seg.start;
  for (let i = 1; i <= 20; i += 1) {
    const p = evalBezier(seg.start, seg.c1, seg.c2, seg.end, i / 20);
    arcLength += distance(prev, p);
    prev = p;
  }
  const samples = Math.min(80, Math.max(8, Math.ceil(arcLength / 2)));
  const left: Point[] = [];
  const right: Point[] = [];
  const centers: Point[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const center = evalBezier(seg.start, seg.c1, seg.c2, seg.end, t);
    const tangent = normalize(evalBezierDerivative(seg.start, seg.c1, seg.c2, seg.end, t));
    const perp = normalize(perpendicular(tangent));
    const thickness = seg.startThickness + (seg.endThickness - seg.startThickness) * t;
    centers.push(center);
    left.push(add(center, scale(perp, thickness / 2)));
    right.push(add(center, scale(perp, -thickness / 2)));
  }
  const endRadius = Math.max(seg.endThickness / 2, 0.1);
  const startRadius = Math.max(seg.startThickness / 2, 0.1);
  const reversedRight = [...right].reverse();
  const endCap = seg.endThickness >= minFeatureSize ? `A ${fmt(endRadius)} ${fmt(endRadius)} 0 0 1 ${cmd(right[right.length - 1])}` : `L ${cmd(centers[centers.length - 1])} L ${cmd(right[right.length - 1])}`;
  const startCap = seg.startThickness >= minFeatureSize ? `A ${fmt(startRadius)} ${fmt(startRadius)} 0 0 1 ${cmd(left[0])}` : `L ${cmd(centers[0])} L ${cmd(left[0])}`;
  return `M ${cmd(left[0])} ${polyline(left)} ${endCap} ${polyline(reversedRight)} ${startCap} Z`;
}
