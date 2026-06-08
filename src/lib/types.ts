export interface Point {
  x: number;
  y: number;
}

export interface TreeParams {
  canvasSize: number;
  maskShape: 'circle' | 'star' | 'heart' | 'silhouette';
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

export type NodeKind = 'trunk' | 'branch' | 'root';

export interface TreeNode {
  id: number;
  position: Point;
  parentId: number | null;
  childIds: number[];
  depth: number;
  thickness: number;
  kind: NodeKind;
}

export interface BezierSegment {
  start: Point;
  c1: Point;
  c2: Point;
  end: Point;
  startThickness: number;
  endThickness: number;
}

export interface Chain {
  kind: NodeKind;
  nodeIds: number[];
  segments: BezierSegment[];
  depth: number;
}

export interface LeafPrimitive {
  center: Point;
  radius: number;
  angle: number;
}

export interface TreeModel {
  params: TreeParams;
  nodes: TreeNode[];
  chains: Chain[];
  leaves: LeafPrimitive[];
  warnings: string[];
  stats: {
    nodeCount: number;
    chainCount: number;
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
