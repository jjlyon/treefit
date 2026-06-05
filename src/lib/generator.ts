import { SeededRandom } from './random';
import { createMask } from './masks';
import { fitChains } from './spline';
import type { LeafPrimitive, Mask, Point, SegmentKind, TreeModel, TreeNode, TreeParams } from './types';
import { add, angleOf, distance, isFinitePoint, normalize, scale, sub } from './geometry';

interface Attractor { point: Point; }

function addNode(nodes: TreeNode[], position: Point, parentId: number | null, kind: SegmentKind): TreeNode {
  const parent = parentId === null ? null : nodes[parentId];
  const node: TreeNode = { id: nodes.length, position, parentId, childIds: [], depth: parent ? parent.depth + 1 : 0, thickness: 0, kind };
  nodes.push(node);
  if (parent) parent.childIds.push(node.id);
  return node;
}

function scatterAttractors(mask: Mask, rng: SeededRandom, count: number, predicate: (p: Point) => boolean): Attractor[] {
  const bounds = mask.bounds(); const points: Attractor[] = []; let attempts = 0; const maxAttempts = Math.max(1000, count * 80);
  while (points.length < count && attempts < maxAttempts) {
    attempts += 1;
    const point = { x: rng.range(bounds.minX, bounds.maxX), y: rng.range(bounds.minY, bounds.maxY) };
    if (mask.contains(point) && predicate(point)) points.push({ point });
  }
  return points;
}

function grow(nodes: TreeNode[], mask: Mask, rng: SeededRandom, attractors: Attractor[], sourceIds: number[], kind: SegmentKind, params: TreeParams): void {
  let remaining = attractors;
  const candidates = () => nodes.filter((n) => (sourceIds.includes(n.id) || n.childIds.length === 0) && (kind === 'branch' ? n.kind !== 'root' : (n.kind === 'root' || sourceIds.includes(n.id))));
  for (let iteration = 0; iteration < 220 && remaining.length > 0 && nodes.length < params.attractorCount + 32; iteration += 1) {
    const influenced = new Map<number, Point[]>(); const treeNodes = candidates();
    for (const attractor of remaining) {
      let closest: TreeNode | null = null; let closestDistance = params.influenceRadius;
      for (const node of treeNodes) {
        const d = distance(node.position, attractor.point);
        if (d < closestDistance) { closest = node; closestDistance = d; }
      }
      if (closest) {
        const list = influenced.get(closest.id) ?? [];
        list.push(attractor.point);
        influenced.set(closest.id, list);
      }
    }
    if (influenced.size === 0) break;
    const created: TreeNode[] = [];
    for (const [nodeId, points] of influenced) {
      const node = nodes[nodeId];
      let dir = { x: 0, y: 0 };
      for (const point of points) dir = add(dir, normalize(sub(point, node.position)));
      const jitterAngle = rng.signed(params.jitter * Math.PI);
      const n = normalize(dir);
      dir = normalize({ x: n.x * Math.cos(jitterAngle) - n.y * Math.sin(jitterAngle), y: n.x * Math.sin(jitterAngle) + n.y * Math.cos(jitterAngle) });
      const newPos = mask.projectInside(add(node.position, scale(dir, params.stepSize)), params.maskMargin);
      if (distance(newPos, node.position) >= Math.max(0.5, params.minFeatureSize * 0.25) && isFinitePoint(newPos) && mask.contains(newPos)) created.push(addNode(nodes, newPos, node.id, kind));
    }
    if (created.length === 0) break;
    const killNodes = candidates();
    remaining = remaining.filter((attractor) => !killNodes.some((node) => distance(node.position, attractor.point) <= params.killRadius));
  }
}

function computeThickness(nodes: TreeNode[], params: TreeParams): void {
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const node = nodes[i];
    if (node.childIds.length === 0) node.thickness = params.minThickness;
    else node.thickness = Math.sqrt(node.childIds.reduce((sum, id) => sum + nodes[id].thickness ** 2, 0));
    node.thickness = Math.min(params.trunkThickness, Math.max(params.minThickness, node.thickness));
    if (node.kind === 'root') node.thickness = Math.min(node.thickness, params.trunkThickness * 0.55);
  }
}

function buildLeaves(nodes: TreeNode[], params: TreeParams): LeafPrimitive[] {
  return nodes.filter((node) => node.childIds.length === 0 && node.kind === 'branch').map((node) => {
    const parent = node.parentId === null ? node : nodes[node.parentId];
    return { id: `leaf-${node.id.toString(36)}`, kind: 'leaf', center: node.position, radius: Math.max(params.minThickness, node.thickness * params.leafSize * 2.2), rotation: angleOf(sub(node.position, parent.position)) + Math.PI / 2 };
  });
}

export function generateTree(params: TreeParams): TreeModel {
  const started = performance.now(); const warnings: string[] = [];
  const mask = createMask(params); const rng = new SeededRandom(params.seed); const bounds = mask.bounds();
  const height = bounds.maxY - bounds.minY; const branchBudget = Math.round(params.attractorCount * (1 - params.rootBalance)); const rootBudget = Math.round(params.attractorCount * params.rootBalance);
  const trunkBase = mask.projectInside({ x: 0, y: bounds.maxY * 0.9 }, params.maskMargin);
  const trunkTop = mask.projectInside({ x: 0, y: trunkBase.y - height * params.trunkLength }, params.maskMargin);
  const branchAttractors = scatterAttractors(mask, rng, branchBudget, (p) => p.y < trunkTop.y + params.influenceRadius);
  const rootAttractors = scatterAttractors(mask, rng, rootBudget, (p) => p.y > trunkBase.y - params.influenceRadius);
  if (branchAttractors.length < branchBudget * 0.8) warnings.push('Could not place all canopy attractors inside the selected mask.');
  const nodes: TreeNode[] = [];
  const trunkCount = 7; let parentId: number | null = null; const trunkIds: number[] = [];
  for (let i = 0; i < trunkCount; i += 1) {
    const t = i / (trunkCount - 1);
    const p = mask.projectInside({ x: rng.signed(params.stepSize * 0.1), y: trunkBase.y + (trunkTop.y - trunkBase.y) * t }, params.maskMargin);
    const node = addNode(nodes, p, parentId, 'trunk'); trunkIds.push(node.id); parentId = node.id;
  }
  const branchSources = trunkIds.slice(Math.floor(trunkIds.length * 0.55));
  grow(nodes, mask, rng, branchAttractors, branchSources, 'branch', params);
  if (rootBudget > 0) grow(nodes, mask, rng, rootAttractors, [trunkIds[0]], 'root', params);
  computeThickness(nodes, params);
  const chains = fitChains(nodes, params.curveSmoothness);
  const leaves = buildLeaves(nodes, params);
  const segmentCount = chains.reduce((sum, chain) => sum + chain.segments.length, 0);
  return { params, nodes, chains, leaves, warnings, maskSvgClipPath: mask.svgClipPath('tree-clip'), maskSvgOutline: mask.svgOutline(), stats: { nodeCount: nodes.length, chainCount: chains.length, segmentCount, estimatedPathCount: segmentCount + leaves.length, generationMs: performance.now() - started } };
}
