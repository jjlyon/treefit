import { taperSegment } from './taperOutline';
import type { BezierSegment, LeafPrimitive, TreeModel, TreeParams } from './types';

function fmt(value: number): string { return Number.isFinite(value) ? Number(value.toFixed(3)).toString() : '0'; }

export function leafPath(leaf: LeafPrimitive): string {
  const r = leaf.radius, cx = leaf.center.x, cy = leaf.center.y;
  return `M ${fmt(cx)} ${fmt(cy - r)} C ${fmt(cx + r * 0.8)} ${fmt(cy - r * 0.25)} ${fmt(cx + r * 0.62)} ${fmt(cy + r * 0.75)} ${fmt(cx)} ${fmt(cy + r)} C ${fmt(cx - r * 0.62)} ${fmt(cy + r * 0.75)} ${fmt(cx - r * 0.8)} ${fmt(cy - r * 0.25)} ${fmt(cx)} ${fmt(cy - r)} Z`;
}

export function viewBoxForParams(params: TreeParams): string { const half = params.canvasSize / 2; return `${-half} ${-half} ${params.canvasSize} ${params.canvasSize}`; }

function segmentOutline(segment: BezierSegment, minFeatureSize: number): string {
  return taperSegment(segment.start, segment.c1, segment.c2, segment.end, segment.startThickness, segment.endThickness, minFeatureSize);
}

export function modelToSvgInner(model: TreeModel): string {
  const { params } = model;
  const clipId = 'tree-clip';
  const roots = model.chains.flatMap((chain) => chain.segments).filter((segment) => segment.kind === 'root');
  const trunk = model.chains.flatMap((chain) => chain.segments).filter((segment) => segment.kind === 'trunk');
  const branches = model.chains.flatMap((chain) => chain.segments).filter((segment) => segment.kind === 'branch').sort((a, b) => b.depth - a.depth);
  const pathMarkup = (segment: BezierSegment) => `<path id="${segment.id}" d="${segmentOutline(segment, params.minFeatureSize)}" />`;
  return `
  <defs>
    ${model.maskSvgClipPath ?? ''}
  </defs>
  <g id="mask-outline" data-treefit-group="mask-outline" opacity="${params.showMask ? '1' : '0'}" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="8 8">
    ${model.maskSvgOutline ?? ''}
  </g>
  <g id="tree" clip-path="url(#${clipId})">
    <g id="roots" data-treefit-group="roots" fill="#111827" stroke="none">
      ${roots.map(pathMarkup).join('\n      ')}
    </g>
    <g id="trunk" data-treefit-group="trunk" fill="#111827" stroke="none">
      ${trunk.map(pathMarkup).join('\n      ')}
    </g>
    <g id="branches" data-treefit-group="branches" fill="#111827" stroke="none">
      ${branches.map(pathMarkup).join('\n      ')}
    </g>
    <g id="leaves" data-treefit-group="leaves" fill="#111827" stroke="none">
      ${params.showLeaves ? model.leaves.map((leaf) => `<path id="${leaf.id}" d="${leafPath(leaf)}" transform="rotate(${fmt((leaf.rotation * 180) / Math.PI)} ${fmt(leaf.center.x)} ${fmt(leaf.center.y)})" />`).join('\n      ') : ''}
    </g>
  </g>`;
}

export function modelToSvg(model: TreeModel): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxForParams(model.params)}" width="${model.params.canvasSize}" height="${model.params.canvasSize}" role="img" aria-label="TreeFit generated tree of life artwork">${modelToSvgInner(model)}
</svg>`;
}
