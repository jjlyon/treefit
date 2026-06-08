import { modelToSvgInner, viewBoxForParams } from './renderSvg';
import type { TreeModel } from './types';

export function createSvgText(model: TreeModel): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- TreeFit params: ${JSON.stringify(model.params)} -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxForParams(model.params)}" width="${model.params.canvasSize}" height="${model.params.canvasSize}">
${modelToSvgInner(model)}
</svg>`;
}

export function downloadSvg(model: TreeModel): void {
  const text = createSvgText(model);
  const blob = new Blob([text], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const seed = model.params.seed.replace(/[^a-z0-9_-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'seed';
  link.href = url;
  link.download = `treefit-${seed}.svg`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
