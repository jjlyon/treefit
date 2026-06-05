export interface Point {
  x: number;
  y: number;
}

export type SegmentKind = 'trunk' | 'branch' | 'root';
export type MaskShape = 'circle' | 'star' | 'heart' | 'silhouette';

export interface TreeParams {
  canvasSize: number;
  maskShape: MaskShape;
  maskRadius: number;
  maskMargin: number;
  starPoints: number;
  starInnerRatio: number;
  silhouettePreset: string;
  silhouettePath: string;
  showMask: boolean;
  seed: string;
  attractorCount: number;
  influenceRadius: number;
  killRadius: number;
  stepSize: number;
  jitter: number;
  trunkLength: number;
  rootBalance: number;
  trunkThickness: number;
  minThickness: number;
  curveSmoothness: number;
  showLeaves: boolean;
  leafSize: number;
  minFeatureSize: number;
}

export interface TreeNode {
  id: number;
  position: Point;
  parentId: number | null;
  childIds: number[];
  depth: number;
  thickness: number;
  kind: SegmentKind;
}

export interface BezierSegment {
  id: string;
  kind: SegmentKind;
  start: Point;
  c1: Point;
  c2: Point;
  end: Point;
  startThickness: number;
  endThickness: number;
  depth: number;
  startNodeId: number;
  endNodeId: number;
}

export interface TreeChain {
  id: string;
  kind: SegmentKind;
  nodeIds: number[];
  segments: BezierSegment[];
  depth: number;
}

export interface LeafPrimitive {
  id: string;
  kind: 'leaf';
  center: Point;
  radius: number;
  rotation: number;
}

export interface TreeModel {
  params: TreeParams;
  nodes: TreeNode[];
  chains: TreeChain[];
  leaves: LeafPrimitive[];
  warnings: string[];
  maskSvgClipPath: string;
  maskSvgOutline: string;
  stats: {
    nodeCount: number;
    chainCount: number;
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
  svgClipPath(id: string): string;
  svgOutline(): string;
}
