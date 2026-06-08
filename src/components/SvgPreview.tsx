import { modelToSvgInner, viewBoxForParams } from '../lib/renderSvg';
import type { TreeModel } from '../lib/types';

interface SvgPreviewProps {
  model?: TreeModel;
  isGenerating: boolean;
}

export function SvgPreview({ model, isGenerating }: SvgPreviewProps) {
  return <section className="preview-card" aria-label="SVG preview">
    {model ? <svg className="tree-svg" viewBox={viewBoxForParams(model.params)} role="img" aria-label="Generated tree of life" dangerouslySetInnerHTML={{ __html: modelToSvgInner(model) }} /> : <div className="placeholder">Preparing generator...</div>}
    {isGenerating ? <div className="generating-badge">Generating...</div> : null}
  </section>;
}
