import { createMask } from './masks';
import { taperSegment } from './taperOutline';
import type { Chain, LeafPrimitive, Point, TreeModel, TreeParams } from './types';

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
function pathsFor(chains: Chain[], fill: string, minFeatureSize: number): string {
  return chains.flatMap((chain) => chain.segments.map((segment) => `<path d="${taperSegment(segment, minFeatureSize)}" fill="${fill}" />`)).join('\n');
}
function byDepthDesc(a: Chain, b: Chain): number { return b.depth - a.depth; }

export function viewBoxForParams(params: TreeParams): string {
  const half = params.canvasSize / 2;
  return `${-half} ${-half} ${params.canvasSize} ${params.canvasSize}`;
}

export function modelToSvgInner(model: TreeModel): string {
  const mask = createMask(model.params);
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
${pathsFor(roots, '#1f2937', model.params.minFeatureSize)}
  </g>
  <g id="trunk">
${pathsFor(trunk, '#111827', model.params.minFeatureSize)}
  </g>
  <g id="branches">
${pathsFor(branches, '#111827', model.params.minFeatureSize)}
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
