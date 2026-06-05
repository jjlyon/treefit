import { add, lerp, scale, sub } from './geometry';
import type { BezierSegment, Chain, Point, TreeNode } from './types';

export function extractChains(nodes: TreeNode[]): Chain[] {
  const chains: Chain[] = [];
  const starts = nodes.filter((node) => node.parentId === null || node.childIds.length > 1);
  for (const start of starts) {
    for (const childId of start.childIds) {
      const nodeIds = [start.id, childId];
      let current = nodes[childId];
      while (current.childIds.length === 1) {
        const nextId = current.childIds[0];
        nodeIds.push(nextId);
        current = nodes[nextId];
      }
      chains.push({ kind: nodes[childId].kind === 'root' ? 'root' : start.kind, nodeIds, segments: [], depth: start.depth });
    }
  }
  if (chains.length === 0 && nodes.length > 1) {
    chains.push({ kind: nodes[0].kind, nodeIds: nodes.map((node) => node.id), segments: [], depth: 0 });
  }
  return chains;
}

function reflected(endpoint: Point, neighbor: Point): Point {
  return add(endpoint, sub(endpoint, neighbor));
}

export function fitCurves(nodePositions: Point[], thicknesses: number[], tension: number): BezierSegment[] {
  if (nodePositions.length < 2) return [];
  const points = nodePositions.length > 14 ? nodePositions.filter((_, i) => i % 2 === 0 || i === nodePositions.length - 1) : nodePositions;
  const thick = nodePositions.length > 14 ? thicknesses.filter((_, i) => i % 2 === 0 || i === thicknesses.length - 1) : thicknesses;
  if (points.length === 2) {
    const start = points[0];
    const end = points[1];
    return [{ start, c1: lerp(start, end, 1 / 3), c2: lerp(start, end, 2 / 3), end, startThickness: thick[0], endThickness: thick[1] }];
  }
  const factor = Math.max(0.01, 1 - tension) / 6;
  const segments: BezierSegment[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = i === 0 ? reflected(points[0], points[1]) : points[i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i + 2 < points.length ? points[i + 2] : reflected(points[points.length - 1], points[points.length - 2]);
    segments.push({
      start: p1,
      c1: add(p1, scale(sub(p2, p0), factor)),
      c2: sub(p2, scale(sub(p3, p1), factor)),
      end: p2,
      startThickness: thick[i],
      endThickness: thick[i + 1],
    });
  }
  return segments;
}
