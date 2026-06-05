import { add, angleOf, clamp, distance, isFinitePoint, normalize, scale, sub } from './geometry';
import { createMask } from './masks';
import { SeededRandom } from './random';
import { extractChains, fitCurves } from './spline';
import type { LeafPrimitive, Mask, NodeKind, Point, TreeModel, TreeNode, TreeParams } from './types';

function now(): number { return typeof performance === 'undefined' ? 0 : performance.now(); }

function scatterAttractors(mask: Mask, rng: SeededRandom, count: number, predicate: (point: Point) => boolean): Point[] {
  const bounds = mask.bounds();
  const points: Point[] = [];
  let attempts = 0;
  const maxAttempts = Math.max(2_000, count * 80);
  while (points.length < count && attempts < maxAttempts) {
    attempts += 1;
    const point = { x: rng.range(bounds.minX, bounds.maxX), y: rng.range(bounds.minY, bounds.maxY) };
    if (mask.contains(point) && predicate(point)) points.push(point);
  }
  return points;
}

function createTrunk(params: TreeParams, rng: SeededRandom, mask: Mask): TreeNode[] {
  const radius = params.maskRadius - params.maskMargin;
  const trunkBase = mask.projectInside({ x: 0, y: radius * 0.45 }, params.maskMargin);
  const trunkTop = mask.projectInside({ x: 0, y: radius * (0.45 - params.trunkLength * 1.35) }, params.maskMargin);
  const count = clamp(Math.round(5 + params.trunkLength * 6), 5, 8);
  const nodes: TreeNode[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const wave = Math.sin(t * Math.PI * 1.2) * radius * 0.018;
    const position = mask.projectInside({ x: wave + rng.signed(params.maskRadius * 0.03), y: trunkBase.y + (trunkTop.y - trunkBase.y) * t }, params.maskMargin);
    nodes.push({ id: i, position, parentId: i === 0 ? null : i - 1, childIds: i === 0 ? [] : [], depth: i, thickness: 0, kind: 'trunk' });
    if (i > 0) nodes[i - 1].childIds.push(i);
  }
  return nodes;
}

function grow(allNodes: TreeNode[], attractors: Point[], params: TreeParams, mask: Mask, rng: SeededRandom, kind: NodeKind, canGrow: (node: TreeNode) => boolean): void {
  let remainingAttractors = attractors;
  for (let iteration = 0; iteration < 600 && remainingAttractors.length > 0 && allNodes.length < 2_500; iteration += 1) {
    const influenceMap = new Map<number, Point[]>();
    for (const attractor of remainingAttractors) {
      let closestNode: TreeNode | null = null;
      let closestDist = Infinity;
      for (const node of allNodes) {
        if (!canGrow(node)) continue;
        const d = distance(attractor, node.position);
        if (d < closestDist && d < params.influenceRadius) {
          closestNode = node;
          closestDist = d;
        }
      }
      if (closestNode) {
        const list = influenceMap.get(closestNode.id) ?? [];
        list.push(attractor);
        influenceMap.set(closestNode.id, list);
      }
    }
    if (influenceMap.size === 0) break;
    const newNodes: TreeNode[] = [];
    for (const [nodeId, pullers] of influenceMap) {
      const node = allNodes[nodeId];
      let avgDir: Point = { x: 0, y: 0 };
      for (const attractor of pullers) avgDir = add(avgDir, normalize(sub(attractor, node.position)));
      avgDir = normalize({ x: avgDir.x + rng.signed(params.jitter), y: avgDir.y + rng.signed(params.jitter) });
      if (!isFinitePoint(avgDir) || distance(avgDir, { x: 0, y: 0 }) < 1e-9) continue;
      const newPos = mask.projectInside(add(node.position, scale(avgDir, params.stepSize)), params.maskMargin);
      if (distance(newPos, node.position) < params.minFeatureSize) continue;
      const newNode: TreeNode = { id: allNodes.length + newNodes.length, position: newPos, parentId: nodeId, childIds: [], depth: node.depth + 1, thickness: 0, kind };
      node.childIds.push(newNode.id);
      newNodes.push(newNode);
    }
    if (newNodes.length === 0) break;
    allNodes.push(...newNodes);
    remainingAttractors = remainingAttractors.filter((attractor) => !allNodes.some((node) => distance(attractor, node.position) < params.killRadius));
  }
}

function computeThickness(nodes: TreeNode[], params: TreeParams): void {
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const node = nodes[i];
    if (node.childIds.length === 0) {
      node.thickness = params.minThickness;
    } else {
      const sumSquares = node.childIds.reduce((sum, childId) => sum + nodes[childId].thickness ** 2, 0);
      node.thickness = Math.min(params.trunkThickness, Math.max(params.minThickness, Math.sqrt(sumSquares)));
    }
  }
}

function collectLeaves(nodes: TreeNode[], params: TreeParams): LeafPrimitive[] {
  return nodes.filter((node) => node.kind === 'branch' && node.childIds.length === 0 && node.parentId !== null).map((node) => {
    const parent = nodes[node.parentId ?? 0];
    return { center: node.position, radius: Math.max(params.minFeatureSize * 0.25, params.leafSize * node.thickness * 2), angle: angleOf(sub(node.position, parent.position)) };
  });
}

export function generateTree(params: TreeParams): TreeModel {
  const started = now();
  const mask = createMask(params);
  const rng = new SeededRandom(params.seed);
  const radius = params.maskRadius - params.maskMargin;
  const trunkBaseY = radius * 0.45;
  const trunkTopY = radius * (0.45 - params.trunkLength * 1.35);
  const branchBudget = Math.floor(params.attractorCount * (1 - params.rootBalance));
  const rootBudget = params.attractorCount - branchBudget;
  const branchAttractors = scatterAttractors(mask, rng, branchBudget, (point) => point.y < trunkTopY + params.influenceRadius);
  const rootAttractors = scatterAttractors(mask, rng, rootBudget, (point) => point.y > trunkBaseY - params.influenceRadius);
  const nodes = createTrunk(params, rng, mask);
  const trunkBaseIds = new Set(nodes.slice(0, 3).map((node) => node.id));
  grow(nodes, branchAttractors, params, mask, rng, 'branch', (node) => node.kind !== 'root');
  if (rootBudget > 0) grow(nodes, rootAttractors, params, mask, rng, 'root', (node) => node.kind === 'root' || trunkBaseIds.has(node.id));
  computeThickness(nodes, params);
  const chains = extractChains(nodes).map((chain) => {
    const positions = chain.nodeIds.map((id) => nodes[id].position);
    const thicknesses = chain.nodeIds.map((id) => nodes[id].thickness);
    return { ...chain, segments: fitCurves(positions, thicknesses, params.curveSmoothness) };
  }).filter((chain) => chain.segments.length > 0);
  const leaves = collectLeaves(nodes, params);
  const estimatedPathCount = chains.reduce((count, chain) => count + chain.segments.length, 0) + (params.showLeaves ? leaves.length : 0);
  const warnings: string[] = [];
  if (nodes.length > 2_000) warnings.push('High node count may create complex SVGs for some CNC workflows.');
  if (branchAttractors.length < branchBudget * 0.75 || rootAttractors.length < rootBudget * 0.75) warnings.push('Some attractors could not be placed inside the selected mask regions.');
  return { params: { ...params }, nodes, chains, leaves, warnings, stats: { nodeCount: nodes.length, chainCount: chains.length, estimatedPathCount, generationMs: Math.max(0, now() - started) } };
}
