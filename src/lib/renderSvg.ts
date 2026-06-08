import { createMask } from './masks';
import { taperSegment } from './taperOutline';
import type { BezierSegment, Chain, LeafPrimitive, NodeKind, Point, TreeModel, TreeNode, TreeParams } from './types';

function fmt(n: number): string { return Number(n.toFixed(2)).toString(); }
function transform(point: Point, angle: number, radius: number, localX: number, localY: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: point.x + (localX * cos - localY * sin) * radius, y: point.y + (localX * sin + localY * cos) * radius };
}
function leafPath(leaf: LeafPrimitive): string {
  const tip = transform(leaf.center, leaf.angle, leaf.radius, 1.4, 0);
  const c1 = transform(leaf.center, leaf.angle, leaf.radius, 0.5, -1.0);
  const c2 = transform(leaf.center, leaf.angle, leaf.radius, -1.1, -0.7);
  const base = transform(leaf.center, leaf.angle, leaf.radius, -0.8, 0);
  const c3 = transform(leaf.center, leaf.angle, leaf.radius, -1.1, 0.7);
  const c4 = transform(leaf.center, leaf.angle, leaf.radius, 0.5, 1.0);
  return `M ${fmt(tip.x)} ${fmt(tip.y)} C ${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(base.x)} ${fmt(base.y)} C ${fmt(c3.x)} ${fmt(c3.y)} ${fmt(c4.x)} ${fmt(c4.y)} ${fmt(tip.x)} ${fmt(tip.y)} Z`;
}
function byDepthDesc(a: Chain, b: Chain): number { return b.depth - a.depth; }
function segmentPath(seg: BezierSegment): string {
  return `M ${fmt(seg.start.x)} ${fmt(seg.start.y)} C ${fmt(seg.c1.x)} ${fmt(seg.c1.y)} ${fmt(seg.c2.x)} ${fmt(seg.c2.y)} ${fmt(seg.end.x)} ${fmt(seg.end.y)}`;
}
function isTapered(seg: BezierSegment, taperThreshold: number): boolean {
  return seg.startThickness >= taperThreshold || seg.endThickness >= taperThreshold;
}
function taperedPathsFor(chains: Chain[], fill: string, minFeatureSize: number, taperThreshold: number): string {
  return chains.flatMap((chain) => chain.segments
    .filter((segment) => isTapered(segment, taperThreshold))
    .map((segment) => `<path d="${taperSegment(segment, minFeatureSize)}" fill="${fill}" />`))
    .join('\n');
}
function strokedPathsFor(chains: Chain[], stroke: string, taperThreshold: number): string {
  return chains.flatMap((chain) => chain.segments
    .filter((segment) => !isTapered(segment, taperThreshold))
    .map((segment) => {
      const strokeWidth = Math.max(0.25, (segment.startThickness + segment.endThickness) / 2);
      return `<path d="${segmentPath(segment)}" stroke="${stroke}" stroke-width="${fmt(strokeWidth)}" stroke-linecap="round" stroke-linejoin="round" fill="none" />`;
    }))
    .join('\n');
}
function jointCirclesFor(nodes: TreeNode[], kind: NodeKind, fill: string, taperThreshold: number): string {
  return nodes
    .filter((node) => node.kind === kind && node.childIds.length >= 2 && node.thickness >= taperThreshold)
    .map((node) => `<circle cx="${fmt(node.position.x)}" cy="${fmt(node.position.y)}" r="${fmt(node.thickness / 2)}" fill="${fill}" />`)
    .join('\n');
}

export function viewBoxForParams(params: TreeParams): string {
  const half = params.canvasSize / 2;
  return `${-half} ${-half} ${params.canvasSize} ${params.canvasSize}`;
}

export function modelToSvgInner(model: TreeModel): string {
  const mask = createMask(model.params);
  const taperThreshold = Math.max(3, model.params.trunkThickness * 0.12);
  const roots = model.chains.filter((chain) => chain.kind === 'root').sort(byDepthDesc);
  const trunk = model.chains.filter((chain) => chain.kind === 'trunk');
  const branches = model.chains.filter((chain) => chain.kind === 'branch').sort(byDepthDesc);
  const leaves = model.params.showLeaves ? model.leaves.map((leaf) => `<path d="${leafPath(leaf)}" fill="#111827" />`).join('\n') : '';
  return `<defs>
  ${mask.svgClipPath('tree-clip')}
</defs>
<g id="mask-outline" opacity="${model.params.showMask ? 1 : 0}" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="8 8" fill="none">
  ${mask.svgOutline()}
</g>
<g id="tree" clip-path="url(#tree-clip)">
  <g id="roots">
${taperedPathsFor(roots, '#1f2937', model.params.minFeatureSize, taperThreshold)}
${jointCirclesFor(model.nodes, 'root', '#1f2937', taperThreshold)}
${strokedPathsFor(roots, '#1f2937', taperThreshold)}
  </g>
  <g id="trunk">
${taperedPathsFor(trunk, '#111827', model.params.minFeatureSize, taperThreshold)}
${jointCirclesFor(model.nodes, 'trunk', '#111827', taperThreshold)}
${strokedPathsFor(trunk, '#111827', taperThreshold)}
  </g>
  <g id="branches">
${taperedPathsFor(branches, '#111827', model.params.minFeatureSize, taperThreshold)}
${jointCirclesFor(model.nodes, 'branch', '#111827', taperThreshold)}
${strokedPathsFor(branches, '#111827', taperThreshold)}
  </g>
  <g id="leaves">
${leaves}
  </g>
</g>`;
}

export function modelToSvg(model: TreeModel): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxForParams(model.params)}" width="${model.params.canvasSize}" height="${model.params.canvasSize}">
${modelToSvgInner(model)}
</svg>`;
}
