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

interface CandidateSegment {
  kind: SegmentKind;
  start: Point;
  end: Point;
  startThickness: number;
  endThickness: number;
  depth: number;
  parentId?: string;
  bend?: number;
}

const DEG = Math.PI / 180;

function cubicControls(start: Point, end: Point, bend: number, rng: SeededRandom, jitter: number): { c1: Point; c2: Point } {
  const vec = sub(end, start);
  const perp = perpendicular(normalize(vec));
  const len = length(vec);
  const offset = bend * len * 0.18 + rng.signed(jitter * len * 0.035);
  return {
    c1: add(lerp(start, end, 0.34), scale(perp, offset)),
    c2: add(lerp(start, end, 0.68), scale(perp, offset * 0.72 + rng.signed(jitter * len * 0.02))),
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

function signedAngleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

function lineSegmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const r = sub(b, a);
  const s = sub(d, c);
  const denominator = cross(r, s);
  if (Math.abs(denominator) < 1e-6) return false;
  const u = cross(sub(c, a), r) / denominator;
  const t = cross(sub(c, a), s) / denominator;
  return t > 0.04 && t < 0.96 && u > 0.04 && u < 0.96;
}

function sharesEndpoint(candidate: CandidateSegment, existing: BranchSegment): boolean {
  return distance(candidate.start, existing.start) < 0.5 || distance(candidate.start, existing.end) < 0.5 || distance(candidate.end, existing.start) < 0.5 || distance(candidate.end, existing.end) < 0.5;
}

function crossingCount(ctx: GenContext, candidate: CandidateSegment): number {
  return ctx.segments.filter((segment) => {
    if (candidate.parentId === segment.id || sharesEndpoint(candidate, segment)) return false;
    const isMajor = segment.kind === 'trunk' || segment.startThickness > ctx.params.trunkThickness * 0.32;
    return isMajor && lineSegmentsIntersect(candidate.start, candidate.end, segment.start, segment.end);
  }).length;
}

function shortenUntilClean(ctx: GenContext, candidate: CandidateSegment, maxCrossings: number): CandidateSegment | undefined {
  let current = { ...candidate };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (crossingCount(ctx, current) <= maxCrossings && distance(current.start, current.end) >= minimumLengthForDepth(ctx, current.kind, current.depth)) return current;
    current = { ...current, end: lerp(current.start, current.end, 0.78) };
  }
  return undefined;
}

function createSegment(ctx: GenContext, candidate: CandidateSegment, maxCrossings = 0): BranchSegment | undefined {
  const clean = shortenUntilClean(ctx, candidate, maxCrossings);
  if (!clean) return undefined;
  let end = ctx.mask.projectInside(clean.end, ctx.params.margin);
  if (clean.kind === 'branch' && end.y >= clean.start.y) {
    end = ctx.mask.projectInside({ ...end, y: clean.start.y - Math.max(ctx.params.minFeatureSize, distance(clean.start, end) * 0.18) }, ctx.params.margin);
  }
  if (clean.kind === 'root' && end.y <= clean.start.y) {
    end = ctx.mask.projectInside({ ...end, y: clean.start.y + Math.max(ctx.params.minFeatureSize, distance(clean.start, end) * 0.18) }, ctx.params.margin);
  }
  const { c1, c2 } = cubicControls(clean.start, end, clean.bend ?? ctx.rng.signed(ctx.params.curvature), ctx.rng, ctx.params.jitter);
  return addSegment(ctx, {
    kind: clean.kind,
    start: ctx.mask.projectInside(clean.start, ctx.params.margin),
    c1: ctx.mask.projectInside(c1, ctx.params.margin),
    c2: ctx.mask.projectInside(c2, ctx.params.margin),
    end,
    startThickness: clean.startThickness,
    endThickness: clean.endThickness,
    depth: clean.depth,
    parentId: clean.parentId,
  });
}

function minimumLengthForDepth(ctx: GenContext, kind: SegmentKind, depth: number): number {
  const base = kind === 'root' ? 5.5 : 6.5;
  return Math.max(ctx.params.minFeatureSize, ctx.params.radius * (base / 100) * Math.pow(0.72, Math.max(0, depth - 1)));
}

function pointOnTrunk(trunk: BranchSegment[], t: number): { point: Point; segment: BranchSegment } {
  const clamped = clamp(t, 0, 1);
  const scaled = clamped * trunk.length;
  const index = Math.min(trunk.length - 1, Math.floor(scaled));
  const local = scaled - index;
  const segment = trunk[index];
  return { point: lerp(segment.start, segment.end, local), segment };
}

function generateStructuredTrunk(ctx: GenContext): BranchSegment[] {
  const r = ctx.params.radius;
  const bottom: Point = { x: ctx.rng.signed(r * 0.012), y: r * 0.46 };
  const lower: Point = { x: ctx.rng.signed(r * 0.018), y: r * 0.23 };
  const middle: Point = { x: ctx.rng.signed(r * 0.02), y: r * 0.03 };
  const crown: Point = { x: ctx.rng.signed(r * 0.026), y: -r * 0.16 };
  const points = [bottom, lower, middle, crown].map((point) => ctx.mask.projectInside(point, ctx.params.margin));
  const thicknesses = [ctx.params.trunkThickness, ctx.params.trunkThickness * 0.92, ctx.params.trunkThickness * 0.78, ctx.params.trunkThickness * 0.66];
  const trunk: BranchSegment[] = [];

  for (let i = 0; i < points.length - 1; i += 1) {
    const segment = createSegment(ctx, {
      kind: 'trunk',
      start: points[i],
      end: points[i + 1],
      startThickness: thicknesses[i],
      endThickness: thicknesses[i + 1],
      depth: i,
      parentId: trunk.at(-1)?.id,
      bend: ctx.rng.signed(ctx.params.curvature * 0.38),
    });
    if (segment) trunk.push(segment);
  }
  return trunk;
}

function lerpNumber(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function primaryBranchAngles(ctx: GenContext, count: number): number[] {
  const angles: number[] = [];
  const perSideRank = { left: 0, right: 0 };
  const perSideTotal = { left: Math.ceil(count / 2), right: Math.floor(count / 2) };

  for (let i = 0; i < count; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const sideKey = side === -1 ? 'left' : 'right';
    const rank = perSideTotal[sideKey] <= 1 ? 0.5 : perSideRank[sideKey] / (perSideTotal[sideKey] - 1);
    perSideRank[sideKey] += 1;
    const rightAngle = lerpNumber(-42 * DEG, -82 * DEG, rank);
    const angle = side === 1 ? rightAngle : -Math.PI - rightAngle;
    angles.push(angle + ctx.rng.signed(ctx.params.jitter * 4 * DEG));
  }

  return angles;
}

function terminalAttraction(ctx: GenContext, start: Point, angle: number, rawLength: number, amount: number): Point {
  const freeEnd = add(start, fromAngle(angle, rawLength));
  if (amount <= 0) return freeEnd;
  const boundary = ctx.mask.boundaryPoint(angle, ctx.params.margin + ctx.params.minFeatureSize);
  return lerp(freeEnd, boundary, clamp(amount, 0, 0.52));
}

function growStructuredBranch(ctx: GenContext, parent: BranchSegment, depth: number, maxDepth: number, density: number): void {
  if (depth > maxDepth || parent.endThickness <= ctx.params.minThickness || ctx.segments.length >= ctx.segmentBudget) return;

  const parentAngle = angleOf(sub(parent.end, parent.start));
  const side = Math.cos(parentAngle) >= 0 ? 1 : -1;
  const remaining = maxDepth - depth;
  const isTwigStage = remaining <= 2;
  const childLimit = isTwigStage ? (density > 0.55 ? 2 : 1) : (density > 0.78 ? 3 : 2);
  const probability = clamp(0.45 + density * 0.48 - depth * 0.035, 0.2, 0.9);
  const childCount = depth <= 2 ? Math.min(2, childLimit) : (ctx.rng.chance(probability) ? childLimit : 1);
  const parentLength = distance(parent.start, parent.end);
  const attachBase = isTwigStage ? 0.78 : 0.68;

  for (let i = 0; i < childCount; i += 1) {
    if (i > 0 && !ctx.rng.chance(probability)) continue;
    const spreadIndex = childCount === 1 ? 0 : (i / (childCount - 1) - 0.5) * 2;
    const outwardBias = side * (10 + 12 * Math.abs(spreadIndex)) * DEG;
    const upwardBias = -Math.abs(spreadIndex) * 8 * DEG;
    const deviation = clamp(spreadIndex * (18 + density * 12) * DEG + outwardBias + upwardBias + ctx.rng.signed(ctx.params.jitter * 10 * DEG), -48 * DEG, 48 * DEG);
    let angle = parentAngle + deviation;
    if (Math.sin(angle) > -0.08) angle = side === 1 ? -18 * DEG : -162 * DEG;
    if (Math.abs(signedAngleDelta(parentAngle, angle)) > 82 * DEG) continue;

    const attach = lerp(parent.start, parent.end, clamp(attachBase + ctx.rng.range(0, 0.22), 0.62, 0.96));
    const depthScale = Math.pow(0.7, Math.max(0, depth - 1));
    const len = Math.max(minimumLengthForDepth(ctx, 'branch', depth), parentLength * ctx.rng.range(0.48, 0.74) * (isTwigStage ? 0.82 : 1) + ctx.params.radius * 0.08 * depthScale);
    const attraction = isTwigStage ? density * 0.26 : 0;
    const end = terminalAttraction(ctx, attach, angle, len, attraction);
    const taper = isTwigStage ? ctx.rng.range(0.48, 0.62) : ctx.rng.range(0.58, 0.74);
    const child = createSegment(ctx, {
      kind: 'branch',
      start: attach,
      end,
      startThickness: Math.min(parent.endThickness * 0.92, ctx.params.trunkThickness * 0.56),
      endThickness: Math.max(ctx.params.minThickness, parent.endThickness * taper),
      depth,
      parentId: parent.id,
      bend: ctx.rng.signed(ctx.params.curvature * 0.8),
    });
    if (!child) continue;
    maybeAddLeaf(ctx, child, 'branch', density, depth, maxDepth);
    growStructuredBranch(ctx, child, depth + 1, maxDepth, density);
  }
}

function generateStructuredBranches(ctx: GenContext, trunk: BranchSegment[]): void {
  const count = Math.round(6 + ctx.params.branchDensity * 6);
  const angles = primaryBranchAngles(ctx, count);
  for (let i = 0; i < angles.length; i += 1) {
    const upperT = 0.42 + (i / Math.max(1, angles.length - 1)) * 0.52;
    const { point, segment: trunkSegment } = pointOnTrunk(trunk, upperT);
    const side = Math.cos(angles[i]) >= 0 ? 1 : -1;
    const len = ctx.params.radius * ctx.rng.range(0.22, 0.36) * (0.9 + ctx.params.branchRootBalance * 0.24);
    const end = add(point, fromAngle(angles[i], len));
    const startThickness = ctx.params.trunkThickness * ctx.rng.range(0.45, 0.65);
    const primary = createSegment(ctx, {
      kind: 'branch',
      start: point,
      end: add(end, { x: side * ctx.rng.range(0, ctx.params.jitter * ctx.params.radius * 0.018), y: ctx.rng.signed(ctx.params.jitter * ctx.params.radius * 0.015) }),
      startThickness,
      endThickness: Math.max(ctx.params.minThickness * 1.6, startThickness * ctx.rng.range(0.58, 0.72)),
      depth: 1,
      parentId: trunkSegment.id,
      bend: side * ctx.params.curvature * ctx.rng.range(0.12, 0.55),
    }, 4);
    if (primary) growStructuredBranch(ctx, primary, 2, ctx.params.maxBranchDepth, ctx.params.branchDensity);
  }
}

function growStructuredRoot(ctx: GenContext, parent: BranchSegment, depth: number, maxDepth: number, density: number): void {
  if (depth > maxDepth || parent.endThickness <= ctx.params.minThickness || ctx.segments.length >= ctx.segmentBudget) return;
  const parentAngle = angleOf(sub(parent.end, parent.start));
  const side = Math.cos(parentAngle) >= 0 ? 1 : -1;
  const childCount = depth <= 2 ? (density > 0.62 ? 2 : 1) : (ctx.rng.chance(0.28 + density * 0.38) ? 2 : 1);
  const parentLength = distance(parent.start, parent.end);

  for (let i = 0; i < childCount; i += 1) {
    const spreadIndex = childCount === 1 ? 0 : (i / (childCount - 1) - 0.5) * 2;
    const deviation = spreadIndex * (18 + density * 10) * DEG + side * 8 * DEG + ctx.rng.signed(ctx.params.jitter * 9 * DEG);
    let angle = parentAngle + deviation;
    if (Math.sin(angle) < 0.16) angle = side === 1 ? 34 * DEG : 146 * DEG;
    if (Math.abs(signedAngleDelta(parentAngle, angle)) > 78 * DEG) continue;
    const attach = lerp(parent.start, parent.end, clamp(0.72 + ctx.rng.range(0, 0.22), 0.66, 0.96));
    const len = Math.max(minimumLengthForDepth(ctx, 'root', depth), parentLength * ctx.rng.range(0.45, 0.7));
    const end = add(attach, fromAngle(angle, len));
    const child = createSegment(ctx, {
      kind: 'root',
      start: attach,
      end,
      startThickness: Math.min(parent.endThickness * 0.9, ctx.params.trunkThickness * 0.48),
      endThickness: Math.max(ctx.params.minThickness, parent.endThickness * ctx.rng.range(0.52, 0.7)),
      depth,
      parentId: parent.id,
      bend: ctx.rng.signed(ctx.params.curvature * 0.7),
    });
    if (child) growStructuredRoot(ctx, child, depth + 1, maxDepth, density);
  }
}

function generateStructuredRoots(ctx: GenContext, trunk: BranchSegment[]): void {
  if (!ctx.params.showRoots || ctx.params.maxRootDepth <= 0) return;
  const count = Math.round(5 + ctx.params.rootDensity * 5);
  for (let i = 0; i < count; i += 1) {
    const rank = count <= 1 ? 0.5 : i / (count - 1);
    const { point, segment: trunkSegment } = pointOnTrunk(trunk, ctx.rng.range(0.01, 0.14));
    const angle = lerpNumber(35 * DEG, 145 * DEG, rank) + ctx.rng.signed(ctx.params.jitter * 6 * DEG);
    const len = ctx.params.radius * ctx.rng.range(0.18, 0.3) * (1.1 - ctx.params.branchRootBalance * 0.22);
    const startThickness = ctx.params.trunkThickness * ctx.rng.range(0.34, 0.5);
    const primary = createSegment(ctx, {
      kind: 'root',
      start: point,
      end: add(point, fromAngle(angle, len)),
      startThickness,
      endThickness: Math.max(ctx.params.minThickness * 1.4, startThickness * ctx.rng.range(0.58, 0.72)),
      depth: 1,
      parentId: trunkSegment.id,
      bend: ctx.rng.signed(ctx.params.curvature * 0.55),
    }, 1);
    if (primary) growStructuredRoot(ctx, primary, 2, ctx.params.maxRootDepth, ctx.params.rootDensity);
  }
}

function endpointTowardBoundary(ctx: GenContext, start: Point, angle: number, lengthScale: number, density: number): Point {
  const target = ctx.mask.boundaryPoint(angle, ctx.params.margin + ctx.params.minFeatureSize * 0.5);
  const t = clamp(0.22 + density * 0.36 + ctx.rng.signed(0.05), 0.14, 0.72);
  const raw = lerp(start, target, t * lengthScale);
  const jitter = fromAngle(angle + Math.PI / 2, ctx.rng.signed(ctx.params.jitter * ctx.params.radius * 0.025));
  return ctx.mask.projectInside(add(raw, jitter), ctx.params.margin);
}

function growWildChildren(ctx: GenContext, parent: BranchSegment, kind: Exclude<SegmentKind, 'trunk'>, depth: number, maxDepth: number, density: number): void {
  if (depth > maxDepth || parent.endThickness < ctx.params.minThickness || ctx.segments.length >= ctx.segmentBudget) return;
  const progress = depth / Math.max(1, maxDepth);
  const baseAngle = kind === 'branch' ? -Math.PI / 2 : Math.PI / 2;
  const parentAngle = angleOf(sub(parent.end, parent.start));
  const splitChance = clamp(0.25 + density * 0.52 - progress * 0.18, 0.12, 0.78);
  const childCount = ctx.rng.chance(splitChance) ? 2 : 1;

  for (let i = 0; i < childCount; i += 1) {
    const spreadIndex = childCount === 1 ? 0 : (i / (childCount - 1) - 0.5) * 2;
    const angle = baseAngle + spreadIndex * (0.35 + density * 0.45) + ctx.rng.signed(ctx.params.jitter * 0.35);
    const coherentAngle = angleOf(lerp(fromAngle(parentAngle), fromAngle(angle), 0.7));
    const end = endpointTowardBoundary(ctx, parent.end, coherentAngle, 0.42 + ctx.rng.range(0, 0.24), density);
    const child = createSegment(ctx, {
      kind,
      start: parent.end,
      end,
      startThickness: Math.min(parent.endThickness * 0.9, ctx.params.trunkThickness * 0.52),
      endThickness: Math.max(ctx.params.minThickness, parent.endThickness * ctx.rng.range(0.52, 0.68)),
      depth,
      parentId: parent.id,
      bend: ctx.rng.signed(ctx.params.curvature),
    }, 1);
    if (!child) continue;
    maybeAddLeaf(ctx, child, kind, density, depth, maxDepth);
    growWildChildren(ctx, child, kind, depth + 1, maxDepth, density);
  }
}

function generateWild(ctx: GenContext): void {
  const trunk = generateStructuredTrunk(ctx);
  if (trunk.length === 0) return;
  const branchAnchors = Math.max(4, Math.floor(5 + ctx.params.branchDensity * 5));
  for (let i = 0; i < branchAnchors; i += 1) {
    const { point, segment } = pointOnTrunk(trunk, 0.43 + (i / Math.max(1, branchAnchors - 1)) * 0.5);
    const pseudo = { ...segment, end: point, endThickness: ctx.params.trunkThickness * 0.5 };
    growWildChildren(ctx, pseudo, 'branch', 1, ctx.params.maxBranchDepth, ctx.params.branchDensity);
  }
  if (ctx.params.showRoots) {
    const rootAnchors = Math.max(4, Math.floor(5 + ctx.params.rootDensity * 4));
    for (let i = 0; i < rootAnchors; i += 1) {
      const { point, segment } = pointOnTrunk(trunk, ctx.rng.range(0.01, 0.15));
      const pseudo = { ...segment, end: point, endThickness: ctx.params.trunkThickness * 0.42 };
      growWildChildren(ctx, pseudo, 'root', 1, ctx.params.maxRootDepth, ctx.params.rootDensity);
    }
  }
}

function maybeAddLeaf(ctx: GenContext, segment: BranchSegment, kind: SegmentKind, density: number, depth: number, maxDepth: number): void {
  if (!ctx.params.showLeaves || kind !== 'branch' || depth < maxDepth - 1) return;
  if (!ctx.rng.chance(0.1 + density * 0.16)) return;
  const radius = Math.max(ctx.params.minFeatureSize * 0.55, segment.endThickness * 1.45);
  if (radius < ctx.params.minFeatureSize * 0.45) return;
  ctx.leaves.push({ id: `leaf-${ctx.leaves.length.toString(36)}`, kind: 'leaf', center: segment.end, radius, rotation: angleOf(sub(segment.end, segment.start)) });
}

function addBarkDetails(ctx: GenContext): void {
  if (!ctx.params.showBarkDetail) return;
  const major = ctx.segments.filter((s) => (s.kind === 'trunk' || s.startThickness > ctx.params.trunkThickness * 0.36) && distance(s.start, s.end) > ctx.params.minFeatureSize * 3);
  const maxDetails = Math.min(100, Math.floor(22 + ctx.params.branchDensity * 48));
  for (const segment of major) {
    if (ctx.barkDetails.length >= maxDetails) break;
    const count = segment.kind === 'trunk' ? 5 : 1;
    const dir = normalize(sub(segment.end, segment.start));
    const perp = perpendicular(dir);
    for (let i = 0; i < count && ctx.barkDetails.length < maxDetails; i += 1) {
      const t = (i + 1) / (count + 1);
      const center = lerp(segment.start, segment.end, t);
      const span = Math.max(ctx.params.minFeatureSize, segment.startThickness * 0.36);
      const offset = ctx.rng.signed(segment.startThickness * 0.12);
      const start = add(center, add(scale(perp, -span * 0.3 + offset), scale(dir, ctx.rng.signed(span * 0.08))));
      const end = add(center, add(scale(perp, span * 0.3 + offset), scale(dir, ctx.rng.signed(span * 0.08))));
      if (distance(start, end) >= ctx.params.minFeatureSize) {
        ctx.barkDetails.push({ id: `bark-${ctx.barkDetails.length.toString(36)}`, kind: 'line', start, end, width: Math.max(0.45, ctx.params.minThickness * 0.42) });
      }
    }
  }
}

export function generateTree(params: TreeParams): TreeModel {
  const started = performance.now();
  const safeRadius = Math.min(params.radius, params.canvasSize / 2 - 8);
  const safeParams = { ...params, generationMode: params.generationMode ?? 'structured', radius: safeRadius, margin: clamp(params.margin, 0, safeRadius - 8) };
  const ctx: GenContext = {
    params: safeParams,
    rng: new SeededRandom(JSON.stringify({ seed: safeParams.seed, p: { ...safeParams, seed: undefined } })),
    mask: new CircleMask(safeRadius),
    segments: [],
    barkDetails: [],
    leaves: [],
    warnings: [],
    segmentBudget: Math.floor(90 + safeParams.branchDensity * 360 + safeParams.rootDensity * 210),
    counter: 0,
  };

  if (safeParams.renderMode === 'outline') ctx.warnings.push('Outline mode is architecturally prepared but falls back to stroke rendering in this MVP.');

  if (safeParams.generationMode === 'wild') {
    ctx.warnings.push('Wild mode is intentionally less constrained; structured mode is recommended for readable CNC trees.');
    generateWild(ctx);
  } else {
    const trunk = generateStructuredTrunk(ctx);
    if (trunk.length > 0) {
      generateStructuredBranches(ctx, trunk);
      generateStructuredRoots(ctx, trunk);
    }
  }

  addBarkDetails(ctx);
  if (ctx.segments.length >= ctx.segmentBudget) ctx.warnings.push(`Segment budget reached at ${ctx.segmentBudget}; reduce density or depth for lighter SVGs.`);
  const pathCount = ctx.segments.length + ctx.barkDetails.length + ctx.leaves.length + 1;
  if (pathCount > 520) ctx.warnings.push('High path count may slow browsers or CNC CAM import.');

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
