import { add, angleOf, clamp, isFinitePoint, normalize, scale, sub } from './geometry';
import { createMask } from './masks';
import { SeededRandom } from './random';
import { extractChains, fitCurves } from './spline';
import type { LeafPrimitive, Mask, NodeKind, Point, TreeModel, TreeNode, TreeParams } from './types';

function now(): number { return typeof performance === 'undefined' ? 0 : performance.now(); }
function distanceSquared(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

class SpatialGrid {
  private readonly cells = new Map<string, TreeNode[]>();
  private readonly cellSize: number;

  constructor(cellSize: number) {
    this.cellSize = Math.max(1, cellSize);
  }

  private key(x: number, y: number): string {
    return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
  }

  insert(node: TreeNode): void {
    const key = this.key(node.position.x, node.position.y);
    const list = this.cells.get(key);
    if (list) list.push(node);
    else this.cells.set(key, [node]);
  }

  queryNear(point: Point, radius: number): TreeNode[] {
    const results: TreeNode[] = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const cx = Math.floor(point.x / this.cellSize);
    const cy = Math.floor(point.y / this.cellSize);
    for (let dx = -cellRadius; dx <= cellRadius; dx += 1) {
      for (let dy = -cellRadius; dy <= cellRadius; dy += 1) {
        const cell = this.cells.get(`${cx + dx},${cy + dy}`);
        if (cell) results.push(...cell);
      }
    }
    return results;
  }

  closestWithin(point: Point, radius: number, canGrow: (node: TreeNode) => boolean): TreeNode | null {
    const cellRadius = Math.ceil(radius / this.cellSize);
    const cx = Math.floor(point.x / this.cellSize);
    const cy = Math.floor(point.y / this.cellSize);
    const radiusSquared = radius * radius;
    let closestNode: TreeNode | null = null;
    let closestDist = Infinity;
    for (let dx = -cellRadius; dx <= cellRadius; dx += 1) {
      for (let dy = -cellRadius; dy <= cellRadius; dy += 1) {
        const cell = this.cells.get(`${cx + dx},${cy + dy}`);
        if (!cell) continue;
        for (const node of cell) {
          if (!canGrow(node)) continue;
          const d = distanceSquared(point, node.position);
          if (d < closestDist && d < radiusSquared) {
            closestNode = node;
            closestDist = d;
          }
        }
      }
    }
    return closestNode;
  }


  hasAnyWithin(point: Point, radius: number): boolean {
    const cellRadius = Math.ceil(radius / this.cellSize);
    const cx = Math.floor(point.x / this.cellSize);
    const cy = Math.floor(point.y / this.cellSize);
    const radiusSquared = radius * radius;
    for (let dx = -cellRadius; dx <= cellRadius; dx += 1) {
      for (let dy = -cellRadius; dy <= cellRadius; dy += 1) {
        const cell = this.cells.get(`${cx + dx},${cy + dy}`);
        if (!cell) continue;
        for (const node of cell) {
          if (distanceSquared(point, node.position) < radiusSquared) return true;
        }
      }
    }
    return false;
  }
}

function scatterAttractors(mask: Mask, rng: SeededRandom, count: number, acceptChance: (point: Point, bounds: ReturnType<Mask['bounds']>) => number): Point[] {
  const bounds = mask.bounds();
  const points: Point[] = [];
  let attempts = 0;
  const maxAttempts = Math.max(4_000, count * 100);
  while (points.length < count && attempts < maxAttempts) {
    attempts += 1;
    const point = { x: rng.range(bounds.minX, bounds.maxX), y: rng.range(bounds.minY, bounds.maxY) };
    if (mask.contains(point) && rng.chance(clamp(acceptChance(point, bounds), 0.02, 1))) points.push(point);
  }
  return points;
}

function branchAcceptChance(point: Point, bounds: ReturnType<Mask['bounds']>): number {
  const maskHeight = Math.max(1, bounds.maxY - bounds.minY);
  const normalizedY = (point.y - bounds.minY) / maskHeight;
  return 0.05 + 0.95 * (1 - normalizedY);
}

function rootAcceptChance(point: Point, bounds: ReturnType<Mask['bounds']>): number {
  const maskHeight = Math.max(1, bounds.maxY - bounds.minY);
  const normalizedY = (point.y - bounds.minY) / maskHeight;
  return 0.05 + 0.95 * normalizedY;
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

function runGrowthIterations(allNodes: TreeNode[], grid: SpatialGrid, remainingAttractors: Point[], params: TreeParams, mask: Mask, rng: SeededRandom, kind: NodeKind, canGrow: (node: TreeNode) => boolean, influenceRadius: number, maxIterations: number, nodeBudget: number): Point[] {
  let attractors = remainingAttractors;
  const deferredAttractors: Point[] = [];
  for (let iteration = 0; iteration < maxIterations && attractors.length > 0 && allNodes.length < nodeBudget; iteration += 1) {
    const influenceMap = new Map<number, Point[]>();
    const activeAttractors: Point[] = [];
    for (const attractor of attractors) {
      const closestNode = grid.closestWithin(attractor, influenceRadius, canGrow);
      if (closestNode) {
        activeAttractors.push(attractor);
        const list = influenceMap.get(closestNode.id) ?? [];
        list.push(attractor);
        influenceMap.set(closestNode.id, list);
      } else {
        deferredAttractors.push(attractor);
      }
    }
    if (influenceMap.size === 0) break;

    const newNodes: TreeNode[] = [];
    for (const [nodeId, pullers] of influenceMap) {
      const node = allNodes[nodeId];
      let avgDir: Point = { x: 0, y: 0 };
      for (const attractor of pullers) avgDir = add(avgDir, normalize(sub(attractor, node.position)));
      if (kind === 'branch') avgDir.y -= 0.12;
      if (kind === 'root') avgDir.y += 0.12;
      avgDir = normalize({ x: avgDir.x + rng.signed(params.jitter), y: avgDir.y + rng.signed(params.jitter) });
      if (!isFinitePoint(avgDir) || distanceSquared(avgDir, { x: 0, y: 0 }) < 1e-9) continue;
      const newPos = mask.projectInside(add(node.position, scale(avgDir, params.stepSize)), params.maskMargin);
      if (distanceSquared(newPos, node.position) < params.minFeatureSize * params.minFeatureSize) continue;
      const newNode: TreeNode = { id: allNodes.length + newNodes.length, position: newPos, parentId: nodeId, childIds: [], depth: node.depth + 1, thickness: 0, kind };
      node.childIds.push(newNode.id);
      newNodes.push(newNode);
    }
    if (newNodes.length === 0) break;
    allNodes.push(...newNodes);
    for (const node of newNodes) grid.insert(node);
    attractors = activeAttractors.filter((attractor) => !grid.hasAnyWithin(attractor, params.killRadius));
  }
  return [...attractors, ...deferredAttractors];
}

function grow(allNodes: TreeNode[], attractors: Point[], params: TreeParams, mask: Mask, rng: SeededRandom, kind: NodeKind, canGrow: (node: TreeNode) => boolean): void {
  const grid = new SpatialGrid(Math.max(params.killRadius, params.influenceRadius));
  for (const node of allNodes) {
    if (canGrow(node)) grid.insert(node);
  }
  const nodeBudget = Math.min(6_000, Math.max(1_100, Math.floor(params.attractorCount * 0.55)));
  const remainingAttractors = runGrowthIterations(allNodes, grid, attractors, params, mask, rng, kind, canGrow, params.influenceRadius, 1200, nodeBudget);
  if (remainingAttractors.length > 0) {
    runGrowthIterations(allNodes, grid, remainingAttractors, params, mask, rng, kind, canGrow, params.influenceRadius * 1.5, 200, nodeBudget);
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
  const branchBudget = Math.floor(params.attractorCount * (1 - params.rootBalance));
  const rootBudget = params.attractorCount - branchBudget;
  const branchAttractors = scatterAttractors(mask, rng, branchBudget, branchAcceptChance);
  const rootAttractors = scatterAttractors(mask, rng, rootBudget, rootAcceptChance);
  const nodes = createTrunk(params, rng, mask);
  const branchStartIdx = Math.floor(nodes.length * 0.4);
  const rootEndIdx = Math.floor(nodes.length * 0.5);
  const branchTrunkIds = new Set(nodes.slice(branchStartIdx).map((node) => node.id));
  const rootTrunkIds = new Set(nodes.slice(0, rootEndIdx).map((node) => node.id));
  grow(nodes, branchAttractors, params, mask, rng, 'branch', (node) => node.kind === 'branch' || branchTrunkIds.has(node.id));
  if (rootBudget > 0) grow(nodes, rootAttractors, params, mask, rng, 'root', (node) => node.kind === 'root' || rootTrunkIds.has(node.id));
  computeThickness(nodes, params);
  const chains = extractChains(nodes).map((chain) => {
    const positions = chain.nodeIds.map((id) => nodes[id].position);
    const thicknesses = chain.nodeIds.map((id) => nodes[id].thickness);
    return { ...chain, segments: fitCurves(positions, thicknesses, params.curveSmoothness) };
  }).filter((chain) => chain.segments.length > 0);
  const leaves = collectLeaves(nodes, params);
  const estimatedPathCount = chains.reduce((count, chain) => count + chain.segments.length, 0) + (params.showLeaves ? leaves.length : 0);
  const warnings: string[] = [];
  if (nodes.length > 4_000) warnings.push('High node count may create complex SVGs for some CNC workflows.');
  if (branchAttractors.length < branchBudget * 0.75 || rootAttractors.length < rootBudget * 0.75) warnings.push('Some attractors could not be placed inside the selected mask regions.');
  return { params: { ...params }, nodes, chains, leaves, warnings, stats: { nodeCount: nodes.length, chainCount: chains.length, estimatedPathCount, generationMs: Math.max(0, now() - started) } };
}
