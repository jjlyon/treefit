export interface Point {
  x: number;
  y: number;
}

export type RenderMode = 'stroke' | 'outline';
export type GenerationMode = 'structured' | 'wild';
export type SegmentKind = 'trunk' | 'branch' | 'root';

export interface TreeParams {
  canvasSize: number;
  radius: number;
  seed: string;
  branchDensity: number;
  rootDensity: number;
  maxBranchDepth: number;
  maxRootDepth: number;
  trunkThickness: number;
  minThickness: number;
  branchRootBalance: number;
  curvature: number;
  jitter: number;
  margin: number;
  minFeatureSize: number;
  simplifyTolerance: number;
  renderMode: RenderMode;
  generationMode: GenerationMode;
  showMask: boolean;
  showRoots: boolean;
  showBarkDetail: boolean;
  showLeaves: boolean;
}

export interface BranchSegment {
  id: string;
  kind: SegmentKind;
  start: Point;
  c1: Point;
  c2: Point;
  end: Point;
  startThickness: number;
  endThickness: number;
  depth: number;
  parentId?: string;
  childrenIds: string[];
}

export interface LinePrimitive {
  id: string;
  kind: 'line';
  start: Point;
  end: Point;
  width: number;
}

export interface CirclePrimitive {
  id: string;
  kind: 'circle';
  center: Point;
  radius: number;
}

export interface LeafPrimitive {
  id: string;
  kind: 'leaf';
  center: Point;
  radius: number;
  rotation: number;
}

export type BarkPrimitive = LinePrimitive;

export interface TreeModel {
  params: TreeParams;
  segments: BranchSegment[];
  barkDetails: BarkPrimitive[];
  leaves: LeafPrimitive[];
  warnings: string[];
  stats: {
    segmentCount: number;
    estimatedPathCount: number;
    generationMs: number;
  };
}

export interface Mask {
  contains(point: Point): boolean;
  projectInside(point: Point, margin: number): Point;
  boundaryPoint(angleRadians: number, margin: number): Point;
  bounds(): { minX: number; minY: number; maxX: number; maxY: number };
}
