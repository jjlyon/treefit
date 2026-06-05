import type { BranchSegment, LeafPrimitive, TreeModel, TreeParams } from './types';

function fmt(value: number): string {
  return Number.isFinite(value) ? Number(value.toFixed(3)).toString() : '0';
}

export function segmentPath(segment: BranchSegment): string {
  return `M ${fmt(segment.start.x)} ${fmt(segment.start.y)} C ${fmt(segment.c1.x)} ${fmt(segment.c1.y)} ${fmt(segment.c2.x)} ${fmt(segment.c2.y)} ${fmt(segment.end.x)} ${fmt(segment.end.y)}`;
}

export function leafPath(leaf: LeafPrimitive): string {
  const r = leaf.radius;
  const cx = leaf.center.x;
  const cy = leaf.center.y;
  return `M ${fmt(cx)} ${fmt(cy - r)} C ${fmt(cx + r * 0.8)} ${fmt(cy - r * 0.25)} ${fmt(cx + r * 0.62)} ${fmt(cy + r * 0.75)} ${fmt(cx)} ${fmt(cy + r)} C ${fmt(cx - r * 0.62)} ${fmt(cy + r * 0.75)} ${fmt(cx - r * 0.8)} ${fmt(cy - r * 0.25)} ${fmt(cx)} ${fmt(cy - r)} Z`;
}

export function viewBoxForParams(params: TreeParams): string {
  const half = params.canvasSize / 2;
  return `${-half} ${-half} ${params.canvasSize} ${params.canvasSize}`;
}

export function modelToSvgInner(model: TreeModel): string {
  const { params } = model;
  const renderModeFallback = params.renderMode === 'outline';
  const strokeAttrs = 'fill="none" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"';
  const roots = params.showRoots ? model.segments.filter((segment) => segment.kind === 'root') : [];
  const trunk = model.segments.filter((segment) => segment.kind === 'trunk');
  const branches = model.segments.filter((segment) => segment.kind === 'branch');

  const segmentMarkup = (segment: BranchSegment) => `<path id="${segment.id}" d="${segmentPath(segment)}" stroke-width="${fmt((segment.startThickness + segment.endThickness) / 2)}" />`;
  return `
  <g id="mask" data-treefit-group="mask" opacity="${params.showMask ? '1' : '0'}">
    <circle cx="0" cy="0" r="${fmt(params.radius - params.margin)}" ${strokeAttrs} stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="8 8" />
  </g>
  <g id="roots" data-treefit-group="roots" stroke="#1f2937" ${strokeAttrs}>
    ${roots.map(segmentMarkup).join('\n    ')}
  </g>
  <g id="trunk" data-treefit-group="trunk" stroke="#111827" ${strokeAttrs} data-render-mode="${renderModeFallback ? 'stroke-fallback' : params.renderMode}">
    ${trunk.map(segmentMarkup).join('\n    ')}
  </g>
  <g id="branches" data-treefit-group="branches" stroke="#111827" ${strokeAttrs}>
    ${branches.map(segmentMarkup).join('\n    ')}
  </g>
  <g id="bark_detail" data-treefit-group="bark_detail" stroke="#f8fafc" fill="none" stroke-linecap="round" opacity="0.72">
    ${params.showBarkDetail ? model.barkDetails.map((line) => `<path id="${line.id}" d="M ${fmt(line.start.x)} ${fmt(line.start.y)} L ${fmt(line.end.x)} ${fmt(line.end.y)}" stroke-width="${fmt(line.width)}" />`).join('\n    ') : ''}
  </g>
  <g id="leaves" data-treefit-group="leaves" stroke="#111827" fill="none" stroke-linejoin="round">
    ${params.showLeaves ? model.leaves.map((leaf) => `<path id="${leaf.id}" d="${leafPath(leaf)}" transform="rotate(${fmt((leaf.rotation * 180) / Math.PI)} ${fmt(leaf.center.x)} ${fmt(leaf.center.y)})" stroke-width="${fmt(Math.max(0.8, params.minThickness * 0.7))}" />`).join('\n    ') : ''}
  </g>`;
}

export function modelToSvg(model: TreeModel): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxForParams(model.params)}" width="${model.params.canvasSize}" height="${model.params.canvasSize}" role="img" aria-label="TreeFit generated tree of life artwork">${modelToSvgInner(model)}
</svg>`;
}
