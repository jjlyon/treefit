import { catmullRomToBezier } from './geometry';
import type { BezierSegment, SegmentKind, TreeChain, TreeNode } from './types';

function nodeKind(nodes: TreeNode[], ids: number[]): SegmentKind {
  return nodes[ids.find((id) => nodes[id].kind !== 'trunk') ?? ids[0]].kind;
}

export function extractChains(nodes: TreeNode[]): number[][] {
  const chains: number[][] = [];
  const starts = nodes.filter((node) => node.parentId === null || node.childIds.length !== 1 || node.kind === 'trunk');
  const seen = new Set<string>();
  for (const start of starts) {
    for (const childId of start.childIds) {
      const key = `${start.id}-${childId}`;
      if (seen.has(key)) continue;
      const chain = [start.id];
      let current = nodes[childId];
      while (current) {
        chain.push(current.id);
        seen.add(`${current.parentId}-${current.id}`);
        if (current.childIds.length !== 1 || current.kind !== nodes[current.childIds[0]]?.kind) break;
        current = nodes[current.childIds[0]];
      }
      if (chain.length >= 2) chains.push(chain);
    }
  }
  return chains;
}

export function fitChains(nodes: TreeNode[], curveSmoothness: number): TreeChain[] {
  return extractChains(nodes).map((nodeIds, chainIndex) => {
    const kind = nodeKind(nodes, nodeIds);
    const segments: BezierSegment[] = [];
    for (let i = 0; i < nodeIds.length - 1; i += 1) {
      const prev = nodes[nodeIds[Math.max(0, i - 1)]].position;
      const a = nodes[nodeIds[i]];
      const b = nodes[nodeIds[i + 1]];
      const next = nodes[nodeIds[Math.min(nodeIds.length - 1, i + 2)]].position;
      const bezier = catmullRomToBezier(prev, a.position, b.position, next, curveSmoothness);
      segments.push({
        id: `${kind}-${chainIndex.toString(36)}-${i.toString(36)}`,
        kind,
        ...bezier,
        startThickness: a.thickness,
        endThickness: b.thickness,
        depth: a.depth,
        startNodeId: a.id,
        endNodeId: b.id,
      });
    }
    return { id: `chain-${chainIndex.toString(36)}`, kind, nodeIds, segments, depth: nodes[nodeIds[0]].depth };
  });
}
