import { add, lerp, scale, sub } from './geometry';
import type { BezierSegment, Chain, Point, TreeNode } from './types';

function findTrunkSpine(nodes: TreeNode[]): number[] {
  const root = nodes.find((node) => node.parentId === null && node.kind === 'trunk');
  if (!root) return [];
  const spine = [root.id];
  let current = root;
  while (true) {
    const trunkChildren = current.childIds.filter((childId) => nodes[childId].kind === 'trunk');
    if (trunkChildren.length === 0) break;
    const nextId = trunkChildren.reduce((bestId, childId) => {
      const bestDelta = nodes[bestId].position.y - current.position.y;
      const childDelta = nodes[childId].position.y - current.position.y;
      return childDelta < bestDelta ? childId : bestId;
    }, trunkChildren[0]);
    spine.push(nextId);
    current = nodes[nextId];
  }
  return spine;
}

function walkChain(nodes: TreeNode[], startId: number, childId: number): number[] {
  const nodeIds = [startId, childId];
  let current = nodes[childId];
  while (current.childIds.length === 1) {
    const nextId = current.childIds[0];
    nodeIds.push(nextId);
    current = nodes[nextId];
  }
  return nodeIds;
}

export function extractChains(nodes: TreeNode[]): Chain[] {
  const chains: Chain[] = [];
  const trunkSpine = findTrunkSpine(nodes);
  const trunkNextByNode = new Map<number, number>();
  for (let i = 0; i < trunkSpine.length - 1; i += 1) trunkNextByNode.set(trunkSpine[i], trunkSpine[i + 1]);

  if (trunkSpine.length >= 2) {
    chains.push({ kind: 'trunk', nodeIds: trunkSpine, segments: [], depth: nodes[trunkSpine[0]].depth });
  }

  for (const node of nodes) {
    const isTrunkNode = node.kind === 'trunk';
    const isNonTrunkFork = !isTrunkNode && node.childIds.length > 1;
    if (!isTrunkNode && !isNonTrunkFork) continue;

    const trunkSpineChild = trunkNextByNode.get(node.id);
    for (const childId of node.childIds) {
      if (childId === trunkSpineChild) continue;
      const child = nodes[childId];
      chains.push({ kind: child.kind, nodeIds: walkChain(nodes, node.id, childId), segments: [], depth: node.depth });
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
