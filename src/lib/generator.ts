import { CircleMask } from './masks';
import { SeededRandom } from './random';
import type { BarkPrimitive, BranchSegment, LeafPrimitive, Mask, Point, SegmentKind, TreeModel, TreeParams } from './types';
import { add, angleOf, clamp, distance, fromAngle, isFinitePoint, length, lerp, normalize, perpendicular, scale, sub } from './geometry';

interface GenContext {
  params: TreeParams;
  rng: SeededRandom;
  mask: Mask;
  segments: BranchSegment[];
  barkDetails: BarkPrimitive[];
  leaves: LeafPrimitive[];
  warnings: string[];
  segmentBudget: number;
  counter: number;
}

function cubicControls(start: Point, end: Point, bend: number, rng: SeededRandom, jitter: number): { c1: Point; c2: Point } {
  const vec = sub(end, start);
  const perp = perpendicular(normalize(vec));
  const len = length(vec);
  const offset = bend * len * 0.22 + rng.signed(jitter * len * 0.08);
  return {
    c1: add(lerp(start, end, 0.34), scale(perp, offset)),
    c2: add(lerp(start, end, 0.68), scale(perp, offset * 0.7 + rng.signed(jitter * len * 0.04))),
  };
}

function addSegment(ctx: GenContext, segment: Omit<BranchSegment, 'id' | 'childrenIds'>): BranchSegment | undefined {
  if (ctx.segments.length >= ctx.segmentBudget) return undefined;
  if (distance(segment.start, segment.end) < ctx.params.minFeatureSize) return undefined;
  if (![segment.start, segment.c1, segment.c2, segment.end].every(isFinitePoint)) return undefined;
  const id = `${segment.kind}-${ctx.counter.toString(36)}`;
  ctx.counter += 1;
  const full: BranchSegment = { ...segment, id, childrenIds: [] };
  ctx.segments.push(full);
  if (segment.parentId) {
    const parent = ctx.segments.find((candidate) => candidate.id === segment.parentId);
    parent?.childrenIds.push(id);
  }
  return full;
}

function endpointTowardBoundary(ctx: GenContext, start: Point, angle: number, lengthScale: number, density: number): Point {
  const target = ctx.mask.boundaryPoint(angle, ctx.params.margin + ctx.params.minFeatureSize * 0.5);
  const t = clamp(0.28 + density * 0.46 + ctx.rng.signed(0.08), 0.18, 0.9);
  const raw = lerp(start, target, t * lengthScale);
  const jitter = fromAngle(angle + Math.PI / 2, ctx.rng.signed(ctx.params.jitter * ctx.params.radius * 0.045));
  return ctx.mask.projectInside(add(raw, jitter), ctx.params.margin);
}

function growChildren(ctx: GenContext, parent: BranchSegment, kind: Exclude<SegmentKind, 'trunk'>, depth: number, maxDepth: number, density: number): void {
  if (depth > maxDepth || parent.endThickness < ctx.params.minThickness || ctx.segments.length >= ctx.segmentBudget) return;

  const progress = depth / Math.max(1, maxDepth);
  const baseAngle = kind === 'branch' ? -Math.PI / 2 : Math.PI / 2;
  const parentAngle = angleOf(sub(parent.end, parent.start));
  const outward = parent.end.x >= 0 ? 1 : -1;
  const splitChance = clamp(0.32 + density * 0.62 - progress * 0.16, 0.15, 0.94);
  const childCount = ctx.rng.chance(splitChance) ? (density > 0.68 && ctx.rng.chance(0.38) ? 3 : 2) : 1;
  const balance = kind === 'branch' ? ctx.params.branchRootBalance : 1 - ctx.params.branchRootBalance;

  for (let i = 0; i < childCount; i += 1) {
    const spreadIndex = childCount === 1 ? 0 : (i / (childCount - 1) - 0.5) * 2;
    const side = childCount === 1 ? (ctx.rng.chance(0.5) ? 1 : -1) : Math.sign(spreadIndex || outward);
    const spread = (0.3 + density * 0.62) * spreadIndex;
    const angle = baseAngle + side * (0.22 + density * 0.42 + progress * 0.22) + spread + ctx.rng.signed(ctx.params.jitter * 0.55);
    const coherentAngle = lerp(fromAngle(parentAngle), fromAngle(angle), 0.78);
    const finalAngle = angleOf(coherentAngle);
    const lenScale = clamp(0.52 + balance * 0.28 - progress * 0.16 + ctx.rng.signed(0.08), 0.24, 0.85);
    const end = endpointTowardBoundary(ctx, parent.end, finalAngle, lenScale, density);
    const segmentLength = distance(parent.end, end);
    if (segmentLength < ctx.params.minFeatureSize) continue;
    const taper = kind === 'branch' ? 0.58 : 0.62;
    const endThickness = Math.max(ctx.params.minThickness * 0.55, parent.endThickness * (taper + ctx.rng.range(-0.08, 0.08)));
    const { c1, c2 } = cubicControls(parent.end, end, ctx.rng.signed(ctx.params.curvature), ctx.rng, ctx.params.jitter);
    const child = addSegment(ctx, {
      kind,
      start: parent.end,
      c1: ctx.mask.projectInside(c1, ctx.params.margin),
      c2: ctx.mask.projectInside(c2, ctx.params.margin),
      end,
      startThickness: parent.endThickness,
      endThickness,
      depth,
      parentId: parent.id,
    });
    if (!child) continue;
    maybeAddLeaf(ctx, child, kind, density, depth, maxDepth);
    growChildren(ctx, child, kind, depth + 1, maxDepth, density);
  }
}

function maybeAddLeaf(ctx: GenContext, segment: BranchSegment, kind: SegmentKind, density: number, depth: number, maxDepth: number): void {
  if (!ctx.params.showLeaves || kind !== 'branch' || depth < maxDepth - 1) return;
  if (!ctx.rng.chance(0.18 + density * 0.18)) return;
  const radius = Math.max(ctx.params.minFeatureSize * 0.55, segment.endThickness * 1.6);
  if (radius < ctx.params.minFeatureSize * 0.45) return;
  ctx.leaves.push({ id: `leaf-${ctx.leaves.length.toString(36)}`, kind: 'leaf', center: segment.end, radius, rotation: angleOf(sub(segment.end, segment.start)) });
}

function addBarkDetails(ctx: GenContext): void {
  if (!ctx.params.showBarkDetail) return;
  const major = ctx.segments.filter((s) => (s.kind === 'trunk' || s.startThickness > ctx.params.trunkThickness * 0.28) && distance(s.start, s.end) > ctx.params.minFeatureSize * 3);
  const maxDetails = Math.min(160, Math.floor(30 + ctx.params.branchDensity * 80));
  for (const segment of major) {
    if (ctx.barkDetails.length >= maxDetails) break;
    const count = segment.kind === 'trunk' ? 7 : 2;
    const dir = normalize(sub(segment.end, segment.start));
    const perp = perpendicular(dir);
    for (let i = 0; i < count && ctx.barkDetails.length < maxDetails; i += 1) {
      const t = (i + 1) / (count + 1);
      const center = lerp(segment.start, segment.end, t);
      const span = Math.max(ctx.params.minFeatureSize, segment.startThickness * 0.45);
      const offset = ctx.rng.signed(segment.startThickness * 0.18);
      const start = add(center, add(scale(perp, -span * 0.35 + offset), scale(dir, ctx.rng.signed(span * 0.12))));
      const end = add(center, add(scale(perp, span * 0.35 + offset), scale(dir, ctx.rng.signed(span * 0.12))));
      if (distance(start, end) >= ctx.params.minFeatureSize) {
        ctx.barkDetails.push({ id: `bark-${ctx.barkDetails.length.toString(36)}`, kind: 'line', start, end, width: Math.max(0.45, ctx.params.minThickness * 0.45) });
      }
    }
  }
}

export function generateTree(params: TreeParams): TreeModel {
  const started = performance.now();
  const safeRadius = Math.min(params.radius, params.canvasSize / 2 - 8);
  const safeParams = { ...params, radius: safeRadius, margin: clamp(params.margin, 0, safeRadius - 8) };
  const ctx: GenContext = {
    params: safeParams,
    rng: new SeededRandom(JSON.stringify({ seed: safeParams.seed, p: { ...safeParams, seed: undefined } })),
    mask: new CircleMask(safeRadius),
    segments: [],
    barkDetails: [],
    leaves: [],
    warnings: [],
    segmentBudget: Math.floor(110 + safeParams.branchDensity * 620 + safeParams.rootDensity * 360),
    counter: 0,
  };

  if (safeParams.renderMode === 'outline') ctx.warnings.push('Outline mode is architecturally prepared but falls back to stroke rendering in this MVP.');

  const trunkStart = { x: ctx.rng.signed(safeRadius * 0.025), y: safeRadius * 0.45 };
  const trunkEnd = { x: ctx.rng.signed(safeRadius * 0.035), y: -safeRadius * ctx.rng.range(0.05, 0.15) };
  const trunkBend = ctx.rng.signed(safeParams.curvature * 0.7);
  const trunkControls = cubicControls(trunkStart, trunkEnd, trunkBend, ctx.rng, safeParams.jitter);
  const trunk = addSegment(ctx, {
    kind: 'trunk',
    start: ctx.mask.projectInside(trunkStart, safeParams.margin),
    c1: ctx.mask.projectInside(trunkControls.c1, safeParams.margin),
    c2: ctx.mask.projectInside(trunkControls.c2, safeParams.margin),
    end: ctx.mask.projectInside(trunkEnd, safeParams.margin),
    startThickness: safeParams.trunkThickness,
    endThickness: safeParams.trunkThickness * 0.72,
    depth: 0,
  });

  if (trunk) {
    const branchAnchors = Math.max(2, Math.floor(2 + safeParams.branchDensity * 4));
    for (let i = 0; i < branchAnchors; i += 1) {
      const t = 0.56 + (i / Math.max(1, branchAnchors - 1)) * 0.39;
      const pseudo = { ...trunk, end: lerp(trunk.start, trunk.end, t), endThickness: trunk.endThickness * (1 - i * 0.08) };
      growChildren(ctx, pseudo, 'branch', 1, safeParams.maxBranchDepth, safeParams.branchDensity);
    }
    if (safeParams.showRoots) {
      const rootAnchors = Math.max(1, Math.floor(1 + safeParams.rootDensity * 4));
      for (let i = 0; i < rootAnchors; i += 1) {
        const t = 0.05 + (i / Math.max(1, rootAnchors - 1)) * 0.3;
        const pseudo = { ...trunk, end: lerp(trunk.start, trunk.end, t), endThickness: trunk.startThickness * 0.52 };
        growChildren(ctx, pseudo, 'root', 1, safeParams.maxRootDepth, safeParams.rootDensity);
      }
    }
  }

  addBarkDetails(ctx);
  if (ctx.segments.length >= ctx.segmentBudget) ctx.warnings.push(`Segment budget reached at ${ctx.segmentBudget}; reduce density or depth for lighter SVGs.`);
  const pathCount = ctx.segments.length + ctx.barkDetails.length + ctx.leaves.length + 1;
  if (pathCount > 700) ctx.warnings.push('High path count may slow browsers or CNC CAM import.');

  const generationMs = performance.now() - started;
  return {
    params: safeParams,
    segments: ctx.segments,
    barkDetails: ctx.barkDetails,
    leaves: ctx.leaves,
    warnings: ctx.warnings,
    stats: { segmentCount: ctx.segments.length, estimatedPathCount: pathCount, generationMs },
  };
}
