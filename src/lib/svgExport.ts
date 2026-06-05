import type { TreeModel } from './types';
import { modelToSvgInner, viewBoxForParams } from './renderSvg';

function escapeCommentText(text: string): string {
  return text.replaceAll('--', '—');
}

export function createSvgText(model: TreeModel): string {
  const metadata = escapeCommentText(JSON.stringify(model.params, null, 2));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxForParams(model.params)}" width="${model.params.canvasSize}" height="${model.params.canvasSize}" role="img" aria-label="TreeFit generated tree of life artwork">
  <!-- TreeFit parameters
${metadata}
  -->${modelToSvgInner(model)}
</svg>
`;
}

export function downloadSvg(model: TreeModel): void {
  const svg = createSvgText(model);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const safeSeed = model.params.seed.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'seed';
  anchor.href = url;
  anchor.download = `treefit-${safeSeed}.svg`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
